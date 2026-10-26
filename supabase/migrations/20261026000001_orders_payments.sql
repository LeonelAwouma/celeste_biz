-- =============================================================================
-- Phase 5 — Commandes, lignes figées, transitions contrôlées, encaissements
-- manuels déclarés et solde.
-- Aucune écriture directe : toutes les modifications passent par des
-- fonctions transactionnelles qui vérifient le rôle, verrouillent la
-- commande, recalculent les montants en SQL (numeric) et journalisent.
-- Erreurs métier : SQLSTATE 'CB422' (message affichable), 'CB409' (version
-- périmée : la commande a été modifiée entre-temps).
-- =============================================================================

create type public.order_status as enum (
  'draft', 'pending_confirmation', 'confirmed', 'in_progress', 'ready',
  'delivered', 'closed', 'cancelled', 'disputed'
);
create type public.payment_method as enum ('cash', 'mobile_money', 'bank_transfer', 'other');
create type public.payment_status as enum (
  'manual_declared', 'pending_provider', 'provider_verified', 'failed', 'refunded', 'cancelled'
);

-- -----------------------------------------------------------------------------
-- Transitions autorisées (données de référence, miroir TypeScript testé).
-- -----------------------------------------------------------------------------

create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  roles public.business_role[] not null,
  primary key (from_status, to_status),
  check (from_status <> to_status)
);

insert into public.order_status_transitions (from_status, to_status, roles) values
  ('draft', 'pending_confirmation', '{owner,manager,staff}'),
  ('draft', 'confirmed', '{owner,manager,staff}'),
  ('draft', 'cancelled', '{owner,manager}'),
  ('pending_confirmation', 'confirmed', '{owner,manager,staff}'),
  ('pending_confirmation', 'draft', '{owner,manager,staff}'),
  ('pending_confirmation', 'cancelled', '{owner,manager}'),
  ('confirmed', 'in_progress', '{owner,manager,staff}'),
  ('confirmed', 'ready', '{owner,manager,staff}'),
  ('confirmed', 'cancelled', '{owner,manager}'),
  ('confirmed', 'disputed', '{owner,manager}'),
  ('in_progress', 'ready', '{owner,manager,staff}'),
  ('in_progress', 'confirmed', '{owner,manager,staff}'),
  ('in_progress', 'cancelled', '{owner,manager}'),
  ('in_progress', 'disputed', '{owner,manager}'),
  ('ready', 'delivered', '{owner,manager,staff}'),
  ('ready', 'in_progress', '{owner,manager,staff}'),
  ('ready', 'cancelled', '{owner,manager}'),
  ('ready', 'disputed', '{owner,manager}'),
  ('delivered', 'closed', '{owner,manager}'),
  ('delivered', 'disputed', '{owner,manager}'),
  ('disputed', 'in_progress', '{owner,manager}'),
  ('disputed', 'ready', '{owner,manager}'),
  ('disputed', 'delivered', '{owner,manager}'),
  ('disputed', 'closed', '{owner,manager}'),
  ('disputed', 'cancelled', '{owner,manager}');

revoke all on public.order_status_transitions from anon, authenticated;
grant select on public.order_status_transitions to authenticated;
alter table public.order_status_transitions enable row level security;
create policy order_status_transitions_read on public.order_status_transitions
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Numérotation lisible par entreprise et par année (CMD-2026-0042).
-- -----------------------------------------------------------------------------

create table private.order_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  year integer not null check (year between 2000 and 2999),
  last_value integer not null check (last_value > 0),
  primary key (business_id, year)
);

create function private.next_order_code(p_business_id uuid)
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

  -- Atomique : deux créations simultanées obtiennent deux numéros distincts.
  insert into private.order_counters as c (business_id, year, last_value)
  values (p_business_id, v_year, 1)
  on conflict (business_id, year) do update set last_value = c.last_value + 1
  returning last_value into v_value;

  return format('CMD-%s-%s', v_year, lpad(v_value::text, 4, '0'));
