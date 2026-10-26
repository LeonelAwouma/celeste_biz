-- =============================================================================
-- Phase 6 — Devis, factures (brouillon → émission sous interrupteur),
-- avoirs, profil de facturation, stockage privé des PDF.
-- Aucune facture n'est présentée comme « certifiée » : l'émission définitive
-- reste désactivée tant que la conformité fiscale n'est pas validée
-- (interrupteur plateforme en base ET variable FEATURE_FISCAL_INVOICE_ISSUE).
-- =============================================================================

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');
create type public.invoice_status as enum ('draft', 'issued', 'discarded');

-- -----------------------------------------------------------------------------
-- Interrupteurs plateforme (modifiables par l'exploitation uniquement).
-- -----------------------------------------------------------------------------

create table private.platform_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into private.platform_flags (key, enabled) values ('fiscal_invoice_issue', false);

create function public.fiscal_invoice_issue_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select enabled from private.platform_flags where key = 'fiscal_invoice_issue'), false);
$$;

revoke all on function public.fiscal_invoice_issue_enabled() from public, anon;
grant execute on function public.fiscal_invoice_issue_enabled() to authenticated;

-- -----------------------------------------------------------------------------
-- Numérotation des pièces (par entreprise, préfixe et exercice civil).
-- -----------------------------------------------------------------------------

create table private.document_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  prefix text not null check (prefix in ('DEV', 'FAC', 'AV')),
  year integer not null check (year between 2000 and 2999),
  last_value integer not null check (last_value > 0),
  primary key (business_id, prefix, year)
);

create function private.next_document_number(p_business_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_value integer;
begin
  select extract(year from now() at time zone b.timezone)::integer into v_year
  from public.businesses b where b.id = p_business_id;

  insert into private.document_counters as c (business_id, prefix, year, last_value)
  values (p_business_id, p_prefix, v_year, 1)
  on conflict (business_id, prefix, year) do update set last_value = c.last_value + 1
  returning last_value into v_value;

  return format('%s-%s-%s', p_prefix, v_year, lpad(v_value::text, 4, '0'));
end;
$$;

revoke all on function private.next_document_number(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Profil de facturation (vendeur) : modifiable par le propriétaire.
-- -----------------------------------------------------------------------------

create function public.update_fiscal_profile(p_business_id uuid, p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if not private.has_business_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'profil invalide' using errcode = '22023';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_profile) loop
    if v_key not in ('legal_name', 'niu', 'rccm', 'tax_regime', 'address', 'phone', 'email', 'invoice_mentions')
      or jsonb_typeof(v_value) <> 'string'
      or char_length(jsonb_build_array(v_value) ->> 0) > 1000
      or (v_key <> 'invoice_mentions' and char_length(jsonb_build_array(v_value) ->> 0) > 200) then
      raise exception 'champ de profil invalide : %', v_key using errcode = '22023';
    end if;
  end loop;

  update public.business_settings set fiscal_profile = p_profile where business_id = p_business_id;
  perform private.write_audit(p_business_id, 'fiscal_profile.updated', 'business', p_business_id::text,
    jsonb_build_object('fields', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_profile) k)));
end;
$$;

