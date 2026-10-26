-- Tableau « Aujourd'hui » : agrégats exacts, alertes fondées, isolation, volume (Phase 7).
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
end;
$$;
grant execute on function pg_temp.login(uuid) to public;

\set alice  '''a1111111-1111-4111-8111-111111111111'''
\set bob    '''b1111111-1111-4111-8111-111111111111'''
\set biz_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set biz_b  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set cust_b '''c1b00000-0000-4000-8000-000000000001'''
\set o_soon '''0d600000-0000-4000-8000-000000000001'''
\set o_late '''0d600000-0000-4000-8000-000000000002'''
\set o_drft '''0d600000-0000-4000-8000-000000000003'''
\set o_canc '''0d600000-0000-4000-8000-000000000004'''
\set o_dlvd '''0d600000-0000-4000-8000-000000000005'''
\set q_old  '''0f600000-0000-4000-8000-000000000001'''
\set q_new  '''0f600000-0000-4000-8000-000000000002'''
\set p_ok   '''0e600000-0000-4000-8000-000000000001'''
\set p_ko   '''0e600000-0000-4000-8000-000000000002'''

create temp table snap (label text primary key, data jsonb);
grant all on snap to public;

-- 1. Accès ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  format('select public.dashboard_summary(%L)', :biz_b), '42501', null,
  'anon n''appelle pas le tableau de bord'
);
reset role;
select pg_temp.login(:alice);
select throws_ok(
  format('select public.dashboard_summary(%L)', :biz_b), '42501', null,
  'Alice ne voit pas le tableau de bord de Bob'
);
reset role;

-- 2. État de départ (les tests E2E partagent la base : on mesure des écarts) ----------
select pg_temp.login(:bob);
insert into snap values ('before', public.dashboard_summary(:biz_b));

-- Commandes : à remettre sous 48 h, en retard (avec responsable), brouillon,
-- annulée, livrée avec solde.
select public.create_order(:o_soon, :biz_b, :cust_b, '[{"name": "Plateau", "quantity": "1", "unit_price": "10000"}]',
  'confirmed', now() + interval '10 hours');
select public.create_order(:o_late, :biz_b, :cust_b, '[{"name": "Gâteau", "quantity": "2", "unit_price": "7500"}]',
  'confirmed', now() - interval '2 hours', :bob);
select public.create_order(:o_drft, :biz_b, :cust_b, '[{"name": "Brouillon", "quantity": "1", "unit_price": "999"}]',
  'draft', now() - interval '1 hour');
select public.create_order(:o_canc, :biz_b, :cust_b, '[{"name": "Annulée", "quantity": "1", "unit_price": "888"}]',
  'confirmed', now() - interval '3 hours');
select public.create_order(:o_dlvd, :biz_b, :cust_b, '[{"name": "Livrée", "quantity": "1", "unit_price": "4000"}]',
  'confirmed', now() - interval '5 hours');
select public.transition_order(:o_canc, 1, 'cancelled', 'Test');
select public.transition_order(:o_dlvd, 1, 'ready');
select public.transition_order(:o_dlvd, 2, 'delivered');

-- Encaissements : 3 000 valides, 2 000 annulés.
select public.record_manual_payment(:p_ok, :o_late, 'cash', 3000, (now() at time zone 'Africa/Douala')::date);
select public.record_manual_payment(:p_ko, :o_soon, 'cash', 2000, (now() at time zone 'Africa/Douala')::date);
select public.cancel_payment(:p_ko, 'Erreur de saisie');

-- Devis envoyés il y a 6 jours (en attente) et il y a 2 jours (trop récent).
select public.create_quote(:q_old, :biz_b, :cust_b, '[{"name": "Buffet", "quantity": "1", "unit_price": "50000"}]');
select public.create_quote(:q_new, :biz_b, :cust_b, '[{"name": "Buffet", "quantity": "1", "unit_price": "60000"}]');
select public.transition_quote(:q_old, 1, 'sent');
select public.transition_quote(:q_new, 1, 'sent');
reset role;
update public.quotes set sent_at = now() - interval '6 days' where id = :q_old;
update public.quotes set sent_at = now() - interval '2 days' where id = :q_new;

select pg_temp.login(:bob);
insert into snap values ('after', public.dashboard_summary(:biz_b));
reset role;

