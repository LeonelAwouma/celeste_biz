-- =============================================================================
-- Phase 8 — Portail client privé : lien de suivi d'une commande.
-- Jeton opaque de 256 bits rendu une seule fois, seul son SHA-256 est stocké.
-- Expiration, révocation, un seul lien actif par commande, vue filtrée
-- (aucune note interne, montants et pièces selon le choix du commerçant),
-- limitation des tentatives infructueuses.
-- =============================================================================

create table public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  show_amounts boolean not null default true,
  show_documents boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  check (expires_at > created_at),
  foreign key (business_id, order_id) references public.orders (business_id, id) on delete cascade
);

create index tracking_links_order_idx on public.tracking_links (order_id, created_at desc);

revoke all on public.tracking_links from anon, authenticated;
-- Le condensat du jeton n'est jamais lisible, même par les membres.
grant select (id, business_id, order_id, show_amounts, show_documents, created_by, created_at,
  expires_at, revoked_at, revoked_by, last_viewed_at, view_count)
  on public.tracking_links to authenticated;

alter table public.tracking_links enable row level security;

create policy tracking_links_select on public.tracking_links
  for select to authenticated using (private.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- Limitation des tentatives (fenêtres de 10 minutes).
-- -----------------------------------------------------------------------------

create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- Compte un essai ; renvoie false au-delà de la limite pour la fenêtre.
create function private.hit_rate_limit(p_key text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_bin('10 minutes', now(), timestamptz '2000-01-01');
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Ménage occasionnel des anciennes fenêtres.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 hour';
  end if;
  return v_hits <= p_limit;
end;
$$;

revoke all on function private.hit_rate_limit(text, integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Côté commerçant
-- -----------------------------------------------------------------------------

-- Crée le lien (remplace le lien actif précédent) et renvoie le jeton en clair.
create function public.create_tracking_link(
  p_order_id uuid,
  p_days integer default 60,
  p_show_amounts boolean default true,
  p_show_documents boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_token text;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not private.has_business_role(
    v_order.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  if v_order.status = 'draft' then
    perform private.raise_rule('Confirmez la commande avant de partager son suivi.');
  end if;
  if p_days is null or p_days not between 1 and 365 then
    perform private.raise_rule('Durée de validité invalide (1 à 365 jours).');
  end if;

  update public.tracking_links
  set revoked_at = now(), revoked_by = auth.uid()
  where order_id = p_order_id and revoked_at is null and expires_at > now();

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.tracking_links (business_id, order_id, token_hash, show_amounts, show_documents,
    created_by, expires_at)
  values (v_order.business_id, p_order_id, private.hash_token(v_token), coalesce(p_show_amounts, true),
    coalesce(p_show_documents, true), auth.uid(), now() + make_interval(days => p_days))
  returning id into v_id;

  perform private.write_audit(v_order.business_id, 'tracking_link.created', 'order', p_order_id::text,
    jsonb_build_object('link', v_id, 'days', p_days));
  return v_token;
end;
$$;

create function public.revoke_tracking_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.tracking_links;
begin
  select * into v_link from public.tracking_links where id = p_link_id;
  if not found or not private.has_business_role(
    v_link.business_id, array['owner', 'manager', 'staff']::public.business_role[]
  ) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;
  update public.tracking_links set revoked_at = now(), revoked_by = auth.uid()
  where id = p_link_id and revoked_at is null;
  perform private.write_audit(v_link.business_id, 'tracking_link.revoked', 'order', v_link.order_id::text,
    jsonb_build_object('link', p_link_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Côté client (sans compte)
-- -----------------------------------------------------------------------------

-- Résout un jeton : lien valide, ou statut explicite. Un jeton inconnu et
-- une limite dépassée renvoient la même réponse (« not_found »).
create function private.resolve_tracking_token(p_token text, p_client_key text)
returns table (link_id uuid, state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.tracking_links;
  v_key text := left(coalesce(nullif(p_client_key, ''), 'anonyme'), 100);
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    perform private.hit_rate_limit('tracking:fail:' || v_key, 30);
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  select * into v_link from public.tracking_links where token_hash = private.hash_token(p_token);

  if not found then
    perform private.hit_rate_limit('tracking:fail:' || v_key, 30);
    -- Plafond global : borne les essais même si la clé client est falsifiée.
    perform private.hit_rate_limit('tracking:fail:*', 600);
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  -- Trop d'échecs récents depuis ce client : même un bon jeton est refusé.
  if coalesce((
    select hits from private.rate_limits
    where key = 'tracking:fail:' || v_key
      and window_start = date_bin('10 minutes', now(), timestamptz '2000-01-01')
  ), 0) > 30 or not private.hit_rate_limit('tracking:view:' || v_link.id::text, 300) then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  if v_link.revoked_at is not null then
    return query select v_link.id, 'revoked'::text;
  elsif v_link.expires_at <= now() then
    return query select v_link.id, 'expired'::text;
  elsif not exists (
    select 1 from public.businesses where id = v_link.business_id and status = 'active'
  ) then
    return query select v_link.id, 'revoked'::text;
  else
    return query select v_link.id, 'valid'::text;
  end if;
end;
$$;

revoke all on function private.resolve_tracking_token(text, text) from public, anon, authenticated;

-- Vue filtrée du suivi : jamais de notes internes, de motifs ni d'auteurs.
create function public.get_tracking_view(p_token text, p_client_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.tracking_links;
  v_link_id uuid;
  v_state text;
  v_order public.orders;
  v_business public.businesses;
begin
  select r.link_id, r.state into v_link_id, v_state
  from private.resolve_tracking_token(p_token, p_client_key) r;
  select * into v_link from public.tracking_links where id = v_link_id;
  if v_state = 'not_found' then
    return jsonb_build_object('state', 'not_found');
  end if;

  select * into v_business from public.businesses where id = v_link.business_id;
  if v_state <> 'valid' then
    return jsonb_build_object('state', v_state, 'business_name', v_business.name,
      'business_phone', v_business.whatsapp_phone_e164);
  end if;

  select * into v_order from public.orders where id = v_link.order_id;
  update public.tracking_links set view_count = view_count + 1, last_viewed_at = now()
  where id = v_link.id;

  return jsonb_build_object(
    'state', 'valid',
    'expires_at', v_link.expires_at,
    'business_name', v_business.name,
    'business_phone', v_business.whatsapp_phone_e164,
    'business_city', v_business.city,
    'profession_key', v_order.profession_key,
    'profession_version', v_order.profession_version,
    'order', jsonb_build_object(
      'code', v_order.code,
      'status', v_order.status,
      'due_at', v_order.due_at,
      'production_step', v_order.production_step,
      'updated_at', greatest(v_order.updated_at, coalesce((
        select max(created_at) from public.order_events where order_id = v_order.id
      ), v_order.updated_at)),
      'customer_name', (select name from public.customers where id = v_order.customer_id)
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'quantity', quantity) order by position)
      from public.order_items where order_id = v_order.id
    ), '[]'::jsonb),
    'amounts', case when v_link.show_amounts then jsonb_build_object(
      'total', v_order.total, 'paid_total', v_order.paid_total, 'balance', v_order.balance
    ) end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('to_status', to_status, 'at', created_at) order by id)
      from public.order_events
      where order_id = v_order.id and type in ('created', 'status_changed') and to_status is not null
    ), '[]'::jsonb),
    'documents', case when v_link.show_documents then jsonb_build_object(
      'receipts', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'paid_on', paid_on, 'amount', amount) order by created_at)
        from public.payments where order_id = v_order.id and status <> 'cancelled'
      ), '[]'::jsonb),
      'invoices', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'number', number, 'issue_date', issue_date) order by issued_at)
        from public.invoices where order_id = v_order.id and status = 'issued'
      ), '[]'::jsonb)
    ) end
  );
