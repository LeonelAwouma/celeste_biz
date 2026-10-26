-- Commandes et encaissements : isolation, transitions, montants, idempotence (Phase 5).
begin;
create extension if not exists pgtap with schema extensions;

select plan(54);

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
\set sam    '''a2222222-2222-4222-8222-222222222222'''
\set bob    '''b1111111-1111-4111-8111-111111111111'''
\set viewer '''a3333333-3333-4333-8333-333333333333'''
\set biz_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set biz_b  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set cust_a '''c1a00000-0000-4000-8000-000000000001'''
\set cust_b '''c1b00000-0000-4000-8000-000000000001'''
\set item_a '''ca100000-0000-4000-8000-000000000002'''
\set item_b '''cb100000-0000-4000-8000-000000000001'''
\set ord_1  '''0d000000-0000-4000-8000-000000000001'''
\set ord_2  '''0d000000-0000-4000-8000-000000000002'''
\set ord_3  '''0d000000-0000-4000-8000-000000000003'''
\set ord_b  '''0d000000-0000-4000-8000-0000000000b1'''
\set pay_1  '''0e000000-0000-4000-8000-000000000001'''
\set pay_2  '''0e000000-0000-4000-8000-000000000002'''

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :viewer, 'authenticated', 'authenticated',
  'lecteur@exemple.test', '', now(), '{}', '{}', now(), now());
insert into public.business_members (business_id, user_id, role) values (:biz_a, :viewer, 'viewer');

-- Prochains numéros (les données de démonstration en ont déjà utilisé).
select
  extract(year from now() at time zone 'Africa/Douala')::int as year,
  coalesce((select last_value from private.order_counters
    where business_id = :biz_a and year = extract(year from now() at time zone 'Africa/Douala')), 0) as used_a,
  coalesce((select last_value from private.order_counters
    where business_id = :biz_b and year = extract(year from now() at time zone 'Africa/Douala')), 0) as used_b
\gset

-- 1. Accès ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'RLS activée sur orders');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'RLS activée sur payments');
set local role anon;
select throws_ok('select * from public.orders', '42501', null, 'anon ne lit pas les commandes');
reset role;

-- 2. Création ------------------------------------------------------------------------
select pg_temp.login(:sam);
select is(
  (select code from public.create_order(:ord_1, :biz_a, :cust_a,
    format('[{"catalog_item_id": %s, "name": "Retouche simple", "unit": "pièce", "quantity": "3", "unit_price": "2500"},
             {"name": "Doublure", "quantity": "1.5", "unit_price": "3333.33", "discount": "0.01", "tax_rate": "19.25"}]',
      to_json(:item_a::uuid))::jsonb,
    'confirmed', now() - interval '1 day')),
  format('CMD-%s-%s', :year, lpad((:used_a + 1)::text, 4, '0')),
  'le staff crée une commande numérotée CMD-AAAA-NNNN'
);
-- 3 × 2500 = 7500 ; 1,5 × 3333,33 = 4999,995 → 5000,00 − 0,01 = 4999,99 ;
-- TVA 19,25 % de 4999,99 = 962,498… → 962,50.
select results_eq(
  format('select subtotal, tax_total, total, paid_total, balance from public.orders where id = %L', :ord_1),
  $$values (12499.99::numeric, 962.50::numeric, 13462.49::numeric, 0::numeric, 13462.49::numeric)$$,
  'totaux calculés en décimal exact par le serveur'
);
select is(
  (select name || '|' || unit_price || '|' || line_net from public.order_items where order_id = :ord_1 and position = 0),
  'Retouche simple|2500.00|7500.00',
  'ligne copiée depuis le catalogue'
);
select is(
  (select id::text from public.create_order(:ord_1, :biz_a, :cust_a, '[{"name": "Autre", "quantity": "1", "unit_price": "1"}]')),
  :ord_1,
  'double envoi : la même commande est renvoyée'
);
select is((select count(*)::int from public.orders where id = :ord_1), 1, 'aucun doublon créé');
select is(
  (select total from public.orders where id = :ord_1), 13462.49::numeric,
  'le double envoi ne modifie pas la commande'
);
select is(
  (select code from public.create_order(:ord_2, :biz_a, :cust_a,
    '[{"name": "Robe", "quantity": "1", "unit_price": "25000"}]', 'draft')),
  format('CMD-%s-%s', :year, lpad((:used_a + 2)::text, 4, '0')),
  'numéro suivant sans trou'
);
select is(
  (select type || ':' || to_status from public.order_events where order_id = :ord_1 order by id limit 1),
  'created:confirmed',
  'création journalisée'
);