create temp view delta as
select
  ((a.data ->> 'active_count')::int - (b.data ->> 'active_count')::int) as active,
  ((a.data ->> 'draft_count')::int - (b.data ->> 'draft_count')::int) as drafts,
  ((a.data #> '{due_soon,count}')::int - (b.data #> '{due_soon,count}')::int) as due_soon,
  ((a.data #> '{late,count}')::int - (b.data #> '{late,count}')::int) as late,
  ((a.data #> '{unassigned,count}')::int - (b.data #> '{unassigned,count}')::int) as unassigned,
  ((a.data #> '{to_collect,count}')::int - (b.data #> '{to_collect,count}')::int) as to_collect,
  ((a.data #> '{to_collect,total}')::numeric - (b.data #> '{to_collect,total}')::numeric) as to_collect_total,
  ((a.data #> '{quotes_waiting,count}')::int - (b.data #> '{quotes_waiting,count}')::int) as quotes,
  ((a.data #> '{payments,week,total}')::numeric - (b.data #> '{payments,week,total}')::numeric) as week_total,
  ((a.data #> '{payments,week,count}')::int - (b.data #> '{payments,week,count}')::int) as week_count,
  a.data as after
from snap a, snap b where a.label = 'after' and b.label = 'before';

-- 3. Agrégats ------------------------------------------------------------------------
select is((select active from delta), 2, 'commandes en cours : brouillon, annulée et livrée exclues');
select is((select drafts from delta), 1, 'brouillons comptés à part');
select is((select due_soon from delta), 1, 'à remettre sous 48 h');
select is((select late from delta), 1, 'en retard : seulement les commandes encore à remettre');
select is((select unassigned from delta), 1, 'sans responsable : la commande attribuée est exclue');
select is((select to_collect from delta), 3, 'soldes en attente : livrée incluse, brouillon et annulée exclus');
-- 10 000 + (15 000 − 3 000) + 4 000 = 26 000 (l'encaissement annulé ne compte pas).
select is((select to_collect_total from delta), 26000.00::numeric, 'total des soldes exact');
select is((select quotes from delta), 1, 'devis sans réponse depuis plus de 5 jours');
select is((select week_total from delta), 3000.00::numeric, 'encaissements de la semaine hors annulés');
select is((select week_count from delta), 1, 'un seul encaissement valide');

-- 4. Fondement des alertes : dossiers réels, dates et états ----------------------------
select ok(
  exists (
    select 1 from jsonb_array_elements((select after #> '{late,items}' from delta)) item
    where item ->> 'id' = :o_late and item ->> 'status' = 'confirmed' and item ? 'due_at'
  ) or (select (after #> '{late,count}')::int > 5 from delta),
  'la commande en retard est listée avec son échéance et son état'
);
select ok(
  exists (
    select 1 from jsonb_array_elements((select after #> '{quotes_waiting,items}' from delta)) item
    where item ->> 'id' = :q_old and item ? 'sent_at'
  ),
  'le devis en attente est listé avec sa date d''envoi'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements((select after #> '{quotes_waiting,items}' from delta)) item
    where item ->> 'id' = :q_new
  ),
  'un devis envoyé il y a 2 jours n''est pas signalé'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements((select after #> '{late,items}' from delta)) item
    where item ->> 'id' in (:o_drft, :o_canc, :o_dlvd)
  ),
  'brouillon, annulée et livrée ne sont jamais en retard'
);
select ok(
  (select after ? 'margin' or after ? 'profit' from delta) is false,
  'aucune marge ni bénéfice calculés'
);
select is(
  (select after #>> '{thresholds,due_hours}' from delta), '48', 'seuil affiché avec l''alerte'
);

-- 5. Isolation et bornes ---------------------------------------------------------------
select pg_temp.login(:alice);
select ok(
  not exists (
    select 1 from jsonb_array_elements(public.dashboard_summary(:biz_a) #> '{late,items}') item
    where item ->> 'id' = :o_late
  ),
  'les dossiers de Bob n''apparaissent pas chez Alice'
);
reset role;
select pg_temp.login(:bob);
select is(
  public.dashboard_summary(:biz_b, 100000, 1000, 1000) #>> '{thresholds,due_hours}', '336',
  'seuils bornés (14 jours au plus)'
);
select ok(
  jsonb_array_length(public.dashboard_summary(:biz_b, 48, 5, 1000) #> '{to_collect,items}') <= 20,
  'listes limitées à 20 dossiers'
);
select ok(
  exists (select 1 from public.list_orders(:biz_b, 'soon', null, null, null, null, 100) where id = :o_soon)
  and not exists (select 1 from public.list_orders(:biz_b, 'soon', null, null, null, null, 100) where id = :o_late),
  'liste « sous 48 h » : cible du lien « Tout voir »'
);
select ok(
  exists (select 1 from public.list_orders(:biz_b, 'unassigned', null, null, null, null, 100) where id = :o_soon)
  and not exists (select 1 from public.list_orders(:biz_b, 'unassigned', null, null, null, null, 100) where id = :o_late),
  'liste « sans responsable »'
);
reset role;

-- 6. Volume : 5 000 commandes ouvertes ---------------------------------------------------
insert into public.orders (id, business_id, customer_id, code, status, profession_key, profession_version,
  due_at, total, created_by)
select gen_random_uuid(), :biz_b, :cust_b, format('CMD-1999-%s', lpad(i::text, 6, '0')),
  (array['confirmed', 'in_progress', 'ready']::public.order_status[])[1 + i % 3], 'catering', 1,
  now() + make_interval(hours => (i % 200) - 100), 1000 + i, :bob
from generate_series(1, 5000) i;
analyze public.orders;

select pg_temp.login(:bob);
create temp table timing as
select clock_timestamp() as started, public.dashboard_summary(:biz_b) as data, clock_timestamp() as finished;
select ok(
  (select finished - started < interval '300 milliseconds' from timing),
  'tableau de bord calculé en moins de 300 ms avec 5 000 commandes'
);
reset role;

select * from finish();
rollback;
