-- =============================================================================
-- Phase 9 — Site web métier facultatif.
-- Un site par entreprise : brouillon modifiable (textes versionnés, médias),
-- publication explicite qui fige un instantané (adresse, modèle, textes,
-- prestations du catalogue, coordonnées). La route publique ne lit que cet
-- instantané : aucune modification du brouillon, du catalogue ou de la fiche
-- entreprise n'est visible avant une nouvelle publication.
-- =============================================================================

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  template_key text not null check (template_key in ('couture', 'catering', 'generic')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 16000),
  media jsonb not null default '{}'::jsonb
    check (jsonb_typeof(media) = 'object' and octet_length(media::text) <= 4000),
  version integer not null default 1 check (version > 0),
  -- Instantané publié (null = jamais publié ou dépublié).
  published jsonb,
  published_slug text unique,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  unpublished_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((published is null) = (published_slug is null))
);

create trigger websites_touch before update on public.websites
  for each row execute function private.touch_updated_at();

revoke all on public.websites from anon, authenticated;
grant select on public.websites to authenticated;

alter table public.websites enable row level security;

create policy websites_select on public.websites
  for select to authenticated using (private.is_business_member(business_id));

-- Adresses réservées (routes, marques, termes trompeurs).
create function private.reserved_site_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'aide', 'auth', 'celeste', 'celestebiz', 'celeste-biz', 'compte',
    'dashboard', 'help', 'login', 'officiel', 'paiement', 'sites', 'suivi', 'support', 'www'
  ]);
$$;

-- Module « site » actif pour l'entreprise (réglage, sinon défaut du métier).
create function private.website_enabled(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (t.schema -> 'availableModules') ? 'website'
      and coalesce((s.modules ->> 'website')::boolean, (t.schema -> 'defaultModules') ? 'website'),
    false
  )
  from public.businesses b
  join public.profession_templates t on t.key = b.profession_key and t.version = b.profession_version
  left join public.business_settings s on s.business_id = b.id
  where b.id = p_business_id;
$$;