end;
$$;

revoke all on function private.next_order_code(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Commandes
-- -----------------------------------------------------------------------------

create table public.orders (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null,
  code text not null check (code ~ '^CMD-[0-9]{4}-[0-9]{4,}$'),
  status public.order_status not null default 'confirmed',
  -- Profil métier utilisé à la création (les informations restent lisibles
  -- même si l'entreprise change de métier).
  profession_key text not null,
  profession_version integer not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  production_step text check (production_step is null or production_step ~ '^[a-z][a-z0-9_]*$'),
  due_at timestamptz,
  assignee_id uuid,
  -- Notes internes : jamais visibles par le client final.
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Montants recalculés par le serveur uniquement.
  subtotal numeric(18, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18, 2) not null default 0 check (tax_total >= 0),
  total numeric(18, 2) not null default 0 check (total >= 0),
  paid_total numeric(18, 2) not null default 0 check (paid_total >= 0),
  balance numeric(18, 2) generated always as (total - paid_total) stored,
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  version integer not null default 1 check (version > 0),
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code),
  -- Pas de solde négatif : on n'encaisse pas plus que le total.
  check (paid_total <= total),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  foreign key (business_id, assignee_id)
    references public.business_members (business_id, user_id) on delete set null (assignee_id),
  foreign key (profession_key, profession_version)
    references public.profession_templates (key, version)
);

create index orders_business_created_idx on public.orders (business_id, created_at desc, id desc);
create index orders_business_due_idx on public.orders (business_id, due_at, id)
  where status not in ('delivered', 'closed', 'cancelled');
create index orders_business_customer_idx on public.orders (business_id, customer_id, created_at desc);
create index orders_business_balance_idx on public.orders (business_id, created_at desc)
  where balance > 0 and status not in ('draft', 'cancelled');

create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  order_id uuid not null,
  position integer not null check (position between 0 and 999),
  -- Copie du catalogue au moment de la commande : un changement de prix
  -- ultérieur ne modifie jamais une ligne existante.
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
  created_at timestamptz not null default now(),
  check (discount <= round(quantity * unit_price, 2)),
  unique (order_id, position),
  foreign key (business_id, order_id) references public.orders (business_id, id) on delete cascade,
  foreign key (business_id, catalog_item_id) references public.catalog_items (business_id, id)
);

create index order_items_order_idx on public.order_items (order_id, position);

-- Journal append-only des événements d'une commande.
create table public.order_events (
  id bigint generated always as identity primary key,
  business_id uuid not null,
  order_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in (
    'created', 'updated', 'status_changed', 'payment_recorded', 'payment_cancelled'
  )),
  from_status public.order_status,
  to_status public.order_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (business_id, order_id) references public.orders (business_id, id) on delete cascade
);

create index order_events_order_idx on public.order_events (order_id, id);

create table public.payments (
  id uuid primary key,
  business_id uuid not null,
  order_id uuid not null,
  method public.payment_method not null,
  amount numeric(18, 2) not null check (amount > 0),
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  -- Mode manuel : « déclaré », jamais « vérifié » sans preuve du fournisseur.
  status public.payment_status not null default 'manual_declared',
  paid_on date not null,
  reference text check (reference is null or char_length(reference) <= 100),
  note text check (note is null or char_length(note) <= 500),
  provider text,
  provider_reference text,
  recorded_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, order_id) references public.orders (business_id, id) on delete cascade,
  check ((status = 'cancelled') = (cancelled_at is not null))
);

create index payments_order_idx on public.payments (order_id, created_at);
create index payments_business_paid_idx on public.payments (business_id, paid_on);

-- -----------------------------------------------------------------------------
-- Privilèges : lecture par les membres, aucune écriture directe.
-- -----------------------------------------------------------------------------

revoke all on public.orders, public.order_items, public.order_events, public.payments
  from anon, authenticated;
grant select on public.orders, public.order_items, public.order_events, public.payments
  to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;