revoke all on function public.update_fiscal_profile(uuid, jsonb) from public, anon;
grant execute on function public.update_fiscal_profile(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Devis
-- -----------------------------------------------------------------------------

create table public.quotes (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null,
  code text not null check (code ~ '^DEV-[0-9]{4}-[0-9]{4,}$'),
  status public.quote_status not null default 'draft',
  valid_until date,
  conditions text check (conditions is null or char_length(conditions) <= 2000),
  notes text check (notes is null or char_length(notes) <= 2000),
  subtotal numeric(18, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18, 2) not null default 0 check (tax_total >= 0),
  total numeric(18, 2) not null default 0 check (total >= 0),
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  version integer not null default 1 check (version > 0),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  -- Acceptation : « manual » (déclarée par le commerçant) ou « link » (lien client, phase 8).
  acceptance_source text check (acceptance_source in ('manual', 'link')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  order_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code),
  check ((status = 'accepted') = (acceptance_source is not null)),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  foreign key (business_id, order_id) references public.orders (business_id, id)
);

create index quotes_business_created_idx on public.quotes (business_id, created_at desc, id desc);

create trigger quotes_touch before update on public.quotes
  for each row execute function private.touch_updated_at();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  quote_id uuid not null,
  position integer not null check (position between 0 and 999),
  catalog_item_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  unit text check (unit is null or char_length(unit) <= 30),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 100000),
  unit_price numeric(18, 2) not null check (unit_price >= 0 and unit_price <= 1000000000),
  discount numeric(18, 2) not null default 0 check (discount >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  line_net numeric(18, 2) generated always as (round(quantity * unit_price, 2) - discount) stored,
  line_tax numeric(18, 2) generated always as (
    round((round(quantity * unit_price, 2) - discount) * tax_rate / 100, 2)
  ) stored,
  check (discount <= round(quantity * unit_price, 2)),
  unique (quote_id, position),
  foreign key (business_id, quote_id) references public.quotes (business_id, id) on delete cascade,
  foreign key (business_id, catalog_item_id) references public.catalog_items (business_id, id)
);

-- -----------------------------------------------------------------------------
-- Factures et avoirs
-- -----------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null,
  order_id uuid,
  status public.invoice_status not null default 'draft',
  -- Numéro attribué à l'émission seulement (numérotation sans trou).
  number text check (number is null or number ~ '^FAC-[0-9]{4}-[0-9]{4,}$'),
  issue_date date,
  due_date date,
  conditions text check (conditions is null or char_length(conditions) <= 2000),
  -- Instantanés figés à l'émission (vendeur, acheteur, profil fiscal).
  seller jsonb,
  buyer jsonb,
  subtotal numeric(18, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18, 2) not null default 0 check (tax_total >= 0),
  total numeric(18, 2) not null default 0 check (total >= 0),
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  version integer not null default 1 check (version > 0),
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  pdf_path text,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, number),
  check ((status = 'issued') = (number is not null and issued_at is not null and seller is not null)),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  foreign key (business_id, order_id) references public.orders (business_id, id)
);