create function private.valid_site_image(p_business_id uuid, p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
    and split_part(p_path, '/', 1) = p_business_id::text;
$$;

create function private.check_site_slug(p_website_id uuid, p_slug text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 3 and 60 then
    perform private.raise_rule('Adresse invalide : 3 à 60 caractères, lettres minuscules, chiffres et tirets.');
  end if;
  if private.reserved_site_slug(p_slug) then
    perform private.raise_rule('Cette adresse est réservée. Choisissez-en une autre.');
  end if;
  if exists (
    select 1 from public.websites
    where id is distinct from p_website_id and (slug = p_slug or published_slug = p_slug)
  ) then
    perform private.raise_rule('Cette adresse est déjà prise. Choisissez-en une autre.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Côté commerçant (propriétaire ou gestionnaire)
-- -----------------------------------------------------------------------------

create function public.create_website(p_business_id uuid, p_template_key text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_template text;
  v_slug text;
  v_id uuid;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if not private.website_enabled(p_business_id) then
    perform private.raise_rule('Activez le module « Mon site » dans les paramètres.');
  end if;
  select id into v_id from public.websites where business_id = p_business_id;
  if found then
    return v_id;
  end if;

  select * into v_business from public.businesses where id = p_business_id;
  v_template := coalesce(p_template_key, v_business.profession_key);
  if v_template not in ('couture', 'catering', 'generic') then
    v_template := 'generic';
  end if;

  v_slug := left(v_business.slug, 53);
  if char_length(v_slug) < 3 then
    v_slug := v_slug || '-site';
  end if;
  while private.reserved_site_slug(v_slug)
    or exists (select 1 from public.websites where slug = v_slug or published_slug = v_slug) loop
    v_slug := left(v_business.slug, 53) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;

  insert into public.websites (business_id, slug, template_key, content)
  values (p_business_id, v_slug, v_template, jsonb_build_object('show_prices', true))
  returning id into v_id;

  perform private.write_audit(p_business_id, 'website.created', 'website', v_id::text,
    jsonb_build_object('template', v_template));
  return v_id;
end;
$$;

-- Textes, modèle et adresse du brouillon (verrou optimiste sur la version).
create function public.save_website(
  p_business_id uuid,
  p_version integer,
  p_template_key text,
  p_slug text,
  p_content jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.websites;
  v_ids jsonb;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  select * into v_site from public.websites where business_id = p_business_id for update;
  if not found then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_site.version <> p_version then
    raise exception 'Le site a été modifié entre-temps.' using errcode = 'CB409';
  end if;
  if p_template_key is null or p_template_key not in ('couture', 'catering', 'generic') then
    perform private.raise_rule('Modèle inconnu.');
  end if;
  perform private.check_site_slug(v_site.id, p_slug);
  if p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 16000 then
    perform private.raise_rule('Contenu du site invalide ou trop long.');
  end if;

  -- Seules des prestations publiques et actives de l'entreprise sont admises.
  v_ids := coalesce(p_content -> 'service_ids', '[]'::jsonb);
  if jsonb_typeof(v_ids) <> 'array' or jsonb_array_length(v_ids) > 24 then
    perform private.raise_rule('24 prestations au maximum sur le site.');
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_ids) e(value)
    where e.value !~ '^[0-9a-f-]{36}$'
       or not exists (
         select 1 from public.catalog_items c
         where c.id = e.value::uuid and c.business_id = p_business_id
           and c.visibility = 'public' and c.archived_at is null
       )
  ) then
    perform private.raise_rule('Une prestation choisie n''est plus disponible ou n''est pas publique.');
  end if;

  update public.websites
  set template_key = p_template_key, slug = p_slug, content = p_content, version = version + 1
  where id = v_site.id;
  return v_site.version + 1;
end;
$$;

-- Médias du brouillon (logo, bannière, galerie de 8 photos au plus).
create function public.set_website_media(
  p_business_id uuid,
  p_logo text,
  p_banner text,
  p_gallery text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gallery text[] := coalesce(p_gallery, array[]::text[]);
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if cardinality(v_gallery) > 8 then
    perform private.raise_rule('8 photos au maximum dans la galerie.');
  end if;
  if (p_logo is not null and not private.valid_site_image(p_business_id, p_logo))
    or (p_banner is not null and not private.valid_site_image(p_business_id, p_banner))
    or exists (select 1 from unnest(v_gallery) g(path) where not private.valid_site_image(p_business_id, g.path)) then
    raise exception 'image invalide' using errcode = '42501';
  end if;

  update public.websites
  set media = jsonb_strip_nulls(jsonb_build_object('logo', p_logo, 'banner', p_banner))
    || jsonb_build_object('gallery', to_jsonb(v_gallery))
  where business_id = p_business_id;
  if not found then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
end;
$$;

-- Publication explicite : fige l'instantané de la version prévisualisée.
create function public.publish_website(p_business_id uuid, p_version integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.websites;
  v_business public.businesses;
  v_ids text[];
  v_show_prices boolean;
  v_services jsonb;
  v_assets text[];
  v_snapshot jsonb;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  select * into v_site from public.websites where business_id = p_business_id for update;
  if not found then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_site.version <> p_version then
    raise exception 'Le site a été modifié entre-temps : prévisualisez la dernière version.' using errcode = 'CB409';
  end if;
  if not private.website_enabled(p_business_id) then
    perform private.raise_rule('Activez le module « Mon site » dans les paramètres.');
  end if;
  perform private.check_site_slug(v_site.id, v_site.slug);
  select * into v_business from public.businesses where id = p_business_id;
  if v_business.status <> 'active' then
    perform private.raise_rule('Entreprise inactive : publication impossible.');
  end if;

  v_ids := array(select jsonb_array_elements_text(coalesce(v_site.content -> 'service_ids', '[]'::jsonb)));
  v_show_prices := coalesce((v_site.content ->> 'show_prices')::boolean, true);

  -- Prestations copiées telles qu'au moment de la publication (prix compris).
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.name, 'description', c.description, 'category', c.category,
      'price_mode', c.price_mode,
      'price', case when v_show_prices then c.price end,
      'unit', c.unit, 'image', c.image_path
    ) order by array_position(v_ids, c.id::text)), '[]'::jsonb)
  into v_services
  from public.catalog_items c
  where c.business_id = p_business_id and c.id::text = any (v_ids)
    and c.visibility = 'public' and c.archived_at is null;

  v_assets := array(
    select 'site-images:' || p from (
      select v_site.media ->> 'logo' as p
      union all select v_site.media ->> 'banner'
      union all select jsonb_array_elements_text(coalesce(v_site.media -> 'gallery', '[]'::jsonb))
    ) m where p is not null
    union all
    select 'catalog-images:' || (s ->> 'image') from jsonb_array_elements(v_services) s
    where s ->> 'image' is not null
  );

  v_snapshot := jsonb_build_object(
    'template_key', v_site.template_key,
    'business', jsonb_build_object('name', v_business.name, 'city', v_business.city,
      'whatsapp', v_business.whatsapp_phone_e164),
    'content', v_site.content - 'service_ids',
    'media', v_site.media,
    'services', v_services,
    'assets', to_jsonb(v_assets),
    'version', v_site.version,
    'published_at', now()
  );

  update public.websites
  set published = v_snapshot, published_slug = v_site.slug, published_at = now(),
      published_by = auth.uid(), unpublished_at = null
  where id = v_site.id;

  perform private.write_audit(p_business_id, 'website.published', 'website', v_site.id::text,
    jsonb_build_object('slug', v_site.slug, 'version', v_site.version,
      'previous_slug', v_site.published_slug));
  return v_site.slug;
end;
$$;

create function public.unpublish_website(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.websites;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  select * into v_site from public.websites where business_id = p_business_id for update;
  if not found then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  update public.websites
  set published = null, published_slug = null, unpublished_at = now()
  where id = v_site.id;
  perform private.write_audit(p_business_id, 'website.unpublished', 'website', v_site.id::text,
    jsonb_build_object('slug', v_site.published_slug));
  return v_site.published_slug;
end;
$$;

-- -----------------------------------------------------------------------------
-- Côté public (anonyme) : instantané publié uniquement
-- -----------------------------------------------------------------------------

create function public.get_public_site(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select w.published - 'assets'
  from public.websites w
  join public.businesses b on b.id = w.business_id
  where p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and w.published_slug = p_slug
    and b.status = 'active'
    and private.website_enabled(w.business_id);
$$;

-- Fichier référencé par un site publié et visible (lecture anonyme du stockage).
create function public.is_public_site_asset(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.websites w
    join public.businesses b on b.id = w.business_id
    where w.business_id = private.folder_business_id(p_name)
      and w.published is not null
      and b.status = 'active'
      and (w.published -> 'assets') ? (p_bucket || ':' || p_name)
      and private.website_enabled(w.business_id)
  );
$$;

revoke all on function private.reserved_site_slug(text) from public, anon, authenticated;
revoke all on function private.website_enabled(uuid) from public, anon, authenticated;
revoke all on function private.valid_site_image(uuid, text) from public, anon, authenticated;
revoke all on function private.check_site_slug(uuid, text) from public, anon, authenticated;
revoke all on function public.create_website(uuid, text) from public, anon;
revoke all on function public.save_website(uuid, integer, text, text, jsonb) from public, anon;
revoke all on function public.set_website_media(uuid, text, text, text[]) from public, anon;
revoke all on function public.publish_website(uuid, integer) from public, anon;
revoke all on function public.unpublish_website(uuid) from public, anon;
revoke all on function public.get_public_site(text) from public;
revoke all on function public.is_public_site_asset(text, text) from public;
grant execute on function public.create_website(uuid, text) to authenticated;
grant execute on function public.save_website(uuid, integer, text, text, jsonb) to authenticated;
grant execute on function public.set_website_media(uuid, text, text, text[]) to authenticated;
grant execute on function public.publish_website(uuid, integer) to authenticated;
grant execute on function public.unpublish_website(uuid) to authenticated;
grant execute on function public.get_public_site(text) to anon, authenticated;
grant execute on function public.is_public_site_asset(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Stockage : photos du site (privées tant qu'elles ne sont pas publiées)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy site_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'site-images' and private.is_business_member(private.folder_business_id(name)));

create policy site_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and private.has_business_role(private.folder_business_id(name), array['owner', 'manager']::public.business_role[])
  );

create policy site_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-images'
    and private.has_business_role(private.folder_business_id(name), array['owner', 'manager']::public.business_role[])
  );

-- Lecture anonyme limitée aux fichiers listés dans un instantané publié.
create policy published_site_assets_read on storage.objects
  for select to anon
  using (
    bucket_id in ('site-images', 'catalog-images')
    and public.is_public_site_asset(bucket_id, name)
  );