end;
$$;

-- Données d'une pièce partagée (reçu ou facture émise) pour le PDF.
create function public.get_tracking_document(
  p_token text,
  p_kind text,
  p_id uuid,
  p_client_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.tracking_links;
  v_link_id uuid;
  v_state text;
  v_order public.orders;
  v_business public.businesses;
  v_settings public.business_settings;
  v_payment public.payments;
  v_invoice public.invoices;
  v_customer public.customers;
begin
  select r.link_id, r.state into v_link_id, v_state
  from private.resolve_tracking_token(p_token, p_client_key) r;
  select * into v_link from public.tracking_links where id = v_link_id;
  if v_state is distinct from 'valid' or not v_link.show_documents then
    return null;
  end if;
  select * into v_order from public.orders where id = v_link.order_id;
  select * into v_business from public.businesses where id = v_order.business_id;
  select * into v_settings from public.business_settings where business_id = v_order.business_id;
  select * into v_customer from public.customers where id = v_order.customer_id;

  if p_kind = 'receipt' then
    select * into v_payment from public.payments
    where id = p_id and order_id = v_order.id and status <> 'cancelled';
    if not found then
      return null;
    end if;
    return jsonb_build_object(
      'kind', 'receipt',
      'order_code', v_order.code, 'order_total', v_order.total, 'balance', v_order.balance,
      'paid_on', v_payment.paid_on, 'method', v_payment.method, 'reference', v_payment.reference,
      'amount', v_payment.amount,
      'seller', jsonb_build_object('name', v_business.name, 'city', v_business.city,
        'phone', v_business.whatsapp_phone_e164),
      'customer', jsonb_build_object('name', v_customer.name, 'phone', v_customer.phone_e164)
    );
  elsif p_kind = 'invoice' then
    select * into v_invoice from public.invoices
    where id = p_id and order_id = v_order.id and status = 'issued';
    if not found then
      return null;
    end if;
    return jsonb_build_object(
      'kind', 'invoice',
      'number', v_invoice.number, 'issue_date', v_invoice.issue_date, 'due_date', v_invoice.due_date,
      'order_code', v_order.code, 'conditions', v_invoice.conditions,
      'subtotal', v_invoice.subtotal, 'tax_total', v_invoice.tax_total, 'total', v_invoice.total,
      'seller', v_invoice.seller, 'buyer', v_invoice.buyer,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'quantity', quantity,
          'unit_price', unit_price, 'discount', discount, 'tax_rate', tax_rate,
          'line_net', line_net, 'line_tax', line_tax) order by position)
        from public.invoice_items where invoice_id = v_invoice.id
      ), '[]'::jsonb)
    );
  end if;
  return null;
end;
$$;

revoke all on function public.create_tracking_link(uuid, integer, boolean, boolean) from public, anon;
revoke all on function public.revoke_tracking_link(uuid) from public, anon;
revoke all on function public.get_tracking_view(text, text) from public;
revoke all on function public.get_tracking_document(text, text, uuid, text) from public;

grant execute on function public.create_tracking_link(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.revoke_tracking_link(uuid) to authenticated;
grant execute on function public.get_tracking_view(text, text) to anon, authenticated;
grant execute on function public.get_tracking_document(text, text, uuid, text) to anon, authenticated;
