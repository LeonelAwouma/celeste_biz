-- =============================================================================
-- Phase 3 — Profils métiers, réglages d'entreprise et invitations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registre versionné des profils métiers (miroir de features/professions).
-- Une version publiée est immuable : toute évolution = nouvelle version.
-- -----------------------------------------------------------------------------

create table public.profession_templates (
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  version integer not null check (version > 0),
  label text not null,
  schema jsonb not null check (jsonb_typeof(schema) = 'object'),
  created_at timestamptz not null default now(),
  primary key (key, version)
);

create function private.forbid_template_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'une version de profil métier est immuable : créez une nouvelle version'
    using errcode = '42501';
end;
$$;

create trigger profession_templates_immutable
  before update or delete on public.profession_templates
  for each row execute function private.forbid_template_change();

revoke all on function private.forbid_template_change() from public, anon, authenticated;

insert into public.profession_templates (key, version, label, schema) values
  ('couture', 1, 'Couture et confection', '{"key":"couture","version":1,"label":"Couture et confection","description":"Commandes sur mesure, prise de mesures, essayages, acomptes et dates de livraison.","labels":{"catalog":"Modèles et prestations","catalogItem":"Prestation","order":"Commande sur mesure","orders":"Commandes"},"defaultModules":["quotes","measurements","website"],"availableModules":["quotes","measurements","website"],"orderFields":[{"key":"garment_type","label":"Type de vêtement","required":true,"private":false,"type":"select","options":[{"value":"robe","label":"Robe"},{"value":"ensemble","label":"Ensemble / tailleur"},{"value":"costume","label":"Costume"},{"value":"chemise","label":"Chemise"},{"value":"pantalon","label":"Pantalon / jupe"},{"value":"tenue_traditionnelle","label":"Tenue traditionnelle"},{"value":"retouche","label":"Retouche"},{"value":"autre","label":"Autre"}]},{"key":"fabric_source","label":"Tissu fourni par","required":false,"private":false,"type":"select","options":[{"value":"client","label":"Le client"},{"value":"atelier","label":"L''atelier"}]},{"key":"fitting_date","label":"Date d''essayage","required":false,"private":false,"type":"date"},{"key":"measurements","label":"Mesures","help":"Facultatif. Visibles uniquement par l''équipe.","required":false,"private":true,"type":"measurements","unit":"cm","points":[{"key":"tour_cou","label":"Tour de cou"},{"key":"carrure","label":"Carrure (épaules)"},{"key":"tour_poitrine","label":"Tour de poitrine"},{"key":"tour_taille","label":"Tour de taille"},{"key":"tour_hanches","label":"Tour de hanches"},{"key":"longueur_manche","label":"Longueur de manche"},{"key":"tour_bras","label":"Tour de bras"},{"key":"longueur_buste","label":"Longueur du buste"},{"key":"longueur_totale","label":"Longueur totale"},{"key":"longueur_pantalon","label":"Longueur de pantalon"}]},{"key":"style_notes","label":"Modèle et finitions","help":"Description du modèle, référence photo, détails demandés.","required":false,"private":false,"type":"textarea","maxLength":2000}],"stateLabels":{"in_progress":"En confection","ready":"Prête à retirer"},"productionSteps":[{"key":"coupe","label":"Coupe"},{"key":"assemblage","label":"Assemblage"},{"key":"essayage","label":"Essayage"},{"key":"finitions","label":"Finitions"}]}'::jsonb),
  ('catering', 1, 'Pâtisserie et traiteur', '{"key":"catering","version":1,"label":"Pâtisserie et traiteur","description":"Commandes pour événements : date et lieu, nombre de portions, livraison, acomptes.","labels":{"catalog":"Menus et produits","catalogItem":"Produit","order":"Commande d''événement","orders":"Commandes"},"defaultModules":["quotes","events","website"],"availableModules":["quotes","events","website"],"orderFields":[{"key":"event_date","label":"Date et heure de l''événement","required":true,"private":false,"type":"datetime"},{"key":"event_type","label":"Type d''événement","required":false,"private":false,"type":"select","options":[{"value":"anniversaire","label":"Anniversaire"},{"value":"mariage","label":"Mariage / dot"},{"value":"bapteme","label":"Baptême / communion"},{"value":"entreprise","label":"Événement d''entreprise"},{"value":"deuil","label":"Deuil / funérailles"},{"value":"autre","label":"Autre"}]},{"key":"portions","label":"Nombre de portions ou d''invités","required":false,"private":false,"type":"number","min":1,"max":100000,"integer":true},{"key":"delivery_mode","label":"Mode de remise","required":true,"private":false,"type":"select","options":[{"value":"retrait","label":"Retrait sur place"},{"value":"livraison","label":"Livraison"},{"value":"service","label":"Service sur place"}]},{"key":"event_location","label":"Lieu de livraison ou de l''événement","required":false,"private":false,"type":"text","maxLength":200},{"key":"dietary_notes","label":"Allergies et préférences","required":false,"private":false,"type":"textarea","maxLength":2000}],"stateLabels":{"in_progress":"En préparation","ready":"Prête"},"productionSteps":[{"key":"courses","label":"Achats"},{"key":"preparation","label":"Préparation"},{"key":"cuisson","label":"Cuisson"},{"key":"emballage","label":"Emballage"}]}'::jsonb),
  ('generic', 1, 'Autre activité', '{"key":"generic","version":1,"label":"Autre activité","description":"Services ou produits : demandes, devis, commandes, encaissements et suivi.","labels":{"catalog":"Catalogue","catalogItem":"Article","order":"Commande","orders":"Commandes"},"defaultModules":["quotes","website"],"availableModules":["quotes","website"],"orderFields":[{"key":"details","label":"Détails de la demande","required":false,"private":false,"type":"textarea","maxLength":2000}],"stateLabels":{},"productionSteps":[]}'::jsonb);