create policy orders_select on public.orders
  for select to authenticated using (private.is_business_member(business_id));
create policy order_items_select on public.order_items
  for select to authenticated using (private.is_business_member(business_id));
create policy order_events_select on public.order_events
  for select to authenticated using (private.is_business_member(business_id));
create policy payments_select on public.payments
  for select to authenticated using (private.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- Fonctions internes
-- -----------------------------------------------------------------------------

create function private.raise_rule(p_message text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_message using errcode = 'CB422';
end;
$$;

-- Recalcule les montants de la commande (lignes et encaissements comptés).
create function private.recompute_order(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders o
  set subtotal = t.subtotal,
      tax_total = t.tax_total,
      total = t.subtotal + t.tax_total,
      paid_total = t.paid_total
  from (
    select
      coalesce((select sum(i.line_net) from public.order_items i where i.order_id = p_order_id), 0) as subtotal,
      coalesce((select sum(i.line_tax) from public.order_items i where i.order_id = p_order_id), 0) as tax_total,
      coalesce((
        select sum(p.amount) from public.payments p
        where p.order_id = p_order_id and p.status in ('manual_declared', 'provider_verified')
      ), 0) as paid_total
  ) t
  where o.id = p_order_id;
$$;

-- Remplace les lignes d'une commande à partir d'un tableau JSON validé.
create function private.replace_order_items(p_business_id uuid, p_order_id uuid, p_items jsonb)
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
    perform private.raise_rule('Ajoutez au moins une ligne à la commande.');
  end if;
  if jsonb_array_length(p_items) > 100 then
    perform private.raise_rule('100 lignes au maximum par commande.');
  end if;

  delete from public.order_items where order_id = p_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      business_id, order_id, position, catalog_item_id, name, unit,
      quantity, unit_price, discount, tax_rate
    ) values (
      p_business_id,
      p_order_id,
      v_position,
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
end;
$$;

create function private.check_assignee(p_business_id uuid, p_assignee_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_assignee_id is not null and not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = p_assignee_id
      and status = 'active' and role <> 'viewer'
  ) then
    perform private.raise_rule('Le responsable choisi ne fait pas partie de l''équipe.');
  end if;
end;
$$;

create function private.log_order_event(
  p_business_id uuid,
  p_order_id uuid,
  p_type text,
  p_from public.order_status default null,
  p_to public.order_status default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_events (business_id, order_id, actor_id, type, from_status, to_status, metadata)
  values (p_business_id, p_order_id, auth.uid(), p_type, p_from, p_to, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on function private.raise_rule(text) from public, anon, authenticated;
revoke all on function private.recompute_order(uuid) from public, anon, authenticated;
revoke all on function private.replace_order_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.check_assignee(uuid, uuid) from public, anon, authenticated;
revoke all on function private.log_order_event(uuid, uuid, text, public.order_status, public.order_status, jsonb)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC : création (idempotente par identifiant client)
-- -----------------------------------------------------------------------------

create function public.create_order(
  p_id uuid,
  p_business_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_status public.order_status default 'confirmed',
  p_due_at timestamptz default null,
  p_assignee_id uuid default null,
  p_notes text default null,
  p_details jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_business public.businesses;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager', 'staff']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  -- Double envoi : la commande déjà créée est renvoyée telle quelle.
  select * into v_order from public.orders where id = p_id;
  if found then
    if v_order.business_id <> p_business_id then
      raise exception 'identifiant déjà utilisé' using errcode = '42501';
    end if;
    return v_order;
  end if;

  if p_status not in ('draft', 'pending_confirmation', 'confirmed') then
    perform private.raise_rule('Une nouvelle commande est un brouillon, en attente ou confirmée.');
  end if;
  if not exists (
    select 1 from public.customers
    where business_id = p_business_id and id = p_customer_id and archived_at is null
  ) then
    perform private.raise_rule('Choisissez un client actif de votre entreprise.');
  end if;
  perform private.check_assignee(p_business_id, p_assignee_id);

  select * into v_business from public.businesses where id = p_business_id;

  insert into public.orders (
    id, business_id, customer_id, code, status, profession_key, profession_version,
    details, due_at, assignee_id, notes, created_by
  ) values (
    p_id, p_business_id, p_customer_id, private.next_order_code(p_business_id), p_status,
    v_business.profession_key, v_business.profession_version,
    coalesce(p_details, '{}'::jsonb), p_due_at, p_assignee_id, nullif(btrim(p_notes), ''), auth.uid()
  );

  perform private.replace_order_items(p_business_id, p_id, p_items);
  perform private.recompute_order(p_id);
  perform private.log_order_event(p_business_id, p_id, 'created', null, p_status);

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : modification (version attendue, lignes figées après confirmation)
-- -----------------------------------------------------------------------------

create function public.update_order(
  p_order_id uuid,
  p_expected_version integer,
  p_customer_id uuid,
  p_due_at timestamptz,
  p_assignee_id uuid,
  p_notes text,
  p_details jsonb,
  p_production_step text default null,
  p_items jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_changed text[] := '{}';
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.has_business_role(
    v_order.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'La commande a été modifiée entre-temps.' using errcode = 'CB409';
  end if;
  if v_order.status in ('closed', 'cancelled') then
    perform private.raise_rule('Une commande clôturée ou annulée ne se modifie plus.');
  end if;

  if p_customer_id is distinct from v_order.customer_id then
    if v_order.status not in ('draft', 'pending_confirmation') then
      perform private.raise_rule('Le client ne change plus après confirmation.');
    end if;
    if not exists (
      select 1 from public.customers
      where business_id = v_order.business_id and id = p_customer_id and archived_at is null
    ) then
      perform private.raise_rule('Choisissez un client actif de votre entreprise.');
    end if;
    v_changed := array_append(v_changed, 'customer');
  end if;

  if p_items is not null then
    if v_order.status not in ('draft', 'pending_confirmation') then
      perform private.raise_rule('Les lignes sont figées après confirmation de la commande.');
    end if;
    perform private.replace_order_items(v_order.business_id, p_order_id, p_items);
    v_changed := array_append(v_changed, 'items');
  end if;

  perform private.check_assignee(v_order.business_id, p_assignee_id);
  if p_due_at is distinct from v_order.due_at then v_changed := array_append(v_changed, 'due_at'); end if;
  if p_assignee_id is distinct from v_order.assignee_id then v_changed := array_append(v_changed, 'assignee'); end if;
  if nullif(btrim(p_notes), '') is distinct from v_order.notes then v_changed := array_append(v_changed, 'notes'); end if;
  if coalesce(p_details, '{}'::jsonb) is distinct from v_order.details then v_changed := array_append(v_changed, 'details'); end if;
  if p_production_step is distinct from v_order.production_step then
    v_changed := array_append(v_changed, 'production_step');
  end if;

  if cardinality(v_changed) = 0 then
    return v_order;
  end if;

  update public.orders
  set customer_id = p_customer_id,
      due_at = p_due_at,
      assignee_id = p_assignee_id,
      notes = nullif(btrim(p_notes), ''),
      details = coalesce(p_details, '{}'::jsonb),
      production_step = p_production_step,
      version = version + 1
  where id = p_order_id;

  begin
    perform private.recompute_order(p_order_id);
  exception when check_violation then
    perform private.raise_rule('Le nouveau total est inférieur aux montants déjà encaissés.');
  end;

  perform private.log_order_event(v_order.business_id, p_order_id, 'updated', null, null,
    jsonb_build_object('changed', to_jsonb(v_changed)));

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : changement d'état validé par le serveur
-- -----------------------------------------------------------------------------

create function public.transition_order(
  p_order_id uuid,
  p_expected_version integer,
  p_to_status public.order_status,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_roles public.business_role[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.is_business_member(v_order.business_id) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'La commande a été modifiée entre-temps.' using errcode = 'CB409';
  end if;

  select roles into v_roles from public.order_status_transitions
  where from_status = v_order.status and to_status = p_to_status;
  if v_roles is null then
    perform private.raise_rule('Ce changement d''état n''est pas possible.');
  end if;
  if not private.has_business_role(v_order.business_id, v_roles) then
    raise exception 'action non autorisée pour votre rôle' using errcode = '42501';
  end if;

  if p_to_status = 'cancelled' and nullif(btrim(p_reason), '') is null then
    perform private.raise_rule('Indiquez le motif de l''annulation.');
  end if;
  if p_to_status = 'closed' and v_order.balance > 0 then
    perform private.raise_rule('Il reste un solde à encaisser : la commande ne peut pas être clôturée.');
  end if;

  update public.orders
  set status = p_to_status,
      version = version + 1,
      closed_at = case when p_to_status = 'closed' then now() end,
      cancelled_at = case when p_to_status = 'cancelled' then now() end,
      cancel_reason = case when p_to_status = 'cancelled' then btrim(p_reason) end
  where id = p_order_id;

  perform private.log_order_event(v_order.business_id, p_order_id, 'status_changed',
    v_order.status, p_to_status,
    case when nullif(btrim(p_reason), '') is not null
      then jsonb_build_object('reason', left(btrim(p_reason), 500)) else '{}'::jsonb end);
  if p_to_status = 'cancelled' then
    perform private.write_audit(v_order.business_id, 'order.cancelled', 'order', p_order_id::text);
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : encaissements manuels
-- -----------------------------------------------------------------------------

create function public.record_manual_payment(
  p_id uuid,
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_paid_on date,
  p_reference text default null,
  p_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.has_business_role(
    v_order.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  -- Double envoi : l'encaissement déjà enregistré est renvoyé tel quel.
  select * into v_payment from public.payments where id = p_id;
  if found then
    if v_payment.order_id <> p_order_id then
      raise exception 'identifiant déjà utilisé' using errcode = '42501';
    end if;
    return v_payment;
  end if;

  if v_order.status in ('closed', 'cancelled') then
    perform private.raise_rule('Aucun encaissement sur une commande clôturée ou annulée.');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    perform private.raise_rule('Montant invalide.');
  end if;
  if p_amount > v_order.balance then
    perform private.raise_rule(format(
      'Le montant dépasse le solde restant (%s FCFA).',
      to_char(v_order.balance, 'FM999G999G999G990')
    ));
  end if;
  if p_paid_on is null or p_paid_on > (
    select (now() at time zone b.timezone)::date from public.businesses b where b.id = v_order.business_id
  ) then
    perform private.raise_rule('La date d''encaissement ne peut pas être dans le futur.');
  end if;

  insert into public.payments (
    id, business_id, order_id, method, amount, paid_on, reference, note, recorded_by
  ) values (
    p_id, v_order.business_id, p_order_id, p_method, p_amount, p_paid_on,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), auth.uid()
  )
  returning * into v_payment;

  perform private.recompute_order(p_order_id);
  perform private.log_order_event(v_order.business_id, p_order_id, 'payment_recorded', null, null,
    jsonb_build_object('payment_id', p_id, 'amount', p_amount, 'method', p_method));

  return v_payment;
end;
$$;

-- Un encaissement n'est jamais supprimé : il est annulé, avec un motif.
create function public.cancel_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found or not private.has_business_role(
    v_payment.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;

  if v_payment.status <> 'manual_declared' then
    perform private.raise_rule('Seul un encaissement déclaré manuellement peut être annulé ici.');
  end if;
  if v_order.status = 'closed' then
    perform private.raise_rule('La commande est clôturée : ses encaissements ne changent plus.');
  end if;
  if nullif(btrim(p_reason), '') is null then
    perform private.raise_rule('Indiquez le motif de l''annulation.');
  end if;

  update public.payments
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      cancel_reason = left(btrim(p_reason), 500)
  where id = p_payment_id
  returning * into v_payment;

  perform private.recompute_order(v_payment.order_id);
  perform private.log_order_event(v_payment.business_id, v_payment.order_id, 'payment_cancelled', null, null,
    jsonb_build_object('payment_id', p_payment_id, 'amount', v_payment.amount));
  perform private.write_audit(v_payment.business_id, 'payment.cancelled', 'payment', p_payment_id::text,
    jsonb_build_object('amount', v_payment.amount));

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Liste filtrée et paginée (droits de l'appelant : RLS appliquée).
-- Filtres : active (en cours), late (en retard), to_collect (à encaisser),
-- draft (brouillons), done (livrées, clôturées, annulées), all.
-- -----------------------------------------------------------------------------

create function public.list_orders(
  p_business_id uuid,
  p_filter text default 'active',
  p_query text default null,
  p_customer_id uuid default null,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  code text,
  status public.order_status,
  customer_id uuid,
  customer_name text,
  due_at timestamptz,
  total numeric,
  paid_total numeric,
  balance numeric,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.code, o.status, o.customer_id, c.name, o.due_at, o.total, o.paid_total,
    o.balance, o.created_at
  from public.orders o
  join public.customers c on c.business_id = o.business_id and c.id = o.customer_id
  where o.business_id = p_business_id
    and (p_customer_id is null or o.customer_id = p_customer_id)
    and case coalesce(p_filter, 'active')
      when 'active' then o.status not in ('draft', 'delivered', 'closed', 'cancelled')
      when 'late' then o.due_at < now() and o.status not in ('draft', 'delivered', 'closed', 'cancelled')
      when 'to_collect' then o.balance > 0 and o.status not in ('draft', 'cancelled')
      when 'draft' then o.status = 'draft'
      when 'done' then o.status in ('delivered', 'closed', 'cancelled')
      else true
    end
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or strpos(lower(o.code), lower(btrim(p_query))) > 0
      or strpos(c.name_search, lower(btrim(p_query))) > 0
    )
    -- Pagination par clé : échéance croissante (en retard), sinon création
    -- décroissante.
    and (
      p_after_id is null
      or case when p_filter = 'late'
        then (o.due_at, o.id) > (p_after_at, p_after_id)
        else (o.created_at, o.id) < (p_after_at, p_after_id)
      end
    )
  order by
    case when p_filter = 'late' then o.due_at end asc,
    case when p_filter = 'late' then o.id end asc,
    case when p_filter is distinct from 'late' then o.created_at end desc,
    case when p_filter is distinct from 'late' then o.id end desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.create_order(uuid, uuid, uuid, jsonb, public.order_status, timestamptz, uuid, text, jsonb)
  from public, anon;
revoke all on function public.update_order(uuid, integer, uuid, timestamptz, uuid, text, jsonb, text, jsonb)
  from public, anon;
revoke all on function public.transition_order(uuid, integer, public.order_status, text) from public, anon;
revoke all on function public.record_manual_payment(uuid, uuid, public.payment_method, numeric, date, text, text)
  from public, anon;
revoke all on function public.cancel_payment(uuid, text) from public, anon;
revoke all on function public.list_orders(uuid, text, text, uuid, timestamptz, uuid, integer) from public, anon;

grant execute on function public.create_order(uuid, uuid, uuid, jsonb, public.order_status, timestamptz, uuid, text, jsonb)
  to authenticated;
grant execute on function public.update_order(uuid, integer, uuid, timestamptz, uuid, text, jsonb, text, jsonb)
  to authenticated;
grant execute on function public.transition_order(uuid, integer, public.order_status, text) to authenticated;
grant execute on function public.record_manual_payment(uuid, uuid, public.payment_method, numeric, date, text, text)
  to authenticated;
grant execute on function public.cancel_payment(uuid, text) to authenticated;
grant execute on function public.list_orders(uuid, text, text, uuid, timestamptz, uuid, integer) to authenticated;