select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[]')$$, :ord_3, :biz_a, :cust_a),
  'CB422', 'Ajoutez au moins une ligne à la commande.', 'une commande sans ligne est refusée'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "X", "quantity": "1", "unit_price": "1"}]')$$,
    :ord_3, :biz_a, :cust_b),
  'CB422', null, 'pas de client d''une autre entreprise'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, %L)$$, :ord_3, :biz_a, :cust_a,
    format('[{"catalog_item_id": %s, "name": "X", "quantity": "1", "unit_price": "1"}]', to_json(:item_b::uuid))),
  '23503', null, 'pas d''article du catalogue d''une autre entreprise'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "X", "quantity": "1", "unit_price": "1"}]', 'closed')$$,
    :ord_3, :biz_a, :cust_a),
  'CB422', null, 'une commande ne naît pas clôturée'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "X", "quantity": "1", "unit_price": "100", "discount": "150"}]')$$,
    :ord_3, :biz_a, :cust_a),
  '23514', null, 'remise supérieure au montant refusée'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "X", "quantity": "1", "unit_price": "1"}]')$$,
    :ord_3, :biz_b, :cust_b),
  '42501', null, 'Sam ne crée pas de commande chez B'
);
select throws_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "X", "quantity": "1", "unit_price": "1"}]', 'confirmed', null, %L)$$,
    :ord_3, :biz_a, :cust_a, :bob),
  'CB422', null, 'le responsable doit être membre de l''équipe'
);
select throws_ok(
  format($$insert into public.orders (id, business_id, customer_id, code, profession_key, profession_version)
    values (%L, %L, %L, 'CMD-2026-9999', 'generic', 1)$$, :ord_3, :biz_a, :cust_a),
  '42501', null, 'aucune écriture directe dans orders'
);
select throws_ok(
  format($$update public.orders set total = 1 where id = %L$$, :ord_1),
  '42501', null, 'les montants ne se modifient pas directement'
);

-- 3. Isolation -----------------------------------------------------------------------
reset role;
select pg_temp.login(:bob);
select lives_ok(
  format($$select public.create_order(%L, %L, %L, '[{"name": "Gâteau", "quantity": "1", "unit_price": "15000"}]')$$,
    :ord_b, :biz_b, :cust_b),
  'Bob crée une commande chez B'
);
select is(
  (select code from public.orders where id = :ord_b),
  format('CMD-%s-%s', :year, lpad((:used_b + 1)::text, 4, '0')),
  'numérotation propre à chaque entreprise'
);
select is_empty(format('select 1 from public.orders where id = %L', :ord_1), 'Bob ne lit pas les commandes de A');
select is_empty(format('select 1 from public.order_items where order_id = %L', :ord_1), 'Bob ne lit pas les lignes de A');
select is_empty(format('select * from public.list_orders(%L, %L)', :biz_a, 'all'), 'list_orders ne traverse pas les entreprises');
select throws_ok(
  format($$select public.transition_order(%L, 1, 'in_progress')$$, :ord_1),
  '42501', null, 'Bob ne change pas l''état d''une commande de A'
);
select throws_ok(
  format($$select public.record_manual_payment(%L, %L, 'cash', 1000, current_date)$$, :pay_1, :ord_1),
  '42501', null, 'Bob n''encaisse pas sur une commande de A'
);

-- 4. Transitions ---------------------------------------------------------------------
reset role;
select pg_temp.login(:sam);
select throws_ok(
  format($$select public.transition_order(%L, 1, 'delivered')$$, :ord_1),
  'CB422', 'Ce changement d''état n''est pas possible.', 'transition invalide bloquée (confirmée → livrée)'
);
select is(
  (select status::text || ':' || version from public.transition_order(:ord_1, 1, 'in_progress')),
  'in_progress:2', 'le staff passe la commande en réalisation'
);
select throws_ok(
  format($$select public.transition_order(%L, 1, 'ready')$$, :ord_1),
  'CB409', null, 'version périmée refusée (modification concurrente)'
);
select throws_ok(
  format($$select public.transition_order(%L, 2, 'cancelled', 'test')$$, :ord_1),
  '42501', null, 'le staff n''annule pas'
);
select throws_ok(
  format($$select public.update_order(%L, 2, %L, null, null, null, '{}', null, '[{"name": "X", "quantity": "1", "unit_price": "1"}]')$$,
    :ord_1, :cust_a),
  'CB422', 'Les lignes sont figées après confirmation de la commande.', 'lignes figées après confirmation'
);
select is(
  (select version from public.update_order(:ord_1, 2, :cust_a, now() + interval '2 days', :sam,
    'Client pressé', '{"details": "ourlet"}', null)),
  3, 'échéance, responsable et notes modifiables'
);
select is(
  (select metadata -> 'changed' from public.order_events where order_id = :ord_1 and type = 'updated'),
  '["due_at", "assignee", "notes", "details"]'::jsonb,
  'modification journalisée (champs, pas contenu)'
);

