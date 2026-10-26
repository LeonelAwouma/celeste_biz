-- =============================================================================
-- Phase 4 — Clients (CRM) et catalogue, images privées.
-- Écritures directes autorisées par RLS + privilèges par colonne ; règles
-- métier sensibles (archivage, consentement, audit) dans des triggers.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create type public.catalog_item_kind as enum ('service', 'product');
create type public.price_mode as enum ('fixed', 'from', 'quote');
create type public.catalog_visibility as enum ('public', 'private');

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  name_search text generated always as (lower(name)) stored,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  -- Notes internes : jamais exposées au client final.
  notes text check (notes is null or char_length(notes) <= 2000),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permet des clés étrangères composites (même entreprise garantie).
  unique (business_id, id)
);

create index customers_business_name_idx on public.customers (business_id, name_search, id);
create index customers_business_phone_idx on public.customers (business_id, phone_e164) where phone_e164 is not null;
create index customers_name_trgm_idx on public.customers using gin (name_search extensions.gin_trgm_ops);

create trigger customers_touch before update on public.customers
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.catalog_item_kind not null default 'service',
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  category text check (category is null or char_length(category) between 1 and 60),
  price_mode public.price_mode not null default 'fixed',
  -- Montant en XAF ; jamais de flottant.
  price numeric(18, 2) check (price is null or price >= 0),
  unit text check (unit is null or char_length(unit) <= 30),
  visibility public.catalog_visibility not null default 'public',
  position integer not null default 0 check (position between 0 and 100000),
  image_path text check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  -- Prix obligatoire sauf « sur devis ».
  check ((price_mode = 'quote' and price is null) or (price_mode <> 'quote' and price is not null)),
  -- Une image appartient au dossier de l'entreprise.
  check (image_path is null or split_part(image_path, '/', 1) = business_id::text)
);

create index catalog_items_business_idx on public.catalog_items (business_id, archived_at, category, position, name);

create trigger catalog_items_touch before update on public.catalog_items
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Règles métier (triggers)
-- -----------------------------------------------------------------------------

create function private.customers_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.business_id is distinct from old.business_id then
      raise exception 'changement d''entreprise interdit' using errcode = '42501';
    end if;
    -- Archiver / restaurer : propriétaire ou gestionnaire.
    if new.archived_at is distinct from old.archived_at
      and auth.uid() is not null
      and not private.has_business_role(new.business_id, array['owner', 'manager']::public.business_role[]) then
      raise exception 'archivage réservé au propriétaire ou au gestionnaire' using errcode = '42501';
    end if;
  end if;

  -- Preuve du consentement marketing (horodatage serveur).
  if tg_op = 'INSERT' or new.marketing_consent is distinct from old.marketing_consent then
    new.marketing_consent_at := case when new.marketing_consent then now() end;
  end if;

  return new;
end;
$$;

create trigger customers_rules before insert or update on public.customers
  for each row execute function private.customers_rules();

create function private.catalog_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'changement d''entreprise interdit' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger catalog_rules before update on public.catalog_items
  for each row execute function private.catalog_rules();

-- Audit : action et champs modifiés, jamais leur contenu (données personnelles).
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_action text;
  v_changed jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := v_entity || '.created';
  else
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at', 'name_search', 'marketing_consent_at')
      and n.value is distinct from (to_jsonb(old) -> n.key);

    if v_changed = '[]'::jsonb then
      return new;
    end if;

    v_action := case
      when new.archived_at is not null and old.archived_at is null then v_entity || '.archived'
      when new.archived_at is null and old.archived_at is not null then v_entity || '.restored'
      else v_entity || '.updated'
    end;
  end if;

  perform private.write_audit(new.business_id, v_action, v_entity, new.id::text,
    jsonb_build_object('changed', v_changed));
  return new;
end;
$$;

create trigger customers_audit after insert or update on public.customers
  for each row execute function private.audit_row_change('customer');
create trigger catalog_items_audit after insert or update on public.catalog_items
  for each row execute function private.audit_row_change('catalog_item');

revoke all on function private.customers_rules() from public, anon, authenticated;
revoke all on function private.catalog_rules() from public, anon, authenticated;
revoke all on function private.audit_row_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------

revoke all on public.customers, public.catalog_items from anon, authenticated;

grant select on public.customers to authenticated;
grant insert (id, business_id, name, phone_e164, email, notes, marketing_consent)
  on public.customers to authenticated;
grant update (name, phone_e164, email, notes, marketing_consent, archived_at)
  on public.customers to authenticated;

grant select on public.catalog_items to authenticated;
grant insert (id, business_id, kind, name, description, category, price_mode, price, unit, visibility, position, image_path)
  on public.catalog_items to authenticated;
grant update (kind, name, description, category, price_mode, price, unit, visibility, position, image_path, archived_at)
  on public.catalog_items to authenticated;

alter table public.customers enable row level security;
alter table public.catalog_items enable row level security;

create policy customers_select on public.customers
  for select to authenticated
  using (private.is_business_member(business_id));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (private.has_business_role(business_id, array['owner', 'manager', 'staff']::public.business_role[]));

create policy customers_update on public.customers
  for update to authenticated
  using (private.has_business_role(business_id, array['owner', 'manager', 'staff']::public.business_role[]))
  with check (private.has_business_role(business_id, array['owner', 'manager', 'staff']::public.business_role[]));

create policy catalog_items_select on public.catalog_items
  for select to authenticated
  using (private.is_business_member(business_id));

create policy catalog_items_insert on public.catalog_items
  for insert to authenticated
  with check (private.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));

create policy catalog_items_update on public.catalog_items
  for update to authenticated
  using (private.has_business_role(business_id, array['owner', 'manager']::public.business_role[]))
  with check (private.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));

-- -----------------------------------------------------------------------------
-- Recherche paginée des clients (droits de l'appelant : RLS appliquée).
-- -----------------------------------------------------------------------------

create function public.search_customers(
  p_business_id uuid,
  p_query text default null,
  p_archived boolean default false,
  p_after_name text default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns setof public.customers
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from public.customers c
  where c.business_id = p_business_id
    and (c.archived_at is not null) = p_archived
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      -- strpos : pas de caractères spéciaux (% _) interprétés.
      or strpos(c.name_search, lower(btrim(p_query))) > 0
      or (
        char_length(regexp_replace(p_query, '\D', '', 'g')) >= 3
        and strpos(c.phone_e164, regexp_replace(p_query, '\D', '', 'g')) > 0
      )
    )
    and (
      p_after_name is null
      or (c.name_search, c.id) > (p_after_name, p_after_id)
    )
  order by c.name_search, c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.search_customers(uuid, text, boolean, text, uuid, integer) from public, anon;
grant execute on function public.search_customers(uuid, text, boolean, text, uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Images du catalogue : stockage privé, un dossier par entreprise.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function private.folder_business_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.folder_business_id(text) to authenticated;

create policy catalog_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'catalog-images'
    and private.is_business_member(private.folder_business_id(name))
  );

create policy catalog_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catalog-images'
    and private.has_business_role(private.folder_business_id(name), array['owner', 'manager']::public.business_role[])
  );

create policy catalog_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'catalog-images'
    and private.has_business_role(private.folder_business_id(name), array['owner', 'manager']::public.business_role[])
  );