revoke all on public.profession_templates from anon, authenticated;
grant select on public.profession_templates to authenticated;
alter table public.profession_templates enable row level security;
create policy profession_templates_read on public.profession_templates
  for select to authenticated using (true);

-- Rattachement des entreprises à une version précise.
alter table public.businesses
  add column profession_version integer not null default 1;
alter table public.businesses
  alter column profession_key drop default;
alter table public.businesses
  add constraint businesses_profession_fk
  foreign key (profession_key, profession_version)
  references public.profession_templates (key, version);

create function private.latest_profession_version(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(version) from public.profession_templates where key = p_key;
$$;

revoke all on function private.latest_profession_version(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Réglages d'entreprise (modules, image de marque, profil fiscal privé).
-- -----------------------------------------------------------------------------

create function private.valid_module_overrides(p_modules jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_modules) = 'object'
    and not exists (
      select 1 from jsonb_each(p_modules) m
      where m.key not in ('quotes', 'website', 'measurements', 'events')
         or jsonb_typeof(m.value) <> 'boolean'
    );
$$;

create table public.business_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  modules jsonb not null default '{}'::jsonb
    check (private.valid_module_overrides(modules)),
  branding jsonb not null default '{}'::jsonb check (jsonb_typeof(branding) = 'object'),
  fiscal_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(fiscal_profile) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_settings_touch before update on public.business_settings
  for each row execute function private.touch_updated_at();

insert into public.business_settings (business_id)
select id from public.businesses;

revoke all on public.business_settings from anon, authenticated;
grant select on public.business_settings to authenticated;
grant update (modules, branding) on public.business_settings to authenticated;

alter table public.business_settings enable row level security;

create policy business_settings_select on public.business_settings
  for select to authenticated
  using (private.is_business_member(business_id));

create policy business_settings_update_owner on public.business_settings
  for update to authenticated
  using (private.has_business_role(business_id, array['owner']::public.business_role[]))
  with check (private.has_business_role(business_id, array['owner']::public.business_role[]));

create function private.audit_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.modules is distinct from old.modules then
    perform private.write_audit(
      new.business_id, 'business.modules_changed', 'business_settings', new.business_id::text,
      jsonb_build_object('from', old.modules, 'to', new.modules)
    );
  end if;
  return new;
end;
$$;

create trigger business_settings_audit after update on public.business_settings
  for each row execute function private.audit_settings_update();

revoke all on function private.audit_settings_update() from public, anon, authenticated;
revoke all on function private.valid_module_overrides(jsonb) from public, anon;
-- Appelée par la contrainte CHECK avec les droits de l'utilisateur.
grant execute on function private.valid_module_overrides(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Création d'entreprise : métier validé, réglages initialisés.
-- -----------------------------------------------------------------------------

drop function public.create_business(text, text, text);

create function public.create_business(
  p_name text,
  p_profession_key text,
  p_city text default null,
  p_whatsapp_phone_e164 text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_version integer;
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

  v_version := private.latest_profession_version(p_profession_key);
  if v_version is null then
    raise exception 'métier inconnu' using errcode = '22023';
  end if;

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

  insert into public.businesses (
    owner_user_id, name, slug, profession_key, profession_version, city, whatsapp_phone_e164
  )
  values (
    v_user,
    btrim(p_name),
    v_slug,
    p_profession_key,
    v_version,
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_whatsapp_phone_e164, '')), '')
  )
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business.id, v_user, 'owner');

  insert into public.business_settings (business_id) values (v_business.id);

  perform private.write_audit(
    v_business.id, 'business.created', 'business', v_business.id::text,
    jsonb_build_object('profession', p_profession_key, 'version', v_version)
  );

  return v_business;
end;
$$;

