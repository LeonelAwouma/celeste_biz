-- =============================================================================
-- Phase 7 — Tableau « Aujourd'hui » : agrégats et alertes déterministes.
-- Une seule fonction, réservée aux membres de l'entreprise : chaque alerte
-- renvoie son fondement (dates, états) et les dossiers concernés.
-- Aucune marge ni bénéfice : les coûts ne sont pas connus.
-- =============================================================================

create index quotes_business_sent_idx on public.quotes (business_id, sent_at)
  where status = 'sent';
create index orders_business_open_idx on public.orders (business_id, due_at)
  where status not in ('draft', 'delivered', 'closed', 'cancelled');

create function public.dashboard_summary(
  p_business_id uuid,
  p_due_hours integer default 48,
  p_quote_days integer default 5,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
-- Droits du propriétaire de la fonction : l'adhésion est vérifiée une fois
-- ci-dessous et chaque requête filtre explicitement sur l'entreprise (la
-- RLS évaluée ligne à ligne coûtait ~2 s pour 5 000 commandes).
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date;
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_due_hours integer := least(greatest(coalesce(p_due_hours, 48), 1), 24 * 14);
  v_quote_days integer := least(greatest(coalesce(p_quote_days, 5), 1), 90);
  v_result jsonb;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'action non autorisée' using errcode = '42501';
  end if;

  select (v_now at time zone b.timezone)::date into v_today
  from public.businesses b where b.id = p_business_id;

  with open_orders as (
    select o.id, o.code, o.status, o.due_at, o.balance, o.total, o.assignee_id, o.created_at,
      c.name as customer_name
    from public.orders o
    join public.customers c on c.business_id = o.business_id and c.id = o.customer_id
    where o.business_id = p_business_id
      and o.status not in ('draft', 'delivered', 'closed', 'cancelled')
  ),
  due_soon as (
    select * from open_orders
    where due_at >= v_now and due_at < v_now + make_interval(hours => v_due_hours)
  ),
  late as (
    select * from open_orders where due_at < v_now
  ),
  to_collect as (
    select o.id, o.code, o.status, o.due_at, o.balance, o.total, o.created_at, c.name as customer_name
    from public.orders o
    join public.customers c on c.business_id = o.business_id and c.id = o.customer_id
    where o.business_id = p_business_id
      and o.balance > 0
      and o.status not in ('draft', 'cancelled')
  ),
  unassigned as (
    select * from open_orders where assignee_id is null
  ),
  waiting_quotes as (
    select q.id, q.code, q.sent_at, q.valid_until, q.total, c.name as customer_name
    from public.quotes q
    join public.customers c on c.business_id = q.business_id and c.id = q.customer_id
    where q.business_id = p_business_id
      and q.status = 'sent'
      and q.sent_at < v_now - make_interval(days => v_quote_days)
  ),
  valid_payments as (
    select amount, paid_on from public.payments
    where business_id = p_business_id
      and status not in ('cancelled', 'failed', 'refunded', 'pending_provider')
      and paid_on between least(v_today - 6, date_trunc('month', v_today)::date) and v_today
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'today', v_today,
    'thresholds', jsonb_build_object('due_hours', v_due_hours, 'quote_days', v_quote_days),
    'has_orders', exists (select 1 from public.orders where business_id = p_business_id),
    'active_count', (select count(*) from open_orders),
    'draft_count', (
      select count(*) from public.orders where business_id = p_business_id and status = 'draft'
    ),
    'due_soon', jsonb_build_object(
      'count', (select count(*) from due_soon),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'code', code, 'status', status, 'customer_name', customer_name,
          'due_at', due_at, 'balance', balance
        ) order by due_at, id)
        from (select * from due_soon order by due_at, id limit v_limit) s
      ), '[]'::jsonb)
    ),
    'late', jsonb_build_object(
      'count', (select count(*) from late),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'code', code, 'status', status, 'customer_name', customer_name,
          'due_at', due_at, 'balance', balance
        ) order by due_at, id)
        from (select * from late order by due_at, id limit v_limit) s
      ), '[]'::jsonb)
    ),
    'to_collect', jsonb_build_object(
      'count', (select count(*) from to_collect),
      'total', (select coalesce(sum(balance), 0) from to_collect),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'code', code, 'status', status, 'customer_name', customer_name,
          'due_at', due_at, 'balance', balance, 'total', total
        ) order by due_at nulls last, created_at, id)
        from (
          select * from to_collect order by due_at nulls last, created_at, id limit v_limit
        ) s
      ), '[]'::jsonb)
    ),
    'unassigned', jsonb_build_object(
      'count', (select count(*) from unassigned),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'code', code, 'status', status, 'customer_name', customer_name,
          'due_at', due_at
        ) order by due_at nulls last, created_at, id)
        from (
          select * from unassigned order by due_at nulls last, created_at, id limit v_limit
        ) s
      ), '[]'::jsonb)
    ),
    'quotes_waiting', jsonb_build_object(
      'count', (select count(*) from waiting_quotes),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'code', code, 'customer_name', customer_name, 'sent_at', sent_at,
          'valid_until', valid_until, 'total', total
        ) order by sent_at, id)
        from (select * from waiting_quotes order by sent_at, id limit v_limit) s
      ), '[]'::jsonb)
    ),
    'payments', jsonb_build_object(
      'week', jsonb_build_object(
        'from', v_today - 6, 'to', v_today,
        'count', (select count(*) from valid_payments where paid_on >= v_today - 6),
        'total', (select coalesce(sum(amount), 0) from valid_payments where paid_on >= v_today - 6)
      ),
      'month', jsonb_build_object(
        'from', date_trunc('month', v_today)::date, 'to', v_today,
        'count', (
          select count(*) from valid_payments where paid_on >= date_trunc('month', v_today)::date
        ),
        'total', (
          select coalesce(sum(amount), 0) from valid_payments
          where paid_on >= date_trunc('month', v_today)::date
        )
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.dashboard_summary(uuid, integer, integer, integer) from public, anon;
grant execute on function public.dashboard_summary(uuid, integer, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Liste des commandes : filtres « sous 48 h » et « sans responsable », cibles
-- des liens « Tout voir » du tableau de bord.
-- -----------------------------------------------------------------------------

create or replace function public.list_orders(
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
      when 'soon' then o.due_at >= now() and o.due_at < now() + interval '48 hours'
        and o.status not in ('draft', 'delivered', 'closed', 'cancelled')
      when 'late' then o.due_at < now() and o.status not in ('draft', 'delivered', 'closed', 'cancelled')
      when 'unassigned' then o.assignee_id is null
        and o.status not in ('draft', 'delivered', 'closed', 'cancelled')
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
    -- Pagination par clé : échéance croissante (en retard, sous 48 h), sinon
    -- création décroissante.
    and (
      p_after_id is null
      or case when p_filter in ('late', 'soon')
        then (o.due_at, o.id) > (p_after_at, p_after_id)
        else (o.created_at, o.id) < (p_after_at, p_after_id)
      end
    )
  order by
    case when p_filter in ('late', 'soon') then o.due_at end asc,
    case when p_filter in ('late', 'soon') then o.id end asc,
    case when p_filter not in ('late', 'soon') or p_filter is null then o.created_at end desc,
    case when p_filter not in ('late', 'soon') or p_filter is null then o.id end desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;
