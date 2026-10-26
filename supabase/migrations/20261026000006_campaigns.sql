-- =============================================================================
-- Phase 10 — WhatsApp sans automatisation et liens de campagne.
-- Un lien court `/c/<identifiant>` redirige vers `wa.me` avec un message
-- prérempli contenant une référence lisible (code campagne). Seuls des
-- compteurs agrégés par jour sont conservés : ni adresse IP, ni cookie, ni
-- identifiant d'appareil. L'attribution d'une commande à une campagne est
-- déclarée par le commerçant (aucune lecture des conversations WhatsApp).
-- =============================================================================

create table public.campaign_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9_-]{12}$'),
  code text not null check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(code) between 3 and 24),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  source text not null default 'other'
    check (source in ('facebook', 'instagram', 'whatsapp_status', 'tiktok', 'flyer', 'other')),
  catalog_item_id uuid,
  message text not null check (char_length(btrim(message)) between 1 and 500),
  click_count bigint not null default 0 check (click_count >= 0),
  last_click_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code),
  foreign key (business_id, catalog_item_id) references public.catalog_items (business_id, id)
);

create trigger campaign_links_touch before update on public.campaign_links
  for each row execute function private.touch_updated_at();

-- Clics agrégés par jour (fuseau de l'entreprise).
create table public.campaign_clicks_daily (
  campaign_id uuid not null references public.campaign_links (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (campaign_id, day)
);

-- Provenance déclarée d'une commande (table séparée : ne modifie pas la date
-- de mise à jour visible par le client sur le suivi).
create table public.order_campaigns (
  order_id uuid primary key,
  business_id uuid not null,
  campaign_id uuid not null,
  set_by uuid references auth.users (id) on delete set null default auth.uid(),
  set_at timestamptz not null default now(),
  foreign key (business_id, order_id) references public.orders (business_id, id) on delete cascade,
  foreign key (business_id, campaign_id) references public.campaign_links (business_id, id)
);

create index order_campaigns_campaign_idx on public.order_campaigns (campaign_id);

revoke all on public.campaign_links, public.campaign_clicks_daily, public.order_campaigns from anon, authenticated;
grant select on public.campaign_links, public.campaign_clicks_daily, public.order_campaigns to authenticated;

alter table public.campaign_links enable row level security;
alter table public.campaign_clicks_daily enable row level security;
alter table public.order_campaigns enable row level security;

create policy campaign_links_select on public.campaign_links
  for select to authenticated using (private.is_business_member(business_id));
create policy campaign_clicks_select on public.campaign_clicks_daily
  for select to authenticated using (private.is_business_member(business_id));
create policy order_campaigns_select on public.order_campaigns
  for select to authenticated using (private.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- Côté commerçant
-- -----------------------------------------------------------------------------

create function private.check_campaign_fields(
  p_business_id uuid,
  p_label text,
  p_source text,
  p_catalog_item_id uuid,
  p_message text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_label is null or char_length(btrim(p_label)) not between 1 and 80 then
    perform private.raise_rule('Nom de campagne obligatoire (80 caractères au maximum).');
  end if;
  if p_source is null or p_source not in ('facebook', 'instagram', 'whatsapp_status', 'tiktok', 'flyer', 'other') then
    perform private.raise_rule('Canal inconnu.');
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 500 then
    perform private.raise_rule('Message prérempli obligatoire (500 caractères au maximum).');
  end if;
  if p_catalog_item_id is not null and not exists (
    select 1 from public.catalog_items
    where id = p_catalog_item_id and business_id = p_business_id
      and visibility = 'public' and archived_at is null
  ) then
    perform private.raise_rule('Cet article n''est pas disponible pour une campagne.');
  end if;
end;
$$;

create function public.create_campaign_link(
  p_business_id uuid,
  p_code text,
  p_label text,
  p_source text,
  p_catalog_item_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' or char_length(v_code) not between 3 and 24 then
    perform private.raise_rule('Code invalide : 3 à 24 caractères, lettres, chiffres et tirets.');
  end if;
  if exists (select 1 from public.campaign_links where business_id = p_business_id and code = v_code) then
    perform private.raise_rule('Ce code est déjà utilisé par une autre campagne.');
  end if;
  perform private.check_campaign_fields(p_business_id, p_label, p_source, p_catalog_item_id, p_message);

  insert into public.campaign_links (business_id, public_id, code, label, source, catalog_item_id, message)
  values (
    p_business_id,
    left(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=', '-_'), 12),
    v_code, btrim(p_label), p_source, p_catalog_item_id, btrim(p_message)
  )
  returning id into v_id;

  perform private.write_audit(p_business_id, 'campaign.created', 'campaign', v_id::text,
    jsonb_build_object('code', v_code, 'source', p_source));
  return v_id;
end;
$$;

-- Le code reste fixe : il figure déjà dans les publications partagées.
create function public.update_campaign_link(
  p_id uuid,
  p_label text,
  p_source text,
  p_catalog_item_id uuid,
  p_message text,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.campaign_links;
begin
  select * into v_link from public.campaign_links where id = p_id for update;
  if not found or not private.has_business_role(
    v_link.business_id, array['owner', 'manager']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  -- Un article archivé depuis peut rester attaché ; un nouveau choix est vérifié.
  perform private.check_campaign_fields(v_link.business_id, p_label, p_source,
    case when p_catalog_item_id is distinct from v_link.catalog_item_id then p_catalog_item_id end,
    p_message);

  update public.campaign_links
  set label = btrim(p_label), source = p_source, catalog_item_id = p_catalog_item_id,
      message = btrim(p_message),
      archived_at = case
        when coalesce(p_archived, false) then coalesce(archived_at, now())
        else null
      end
  where id = p_id;

  perform private.write_audit(v_link.business_id, 'campaign.updated', 'campaign', p_id::text,
    jsonb_build_object('archived', coalesce(p_archived, false)));
end;
$$;

-- Provenance d'une commande (null : retirer).
create function public.set_order_campaign(p_order_id uuid, p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  select business_id into v_business from public.orders where id = p_order_id;
  if not found or not private.has_business_role(
    v_business, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if p_campaign_id is null then
    delete from public.order_campaigns where order_id = p_order_id;
    return;
  end if;
  if not exists (select 1 from public.campaign_links where id = p_campaign_id and business_id = v_business) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  insert into public.order_campaigns (order_id, business_id, campaign_id)
  values (p_order_id, v_business, p_campaign_id)
  on conflict (order_id) do update
    set campaign_id = excluded.campaign_id, set_by = auth.uid(), set_at = now();
end;
$$;

-- Liste avec indicateurs (clics totaux, 7 derniers jours, commandes déclarées).
create function public.list_campaigns(p_business_id uuid, p_archived boolean default false)
returns table (
  id uuid,
  public_id text,
  code text,
  label text,
  source text,
  catalog_item_id uuid,
  message text,
  archived_at timestamptz,
  created_at timestamptz,
  click_count bigint,
  clicks_7d bigint,
  last_click_at timestamptz,
  orders_count bigint,
  orders_total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  select (now() at time zone b.timezone)::date into v_today from public.businesses b where b.id = p_business_id;
  return query
  select c.id, c.public_id, c.code, c.label, c.source, c.catalog_item_id, c.message, c.archived_at,
    c.created_at, c.click_count,
    coalesce((select sum(d.clicks) from public.campaign_clicks_daily d
      where d.campaign_id = c.id and d.day > v_today - 7), 0)::bigint,
    c.last_click_at,
    (select count(*) from public.order_campaigns oc
      join public.orders o on o.id = oc.order_id
      where oc.campaign_id = c.id and o.status not in ('draft', 'cancelled')),
    coalesce((select sum(o.total) from public.order_campaigns oc
      join public.orders o on o.id = oc.order_id
      where oc.campaign_id = c.id and o.status not in ('draft', 'cancelled')), 0)
  from public.campaign_links c
  where c.business_id = p_business_id
    and (c.archived_at is not null) = coalesce(p_archived, false)
  order by c.created_at desc
  limit 200;
end;
$$;

-- -----------------------------------------------------------------------------
-- Côté public : redirection vers WhatsApp
-- -----------------------------------------------------------------------------

-- Résout un lien court. p_count = false pour les robots d'aperçu (non comptés).
create function public.open_campaign_link(p_public_id text, p_count boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.campaign_links;
  v_business public.businesses;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{12}$' then
    return null;
  end if;
  select * into v_link from public.campaign_links where public_id = p_public_id;
  if not found then
    return null;
  end if;
  select * into v_business from public.businesses where id = v_link.business_id;
  if v_link.archived_at is not null or v_business.status <> 'active'
    or v_business.whatsapp_phone_e164 is null then
    return jsonb_build_object('state', 'unavailable', 'business_name', v_business.name);
  end if;

  if coalesce(p_count, true) and private.hit_rate_limit('campaign:' || v_link.id, 1000) then
    update public.campaign_links
    set click_count = click_count + 1, last_click_at = now()
    where id = v_link.id;
    insert into public.campaign_clicks_daily as d (campaign_id, business_id, day, clicks)
    values (v_link.id, v_link.business_id, (now() at time zone v_business.timezone)::date, 1)
    on conflict (campaign_id, day) do update set clicks = d.clicks + 1;
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'business_name', v_business.name,
    'phone', v_business.whatsapp_phone_e164,
    'text', v_link.message || E'\n\nRéf. ' || v_link.code
  );
end;
$$;

revoke all on function private.check_campaign_fields(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_campaign_link(uuid, text, text, text, uuid, text) from public, anon;
revoke all on function public.update_campaign_link(uuid, text, text, uuid, text, boolean) from public, anon;
revoke all on function public.set_order_campaign(uuid, uuid) from public, anon;
revoke all on function public.list_campaigns(uuid, boolean) from public, anon;
revoke all on function public.open_campaign_link(text, boolean) from public;
grant execute on function public.create_campaign_link(uuid, text, text, text, uuid, text) to authenticated;
grant execute on function public.update_campaign_link(uuid, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.set_order_campaign(uuid, uuid) to authenticated;
grant execute on function public.list_campaigns(uuid, boolean) to authenticated;
grant execute on function public.open_campaign_link(text, boolean) to anon, authenticated;