-- Changement de métier (propriétaire) : passe à la dernière version du profil.
create function public.set_business_profession(p_business_id uuid, p_profession_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if not private.has_business_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;

  v_version := private.latest_profession_version(p_profession_key);
  if v_version is null then
    raise exception 'métier inconnu' using errcode = '22023';
  end if;

  update public.businesses
  set profession_key = p_profession_key, profession_version = v_version
  where id = p_business_id;
end;
$$;

revoke all on function public.create_business(text, text, text, text) from public, anon;
revoke all on function public.set_business_profession(uuid, text) from public, anon;
grant execute on function public.create_business(text, text, text, text) to authenticated;
grant execute on function public.set_business_profession(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Membres : liste lisible par l'équipe (adresses e-mail : propriétaire seul).
-- -----------------------------------------------------------------------------

create function public.list_business_members(p_business_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role public.business_role,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    coalesce(nullif(p.display_name, ''), 'Membre'),
    case
      when private.has_business_role(p_business_id, array['owner']::public.business_role[])
        or m.user_id = (select auth.uid())
      then u.email::text
    end,
    m.role,
    m.created_at
  from public.business_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.business_id = p_business_id
    and m.status = 'active'
    and private.is_business_member(p_business_id)
  order by m.created_at;
$$;

revoke all on function public.list_business_members(uuid) from public, anon;
grant execute on function public.list_business_members(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Invitations : lien à usage unique, jeton haché en base, expiration 7 jours.
-- -----------------------------------------------------------------------------

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.business_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

create index business_invitations_business_idx on public.business_invitations (business_id, created_at desc);

revoke all on public.business_invitations from anon, authenticated;
grant select (id, business_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at)
  on public.business_invitations to authenticated;

alter table public.business_invitations enable row level security;

create policy business_invitations_select_owner on public.business_invitations
  for select to authenticated
  using (private.has_business_role(business_id, array['owner']::public.business_role[]));

create function private.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function private.hash_token(text) from public, anon, authenticated;

-- Crée une invitation et renvoie le jeton en clair (seule fois où il existe).
create function public.create_invitation(
  p_business_id uuid,
  p_email text,
  p_role public.business_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
begin
  if not private.has_business_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'le rôle propriétaire ne peut pas être attribué par invitation' using errcode = '22023';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'adresse e-mail invalide' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.business_members m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'cette personne est déjà membre' using errcode = '23505';
  end if;

  if (
    select count(*) from public.business_invitations
    where business_id = p_business_id and accepted_at is null and revoked_at is null and expires_at > now()
  ) >= 50 then
    raise exception 'trop d''invitations en attente' using errcode = '54000';
  end if;

  -- Une seule invitation valide par adresse : les précédentes sont annulées.
  update public.business_invitations
  set revoked_at = now()
  where business_id = p_business_id and email = v_email
    and accepted_at is null and revoked_at is null;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.business_invitations (business_id, email, role, token_hash, invited_by)
  values (p_business_id, v_email, p_role, private.hash_token(v_token), auth.uid())
  returning id into v_id;

  perform private.write_audit(
    p_business_id, 'member.invited', 'business_invitation', v_id::text,
    jsonb_build_object('role', p_role)
  );

  return v_token;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  select business_id into v_business
  from public.business_invitations where id = p_invitation_id;

  if v_business is null
    or not private.has_business_role(v_business, array['owner']::public.business_role[]) then
    raise exception 'action réservée au propriétaire' using errcode = '42501';
  end if;

  update public.business_invitations
  set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;

  perform private.write_audit(v_business, 'member.invitation_revoked', 'business_invitation', p_invitation_id::text);
end;
$$;

-- Aperçu d'une invitation pour l'utilisateur connecté qui détient le lien.
create function public.get_invitation(p_token text)
returns table (
  business_name text,
  role public.business_role,
  email text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.name,
    i.role,
    i.email,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      when b.status <> 'active' then 'revoked'
      else 'valid'
    end
  from public.business_invitations i
  join public.businesses b on b.id = i.business_id
  where (select auth.uid()) is not null
    and i.token_hash = private.hash_token(coalesce(p_token, ''));
$$;

-- Accepte l'invitation : réservé au compte dont l'adresse a été invitée.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.business_invitations;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.business_invitations
  where token_hash = private.hash_token(coalesce(p_token, ''))
  for update;

  if v_invitation.id is null
    or v_invitation.accepted_at is not null
    or v_invitation.revoked_at is not null
    or v_invitation.expires_at <= now()
    or not exists (
      select 1 from public.businesses where id = v_invitation.business_id and status = 'active'
    ) then
    raise exception 'invitation invalide ou expirée' using errcode = 'P0002';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;
  if v_email is distinct from v_invitation.email then
    raise exception 'invitation destinée à une autre adresse e-mail' using errcode = '42501';
  end if;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_invitation.business_id, v_user, v_invitation.role, 'active')
  on conflict (business_id, user_id) do update
    set role = excluded.role, status = 'active'
    where public.business_members.status = 'revoked';

  update public.business_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_invitation.id;

  perform private.write_audit(
    v_invitation.business_id, 'member.joined', 'business_member', v_user::text,
    jsonb_build_object('role', v_invitation.role, 'invitation', v_invitation.id)
  );

  return v_invitation.business_id;
end;
$$;

revoke all on function public.create_invitation(uuid, text, public.business_role) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.get_invitation(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.business_role) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