-- 5. Encaissements -------------------------------------------------------------------
select is(
  (select status::text from public.record_manual_payment(:pay_1, :ord_1, 'mobile_money', 5000, current_date, 'MP2410.1234')),
  'manual_declared', 'acompte enregistré comme « déclaré », jamais « vérifié »'
);
select is(
  (select id::text from public.record_manual_payment(:pay_1, :ord_1, 'mobile_money', 5000, current_date)),
  :pay_1, 'double envoi d''un encaissement : renvoyé tel quel'
);
select results_eq(
  format('select paid_total, balance from public.orders where id = %L', :ord_1),
  $$values (5000.00::numeric, 8462.49::numeric)$$,
  'solde recalculé, acompte compté une seule fois'
);
select throws_ok(
  format($$select public.record_manual_payment(%L, %L, 'cash', 8462.50, current_date)$$, :pay_2, :ord_1),
  'CB422', null, 'pas d''encaissement au-delà du solde'
);
select throws_ok(
  format($$select public.record_manual_payment(%L, %L, 'cash', 10.001, current_date)$$, :pay_2, :ord_1),
  'CB422', 'Montant invalide.', 'pas de fraction de centime'
);
select throws_ok(
  format($$select public.record_manual_payment(%L, %L, 'cash', 100, current_date + 5)$$, :pay_2, :ord_1),
  'CB422', null, 'pas de date d''encaissement future'
);
select throws_ok(
  format($$select public.cancel_payment(%L, 'erreur')$$, :pay_1),
  '42501', null, 'le staff n''annule pas un encaissement'
);
select throws_ok(
  format($$delete from public.payments where id = %L$$, :pay_1),
  '42501', null, 'un encaissement ne se supprime pas'
);

-- 6. Propriétaire : annulation d'encaissement, clôture ------------------------------
reset role;
select pg_temp.login(:alice);
select is(
  (select status::text from public.cancel_payment(:pay_1, 'Saisie en double')),
  'cancelled', 'la propriétaire annule un encaissement avec motif'
);
select is((select count(*)::int from public.payments where id = :pay_1), 1, 'l''encaissement annulé reste visible');
select is((select balance from public.orders where id = :ord_1), 13462.49::numeric, 'solde rétabli');
select lives_ok(
  format($$select public.transition_order(%L, 3, 'ready')$$, :ord_1), 'prête'
);
select lives_ok(
  format($$select public.transition_order(%L, 4, 'delivered')$$, :ord_1), 'livrée'
);
select throws_ok(
  format($$select public.transition_order(%L, 5, 'closed')$$, :ord_1),
  'CB422', null, 'clôture refusée tant qu''il reste un solde'
);
select lives_ok(
  format($$select public.record_manual_payment(%L, %L, 'cash', 13462.49, current_date)$$, :pay_2, :ord_1),
  'solde encaissé'
);
select is(
  (select status::text from public.transition_order(:ord_1, 5, 'closed')),
  'closed', 'clôture une fois soldée'
);
select throws_ok(
  format($$select public.update_order(%L, 6, %L, null, null, 'x', '{}')$$, :ord_1, :cust_a),
  'CB422', null, 'une commande clôturée ne se modifie plus'
);
select throws_ok(
  format($$select public.transition_order(%L, 1, 'cancelled')$$, :ord_2),
  'CB422', 'Indiquez le motif de l''annulation.', 'annulation sans motif refusée'
);

-- 7. Lecteur -------------------------------------------------------------------------
reset role;
select pg_temp.login(:viewer);
select isnt_empty(format('select 1 from public.orders where id = %L', :ord_1), 'le lecteur consulte les commandes');
select throws_ok(
  format($$select public.transition_order(%L, 1, 'confirmed')$$, :ord_2),
  '42501', null, 'le lecteur ne change pas l''état'
);

select * from finish();
rollback;
