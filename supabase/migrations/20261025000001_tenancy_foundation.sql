-- =============================================================================
-- Phase 2 — Fondations multi-entreprises : profils, entreprises, membres, audit.
--
-- Principes :
--   * toute donnée commerciale porte un business_id ;
--   * l'autorisation repose sur business_members (jamais sur un business_id
--     fourni par le navigateur) ;
--   * RLS activée partout ; les écritures sensibles passent par des fonctions
--     SECURITY DEFINER qui vérifient elles-mêmes le rôle et journalisent ;
--   * les fonctions d'autorisation vivent dans le schéma `private`, non exposé
--     par l'API, et évitent la récursion entre politiques.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.business_role as enum ('owner', 'manager', 'staff', 'viewer');
create type public.member_status as enum ('active', 'revoked');
create type public.business_status as enum ('active', 'suspended', 'closed');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
    check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  profession_key text not null default 'generic',
  city text check (city is null or char_length(city) <= 80),
  whatsapp_phone_e164 text check (whatsapp_phone_e164 is null or whatsapp_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status public.business_status not null default 'active',
  timezone text not null default 'Africa/Douala',
  currency char(3) not null default 'XAF' check (currency = 'XAF'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_idx on public.businesses (owner_user_id);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.business_role not null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on public.business_members (user_id) where status = 'active';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index audit_logs_business_at_idx on public.audit_logs (business_id, at desc);

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger businesses_touch before update on public.businesses
  for each row execute function private.touch_updated_at();
create trigger business_members_touch before update on public.business_members
  for each row execute function private.touch_updated_at();

-- Profil créé automatiquement à l'inscription.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Journal d'audit (append-only, écrit uniquement par les fonctions serveur).
create function private.write_audit(
  p_business_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  values (p_business_id, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create function private.slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    btrim(
      regexp_replace(lower(extensions.unaccent(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'),
      '-'
    ),
    50
  );
$$;

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (SECURITY DEFINER : pas de récursion RLS)
-- -----------------------------------------------------------------------------

create function private.has_business_role(p_business_id uuid, p_roles public.business_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and b.status <> 'closed'
      and m.role = any (p_roles)
  );
$$;

create function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_business_role(
    p_business_id,
    array['owner', 'manager', 'staff', 'viewer']::public.business_role[]
  );
$$;

-- Deux utilisateurs partagent-ils une entreprise active ? (lecture des profils)
create function private.shares_business_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members mine
    join public.business_members theirs on theirs.business_id = mine.business_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user_id
      and theirs.status = 'active'
  );
$$;

revoke all on function private.has_business_role(uuid, public.business_role[]) from public, anon;
revoke all on function private.is_business_member(uuid) from public, anon;
revoke all on function private.shares_business_with(uuid) from public, anon;
revoke all on function private.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.slugify(text) from public, anon, authenticated;
grant execute on function private.has_business_role(uuid, public.business_role[]) to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.shares_business_with(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges : rien pour anon ; colonnes modifiables explicites.
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.businesses, public.business_members, public.audit_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.businesses to authenticated;
grant update (name, city, whatsapp_phone_e164, timezone) on public.businesses to authenticated;

grant select on public.business_members to authenticated;
grant select on public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_business_with(user_id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy businesses_select_members on public.businesses
  for select to authenticated
  using (private.is_business_member(id));

create policy businesses_update_owner on public.businesses
  for update to authenticated
  using (private.has_business_role(id, array['owner']::public.business_role[]))
  with check (private.has_business_role(id, array['owner']::public.business_role[]));

create policy business_members_select on public.business_members
  for select to authenticated
  using (private.is_business_member(business_id));

create policy audit_logs_select_managers on public.audit_logs
  for select to authenticated
  using (private.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));

-- Aucune politique INSERT/DELETE : les écritures passent par les fonctions ci-dessous.

-- Journalise les modifications de paramètres de l'entreprise.
create function private.audit_business_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit(
    new.id, 'business.updated', 'business', new.id::text,
    jsonb_build_object(
      'changed', (
        select coalesce(jsonb_agg(key), '[]'::jsonb)
        from jsonb_each(to_jsonb(new)) n
        where n.key not in ('updated_at')
          and n.value is distinct from (to_jsonb(old) -> n.key)
      )
    )
  );
  return new;
end;
$$;

create trigger businesses_audit_update after update on public.businesses
  for each row execute function private.audit_business_update();

revoke all on function private.audit_business_update() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- API métier (RPC) — vérifient le rôle côté base, quelle que soit l'origine.
-- -----------------------------------------------------------------------------

-- Crée une entreprise et rend l'appelant propriétaire, de façon atomique.
create function public.create_business(
  p_name text,
  p_profession_key text default 'generic',
  p_city text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_base text;
  v_slug text;
  v_business public.businesses;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'nom d''entreprise invalide' using errcode = '22023';
  end if;

  -- Garde-fou anti-abus : nombre d'entreprises créées par utilisateur.
  if (select count(*) from public.businesses where owner_user_id = v_user) >= 10 then
    raise exception 'limite d''entreprises atteinte' using errcode = '54000';
  end if;

  v_base := private.slugify(p_name);
  if char_length(v_base) < 2 then
    v_base := 'entreprise';
  end if;
  v_slug := v_base;

  while exists (select 1 from public.businesses where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;

  insert into public.businesses (owner_user_id, name, slug, profession_key, city)
  values (
    v_user,
    btrim(p_name),
    v_slug,
    coalesce(nullif(btrim(p_profession_key), ''), 'generic'),
    nullif(btrim(coalesce(p_city, '')), '')
  )
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business.id, v_user, 'owner');

  perform private.write_audit(v_business.id, 'business.created', 'business', v_business.id::text);

  return v_business;
end;
$$;

-- Change le rôle d'un membre (propriétaire uniquement).
create function public.set_member_role(
  p_business_id uuid,
  p_user_id uuid,
  p_role public.business_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.business_role;
begin
  if not private.has_business_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;

  select role into v_old
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id and status = 'active'
  for update;

  if v_old is null then
    raise exception 'membre introuvable' using errcode = 'P0002';
  end if;

  if v_old = 'owner' and p_role <> 'owner' and (
    select count(*) from public.business_members
    where business_id = p_business_id and role = 'owner' and status = 'active'
  ) <= 1 then
    raise exception 'l''entreprise doit garder au moins un propriétaire' using errcode = '23514';
  end if;

  update public.business_members
  set role = p_role
  where business_id = p_business_id and user_id = p_user_id;

  perform private.write_audit(
    p_business_id, 'member.role_changed', 'business_member', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role)
  );
end;
$$;

-- Révoque l'accès d'un membre (propriétaire uniquement).
create function public.revoke_member(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.business_role;
begin
  if not private.has_business_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;

  select role into v_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id and status = 'active'
  for update;

  if v_role is null then
    raise exception 'membre introuvable' using errcode = 'P0002';
  end if;

  if v_role = 'owner' and (
    select count(*) from public.business_members
    where business_id = p_business_id and role = 'owner' and status = 'active'
  ) <= 1 then
    raise exception 'l''entreprise doit garder au moins un propriétaire' using errcode = '23514';
  end if;

  update public.business_members
  set status = 'revoked'
  where business_id = p_business_id and user_id = p_user_id;

  perform private.write_audit(p_business_id, 'member.revoked', 'business_member', p_user_id::text);
end;
$$;

revoke all on function public.create_business(text, text, text) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, public.business_role) from public, anon;
revoke all on function public.revoke_member(uuid, uuid) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.business_role) to authenticated;
grant execute on function public.revoke_member(uuid, uuid) to authenticated;