create index invoices_business_created_idx on public.invoices (business_id, created_at desc, id desc);
create index invoices_order_idx on public.invoices (order_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  position integer not null check (position between 0 and 999),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  unit text check (unit is null or char_length(unit) <= 30),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(18, 2) not null check (unit_price >= 0),
  discount numeric(18, 2) not null default 0 check (discount >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  line_net numeric(18, 2) generated always as (round(quantity * unit_price, 2) - discount) stored,
  line_tax numeric(18, 2) generated always as (
    round((round(quantity * unit_price, 2) - discount) * tax_rate / 100, 2)
  ) stored,
  unique (invoice_id, position),
  foreign key (business_id, invoice_id) references public.invoices (business_id, id) on delete cascade
);

create table public.credit_notes (
  id uuid primary key,
  business_id uuid not null,
  invoice_id uuid not null,
  number text not null check (number ~ '^AV-[0-9]{4}-[0-9]{4,}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  amount numeric(18, 2) not null check (amount > 0),
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  issue_date date not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users (id) on delete set null,
  pdf_path text,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  unique (business_id, number),
  foreign key (business_id, invoice_id) references public.invoices (business_id, id)
);

create index credit_notes_invoice_idx on public.credit_notes (invoice_id);

-- -----------------------------------------------------------------------------
-- Immuabilité des pièces émises (même pour les fonctions serveur).
-- -----------------------------------------------------------------------------

create function private.protect_issued_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'une facture émise ne peut pas être supprimée' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    -- Seul l'archivage du PDF (une fois) est permis.
    if (to_jsonb(new) - array['pdf_path', 'pdf_sha256', 'updated_at'])
       is distinct from (to_jsonb(old) - array['pdf_path', 'pdf_sha256', 'updated_at'])
       or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
       or (old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256) then
      raise exception 'une facture émise est immuable : corrigez-la par un avoir' using errcode = '42501';
    end if;
  elsif old.status = 'discarded' then
    raise exception 'brouillon abandonné' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger invoices_protect before update or delete on public.invoices
  for each row execute function private.protect_issued_invoice();

create function private.protect_issued_invoice_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
begin
  if exists (select 1 from public.invoices where id = v_invoice_id and status <> 'draft') then
    raise exception 'les lignes d''une facture émise sont immuables' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger invoice_items_protect before insert or update or delete on public.invoice_items
  for each row execute function private.protect_issued_invoice_items();

create function private.protect_credit_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'un avoir ne peut pas être supprimé' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['pdf_path', 'pdf_sha256']) is distinct from (to_jsonb(old) - array['pdf_path', 'pdf_sha256'])
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception 'un avoir émis est immuable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger credit_notes_protect before update or delete on public.credit_notes
  for each row execute function private.protect_credit_note();

-- -----------------------------------------------------------------------------
-- Privilèges : lecture par les membres, écritures par fonctions.
-- -----------------------------------------------------------------------------

revoke all on public.quotes, public.quote_items, public.invoices, public.invoice_items, public.credit_notes
  from anon, authenticated;
grant select on public.quotes, public.quote_items, public.invoices, public.invoice_items, public.credit_notes
  to authenticated;

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.credit_notes enable row level security;

create policy quotes_select on public.quotes
  for select to authenticated using (private.is_business_member(business_id));
create policy quote_items_select on public.quote_items
  for select to authenticated using (private.is_business_member(business_id));
create policy invoices_select on public.invoices
  for select to authenticated using (private.is_business_member(business_id));
create policy invoice_items_select on public.invoice_items
  for select to authenticated using (private.is_business_member(business_id));
create policy credit_notes_select on public.credit_notes
  for select to authenticated using (private.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- Fonctions internes
-- -----------------------------------------------------------------------------

create function private.replace_quote_items(p_business_id uuid, p_quote_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.raise_rule('Ajoutez au moins une ligne au devis.');
  end if;
  if jsonb_array_length(p_items) > 100 then
    perform private.raise_rule('100 lignes au maximum par devis.');
  end if;

  delete from public.quote_items where quote_id = p_quote_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.quote_items (
      business_id, quote_id, position, catalog_item_id, name, unit, quantity, unit_price, discount, tax_rate
    ) values (
      p_business_id, p_quote_id, v_position,
      nullif(v_item ->> 'catalog_item_id', '')::uuid,
      btrim(v_item ->> 'name'),
      nullif(btrim(coalesce(v_item ->> 'unit', '')), ''),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit_price')::numeric,
      coalesce(nullif(v_item ->> 'discount', '')::numeric, 0),
      coalesce(nullif(v_item ->> 'tax_rate', '')::numeric, 0)
    );
    v_position := v_position + 1;
  end loop;

  update public.quotes q
  set subtotal = t.subtotal, tax_total = t.tax_total, total = t.subtotal + t.tax_total
  from (
    select coalesce(sum(line_net), 0) as subtotal, coalesce(sum(line_tax), 0) as tax_total
    from public.quote_items where quote_id = p_quote_id
  ) t
  where q.id = p_quote_id;
end;
$$;

create function private.recompute_invoice(p_invoice_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoices i
  set subtotal = t.subtotal, tax_total = t.tax_total, total = t.subtotal + t.tax_total
  from (
    select coalesce(sum(line_net), 0) as subtotal, coalesce(sum(line_tax), 0) as tax_total
    from public.invoice_items where invoice_id = p_invoice_id
  ) t
  where i.id = p_invoice_id;
$$;

-- Copie les lignes de la commande dans le brouillon de facture.
create function private.copy_order_items_to_invoice(p_invoice_id uuid, p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.invoice_items where invoice_id = p_invoice_id;
  insert into public.invoice_items (business_id, invoice_id, position, name, unit, quantity, unit_price, discount, tax_rate)
  select business_id, p_invoice_id, position, name, unit, quantity, unit_price, discount, tax_rate
  from public.order_items where order_id = p_order_id;
  select private.recompute_invoice(p_invoice_id);
$$;

revoke all on function private.replace_quote_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.recompute_invoice(uuid) from public, anon, authenticated;
revoke all on function private.copy_order_items_to_invoice(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC devis
-- -----------------------------------------------------------------------------

create function public.create_quote(
  p_id uuid,
  p_business_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_valid_until date default null,
  p_conditions text default null,
  p_notes text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager', 'staff']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_id;
  if found then
    if v_quote.business_id <> p_business_id then
      raise exception 'identifiant déjà utilisé' using errcode = '42501';
    end if;
    return v_quote;
  end if;

  if not exists (
    select 1 from public.customers
    where business_id = p_business_id and id = p_customer_id and archived_at is null
  ) then
    perform private.raise_rule('Choisissez un client actif de votre entreprise.');
  end if;

  insert into public.quotes (id, business_id, customer_id, code, valid_until, conditions, notes, created_by)
  values (p_id, p_business_id, p_customer_id, private.next_document_number(p_business_id, 'DEV'),
    p_valid_until, nullif(btrim(p_conditions), ''), nullif(btrim(p_notes), ''), auth.uid());
  perform private.replace_quote_items(p_business_id, p_id, p_items);

  select * into v_quote from public.quotes where id = p_id;
  return v_quote;
end;
$$;

create function public.update_quote(
  p_quote_id uuid,
  p_expected_version integer,
  p_customer_id uuid,
  p_items jsonb,
  p_valid_until date,
  p_conditions text,
  p_notes text
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found or not private.has_business_role(
    v_quote.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_quote.version <> p_expected_version then
    raise exception 'Le devis a été modifié entre-temps.' using errcode = 'CB409';
  end if;
  if v_quote.status <> 'draft' then
    perform private.raise_rule('Seul un devis en brouillon se modifie. Repassez-le en brouillon d''abord.');
  end if;
  if not exists (
    select 1 from public.customers
    where business_id = v_quote.business_id and id = p_customer_id and archived_at is null
  ) then
    perform private.raise_rule('Choisissez un client actif de votre entreprise.');
  end if;

  update public.quotes
  set customer_id = p_customer_id, valid_until = p_valid_until,
      conditions = nullif(btrim(p_conditions), ''), notes = nullif(btrim(p_notes), ''),
      version = version + 1
  where id = p_quote_id;
  perform private.replace_quote_items(v_quote.business_id, p_quote_id, p_items);

  select * into v_quote from public.quotes where id = p_quote_id;
  return v_quote;
end;
$$;

-- États : brouillon → envoyé → accepté | refusé ; annulation documentée.
-- Un devis envoyé dont la date de validité est passée est « expiré ».
create function public.transition_quote(
  p_quote_id uuid,
  p_expected_version integer,
  p_to_status public.quote_status,
  p_note text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_today date;
  v_roles public.business_role[] := array['owner', 'manager', 'staff']::public.business_role[];
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found or not private.is_business_member(v_quote.business_id) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_quote.version <> p_expected_version then
    raise exception 'Le devis a été modifié entre-temps.' using errcode = 'CB409';
  end if;

  if not (
    (v_quote.status = 'draft' and p_to_status in ('sent', 'cancelled'))
    or (v_quote.status = 'sent' and p_to_status in ('accepted', 'rejected', 'expired', 'cancelled', 'draft'))
    or (v_quote.status = 'expired' and p_to_status in ('draft', 'cancelled'))
  ) then
    perform private.raise_rule('Ce changement d''état n''est pas possible pour ce devis.');
  end if;
  if p_to_status = 'cancelled' then
    v_roles := array['owner', 'manager']::public.business_role[];
  end if;
  if not private.has_business_role(v_quote.business_id, v_roles) then
    raise exception 'action non autorisée pour votre rôle' using errcode = '42501';
  end if;

  select (now() at time zone b.timezone)::date into v_today
  from public.businesses b where b.id = v_quote.business_id;
  if p_to_status = 'accepted' and v_quote.valid_until is not null and v_quote.valid_until < v_today then
    perform private.raise_rule('Le devis a expiré : repassez-le en brouillon et mettez à jour la date de validité.');
  end if;
  if p_to_status = 'sent' and v_quote.valid_until is not null and v_quote.valid_until < v_today then
    perform private.raise_rule('La date de validité est déjà passée.');
  end if;

  update public.quotes
  set status = p_to_status,
      version = version + 1,
      sent_at = case when p_to_status = 'sent' then now() when p_to_status = 'draft' then null else sent_at end,
      decided_at = case when p_to_status in ('accepted', 'rejected', 'cancelled', 'expired') then now() end,
      decided_by = case when p_to_status in ('accepted', 'rejected', 'cancelled') then auth.uid() end,
      acceptance_source = case when p_to_status = 'accepted' then 'manual' end,
      decision_note = case when p_to_status in ('accepted', 'rejected', 'cancelled')
        then left(nullif(btrim(p_note), ''), 500) end
  where id = p_quote_id;

  perform private.write_audit(v_quote.business_id, 'quote.' || p_to_status::text, 'quote', p_quote_id::text,
    jsonb_build_object('from', v_quote.status));

  select * into v_quote from public.quotes where id = p_quote_id;
  return v_quote;
end;
$$;

-- Devis accepté → commande confirmée avec copie figée des lignes.
create function public.convert_quote_to_order(
  p_quote_id uuid,
  p_order_id uuid,
  p_due_at timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_order public.orders;
  v_items jsonb;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found or not private.has_business_role(
    v_quote.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  -- Double envoi : la commande déjà créée est renvoyée.
  if v_quote.order_id is not null then
    select * into v_order from public.orders where id = v_quote.order_id;
    return v_order;
  end if;
  if v_quote.status <> 'accepted' then
    perform private.raise_rule('Seul un devis accepté peut devenir une commande.');
  end if;

  select jsonb_agg(jsonb_build_object(
    'catalog_item_id', catalog_item_id, 'name', name, 'unit', unit, 'quantity', quantity,
    'unit_price', unit_price, 'discount', discount, 'tax_rate', tax_rate
  ) order by position) into v_items
  from public.quote_items where quote_id = p_quote_id;

  select * into v_order from public.create_order(
    p_order_id, v_quote.business_id, v_quote.customer_id, v_items, 'confirmed', p_due_at, null,
    format('Issue du devis %s.', v_quote.code), '{}'::jsonb
  );

  update public.quotes set order_id = v_order.id, version = version + 1 where id = p_quote_id;
  perform private.log_order_event(v_quote.business_id, v_order.id, 'updated', null, null,
    jsonb_build_object('changed', jsonb_build_array('from_quote'), 'quote', v_quote.code));
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC factures
-- -----------------------------------------------------------------------------

create function public.create_invoice_from_order(p_id uuid, p_order_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_invoice public.invoices;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not private.has_business_role(
    v_order.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  select * into v_invoice from public.invoices where id = p_id;
  if found then
    if v_invoice.order_id is distinct from p_order_id then
      raise exception 'identifiant déjà utilisé' using errcode = '42501';
    end if;
    return v_invoice;
  end if;

  if v_order.status in ('draft', 'cancelled') then
    perform private.raise_rule('Une commande en brouillon ou annulée ne se facture pas.');
  end if;
  if exists (select 1 from public.invoices where order_id = p_order_id and status = 'draft') then
    perform private.raise_rule('Un brouillon de facture existe déjà pour cette commande.');
  end if;

  insert into public.invoices (id, business_id, customer_id, order_id, created_by)
  values (p_id, v_order.business_id, v_order.customer_id, p_order_id, auth.uid());
  perform private.copy_order_items_to_invoice(p_id, p_order_id);

  select * into v_invoice from public.invoices where id = p_id;
  return v_invoice;
end;
$$;

create function public.update_invoice_draft(
  p_invoice_id uuid,
  p_expected_version integer,
  p_due_date date,
  p_conditions text,
  p_refresh_items boolean default false
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or not private.has_business_role(
    v_invoice.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_invoice.version <> p_expected_version then
    raise exception 'La facture a été modifiée entre-temps.' using errcode = 'CB409';
  end if;
  if v_invoice.status <> 'draft' then
    perform private.raise_rule('Une facture émise ne se modifie pas : établissez un avoir.');
  end if;

  update public.invoices
  set due_date = p_due_date, conditions = nullif(btrim(p_conditions), ''), version = version + 1
  where id = p_invoice_id;
  if p_refresh_items and v_invoice.order_id is not null then
    perform private.copy_order_items_to_invoice(p_invoice_id, v_invoice.order_id);
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id;
  return v_invoice;
end;
$$;

create function public.discard_invoice_draft(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or not private.has_business_role(
    v_invoice.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' then
    perform private.raise_rule('Seul un brouillon peut être abandonné.');
  end if;
  update public.invoices set status = 'discarded', version = version + 1 where id = p_invoice_id;
end;
$$;

-- Émission définitive : interrupteur plateforme obligatoire.
create function public.issue_invoice(p_invoice_id uuid, p_expected_version integer)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_business public.businesses;
  v_settings public.business_settings;
  v_customer public.customers;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or not private.has_business_role(
    v_invoice.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if not public.fiscal_invoice_issue_enabled() then
    perform private.raise_rule('L''émission définitive des factures est désactivée tant que la conformité fiscale n''est pas validée.');
  end if;
  if v_invoice.version <> p_expected_version then
    raise exception 'La facture a été modifiée entre-temps.' using errcode = 'CB409';
  end if;
  if v_invoice.status <> 'draft' then
    perform private.raise_rule('Cette facture n''est pas un brouillon.');
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    perform private.raise_rule('Une facture sans ligne ne peut pas être émise.');
  end if;

  select * into v_business from public.businesses where id = v_invoice.business_id;
  select * into v_settings from public.business_settings where business_id = v_invoice.business_id;
  select * into v_customer from public.customers where id = v_invoice.customer_id;
  if coalesce(v_settings.fiscal_profile ->> 'legal_name', '') = '' then
    perform private.raise_rule('Renseignez d''abord le profil de facturation (raison sociale) dans les paramètres.');
  end if;

  update public.invoices
  set status = 'issued',
      number = private.next_document_number(v_invoice.business_id, 'FAC'),
      issue_date = (now() at time zone v_business.timezone)::date,
      issued_at = now(),
      issued_by = auth.uid(),
      seller = jsonb_build_object(
        'name', v_business.name, 'city', v_business.city, 'phone', v_business.whatsapp_phone_e164,
        'fiscal', v_settings.fiscal_profile
      ),
      buyer = jsonb_build_object('name', v_customer.name, 'phone', v_customer.phone_e164, 'email', v_customer.email),
      version = version + 1
  where id = p_invoice_id;

  perform private.write_audit(v_invoice.business_id, 'invoice.issued', 'invoice', p_invoice_id::text);
  select * into v_invoice from public.invoices where id = p_invoice_id;
  return v_invoice;
end;
$$;

-- Archive le PDF d'une pièce émise (une seule fois, empreinte SHA-256).
create function public.attach_document_pdf(p_kind text, p_id uuid, p_path text, p_sha256 text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_existing text;
begin
  if p_kind = 'invoice' then
    select business_id, pdf_path into v_business_id, v_existing
    from public.invoices where id = p_id and status = 'issued';
  elsif p_kind = 'credit_note' then
    select business_id, pdf_path into v_business_id, v_existing from public.credit_notes where id = p_id;
  end if;
  if v_business_id is null or not private.has_business_role(
    v_business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_existing is not null then
    return;
  end if;
  if split_part(p_path, '/', 1) <> v_business_id::text then
    raise exception 'chemin invalide' using errcode = '22023';
  end if;

  if p_kind = 'invoice' then
    update public.invoices set pdf_path = p_path, pdf_sha256 = p_sha256 where id = p_id;
  else
    update public.credit_notes set pdf_path = p_path, pdf_sha256 = p_sha256 where id = p_id;
  end if;
end;
$$;

-- Avoir : corrige une facture émise sans la modifier.
create function public.issue_credit_note(p_id uuid, p_invoice_id uuid, p_amount numeric, p_reason text)
returns public.credit_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_note public.credit_notes;
  v_credited numeric;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or not private.has_business_role(
    v_invoice.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  select * into v_note from public.credit_notes where id = p_id;
  if found then
    if v_note.invoice_id <> p_invoice_id then
      raise exception 'identifiant déjà utilisé' using errcode = '42501';
    end if;
    return v_note;
  end if;

  if not public.fiscal_invoice_issue_enabled() then
    perform private.raise_rule('L''émission des avoirs est désactivée tant que la conformité fiscale n''est pas validée.');
  end if;
  if v_invoice.status <> 'issued' then
    perform private.raise_rule('Un avoir porte sur une facture émise.');
  end if;
  if nullif(btrim(p_reason), '') is null then
    perform private.raise_rule('Indiquez le motif de l''avoir.');
  end if;
  select coalesce(sum(amount), 0) into v_credited from public.credit_notes where invoice_id = p_invoice_id;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount > v_invoice.total - v_credited then
    perform private.raise_rule(format('Montant invalide : au plus %s FCFA restent à créditer.',
      to_char(v_invoice.total - v_credited, 'FM999G999G999G990')));
  end if;

  insert into public.credit_notes (id, business_id, invoice_id, number, reason, amount, issue_date, issued_by)
  select p_id, v_invoice.business_id, p_invoice_id, private.next_document_number(v_invoice.business_id, 'AV'),
    left(btrim(p_reason), 500), p_amount, (now() at time zone b.timezone)::date, auth.uid()
  from public.businesses b where b.id = v_invoice.business_id
  returning * into v_note;

  perform private.write_audit(v_invoice.business_id, 'credit_note.issued', 'invoice', p_invoice_id::text,
    jsonb_build_object('credit_note', v_note.number, 'amount', p_amount));
  return v_note;
end;
$$;

revoke all on function public.create_quote(uuid, uuid, uuid, jsonb, date, text, text) from public, anon;
revoke all on function public.update_quote(uuid, integer, uuid, jsonb, date, text, text) from public, anon;
revoke all on function public.transition_quote(uuid, integer, public.quote_status, text) from public, anon;
revoke all on function public.convert_quote_to_order(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.create_invoice_from_order(uuid, uuid) from public, anon;
revoke all on function public.update_invoice_draft(uuid, integer, date, text, boolean) from public, anon;
revoke all on function public.discard_invoice_draft(uuid) from public, anon;
revoke all on function public.issue_invoice(uuid, integer) from public, anon;
revoke all on function public.attach_document_pdf(text, uuid, text, text) from public, anon;
revoke all on function public.issue_credit_note(uuid, uuid, numeric, text) from public, anon;

grant execute on function public.create_quote(uuid, uuid, uuid, jsonb, date, text, text) to authenticated;
grant execute on function public.update_quote(uuid, integer, uuid, jsonb, date, text, text) to authenticated;
grant execute on function public.transition_quote(uuid, integer, public.quote_status, text) to authenticated;
grant execute on function public.convert_quote_to_order(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.create_invoice_from_order(uuid, uuid) to authenticated;
grant execute on function public.update_invoice_draft(uuid, integer, date, text, boolean) to authenticated;
grant execute on function public.discard_invoice_draft(uuid) to authenticated;
grant execute on function public.issue_invoice(uuid, integer) to authenticated;
grant execute on function public.attach_document_pdf(text, uuid, text, text) to authenticated;
grant execute on function public.issue_credit_note(uuid, uuid, numeric, text) to authenticated;

-- -----------------------------------------------------------------------------
-- PDF des pièces émises : stockage privé, un dossier par entreprise, aucune
-- modification ni suppression.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy documents_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and private.is_business_member(private.folder_business_id(name)));

create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and private.has_business_role(private.folder_business_id(name), array['owner', 'manager']::public.business_role[])
  );
