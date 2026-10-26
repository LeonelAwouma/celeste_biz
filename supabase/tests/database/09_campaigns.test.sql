-- Liens de campagne WhatsApp : codes, redirection, compteurs agrégés, attribution (Phase 10).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

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
\set biz_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set biz_b  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set robe   '''ca100000-0000-4000-8000-000000000001'''
\set retouche '''ca100000-0000-4000-8000-000000000002'''
\set gateau '''cb100000-0000-4000-8000-000000000001'''
\set ord_2  '''0da00000-0000-4000-8000-000000000002'''

create temp table ids (label text primary key, id uuid);
grant all on ids to public;

-- 1. Accès -----------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.campaign_links'::regclass), 'RLS activée');
set local role anon;
select throws_ok('select id from public.campaign_links', '42501', null, 'anon ne lit pas les campagnes');
reset role;
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'campaign_clicks_daily'),
  array['business_id', 'campaign_id', 'clicks', 'day'],
  'clics : compteurs agrégés uniquement (ni IP, ni appareil)'
);

-- 2. Création --------------------------------------------------------------------------
select pg_temp.login(:sam);
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'TEST', 'Test', 'other', null, 'Bonjour')$q$, :biz_a),
  '42501', null, 'un employé ne crée pas de campagne');
reset role;
select pg_temp.login(:bob);
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'TEST', 'Test', 'other', null, 'Bonjour')$q$, :biz_a),
  '42501', null, 'Bob ne crée pas de campagne chez Alice');
reset role;
select pg_temp.login(:alice);
insert into ids values ('c1', public.create_campaign_link(:biz_a, ' noel-2026 ', 'Noël 2026', 'facebook', :robe,
  'Bonjour, je veux une tenue pour Noël.'));
select is((select code from public.campaign_links where id = (select id from ids where label = 'c1')), 'NOEL-2026',
  'code normalisé en majuscules');
select ok((select public_id ~ '^[A-Za-z0-9_-]{12}$' from public.campaign_links where id = (select id from ids where label = 'c1')),
  'identifiant public aléatoire de 12 caractères');
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'NOEL-2026', 'Doublon', 'other', null, 'Bonjour')$q$, :biz_a),
  'CB422', null, 'code unique par entreprise');
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'A B', 'Code', 'other', null, 'Bonjour')$q$, :biz_a),
  'CB422', null, 'code mal formé refusé');
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'AUTRE', 'Autre', 'other', %L, 'Bonjour')$q$, :biz_a, :gateau),
  'CB422', null, 'article d''une autre entreprise refusé');
select throws_ok(
  format($q$select public.create_campaign_link(%L, 'VIDE', 'Vide', 'other', null, '  ')$q$, :biz_a),
  'CB422', null, 'message prérempli obligatoire');
reset role;
select pg_temp.login(:bob);
select lives_ok(
  format($q$select public.create_campaign_link(%L, 'NOEL-2026', 'Noël', 'instagram', null, 'Bonjour Bob')$q$, :biz_b),
  'le même code reste libre pour une autre entreprise');
select is((select count(*)::int from public.campaign_links where business_id = :biz_a), 0,
  'Bob ne voit pas les campagnes d''Alice');
select throws_ok(format('select * from public.list_campaigns(%L)', :biz_a), '42501', null,
  'Bob ne lit pas les indicateurs d''Alice');
reset role;

-- 3. Redirection publique ------------------------------------------------------------------
insert into ids select 'b1', id from public.campaign_links where business_id = :biz_b and code = 'NOEL-2026';
create temp table pub as
select (select public_id from public.campaign_links where code = 'NOEL-2026' and business_id = :biz_a) as a,
  (select public_id from public.campaign_links where code = 'NOEL-2026' and business_id = :biz_b) as b;
grant all on pub to public;
create temp table opened as select null::jsonb as v limit 0;
grant all on opened to public;
set local role anon;
insert into opened select public.open_campaign_link((select a from pub), true);
reset role;
select is((select v ->> 'phone' from opened), '+237690000001', 'numéro WhatsApp de la bonne entreprise');
select is((select v ->> 'text' from opened), E'Bonjour, je veux une tenue pour Noël.\n\nRéf. NOEL-2026',
  'message prérempli avec la référence lisible');
select is((select click_count from public.campaign_links where id = (select id from ids where label = 'c1')), 1::bigint,
  'clic compté');
select is((select sum(clicks)::int from public.campaign_clicks_daily where campaign_id = (select id from ids where label = 'c1')), 1,
  'clic agrégé par jour');

set local role anon;
select public.open_campaign_link((select a from pub), false);
select is(public.open_campaign_link('inconnu12345', true), null, 'lien inconnu : rien');
select is(public.open_campaign_link('court', true), null, 'lien mal formé : rien');
reset role;
select is((select click_count from public.campaign_links where id = (select id from ids where label = 'c1')), 1::bigint,
  'aperçu de lien (robot) non compté');

-- 4. Archivage et numéro manquant -----------------------------------------------------------
select pg_temp.login(:alice);
select public.update_campaign_link((select id from ids where label = 'c1'), 'Noël 2026', 'facebook', :robe,
  'Bonjour, je veux une tenue pour Noël.', true);
reset role;
set local role anon;
select is(
  public.open_campaign_link((select a from pub), true),
  '{"state": "unavailable", "business_name": "Atelier Alice"}'::jsonb,
  'campagne archivée : indisponible, sans numéro'
);
reset role;
select is((select click_count from public.campaign_links where id = (select id from ids where label = 'c1')), 1::bigint,
  'campagne archivée : clic non compté');
update public.businesses set whatsapp_phone_e164 = null where id = :biz_b;
set local role anon;
select is(
  public.open_campaign_link((select b from pub), true) ->> 'state',
  'unavailable', 'sans numéro WhatsApp : indisponible');
reset role;

-- 5. Attribution d'une commande ----------------------------------------------------------
create temp table before_update as select updated_at from public.orders where id = :ord_2;
grant all on before_update to public;
select pg_temp.login(:sam);
select lives_ok(format('select public.set_order_campaign(%L, %L)', :ord_2, (select id from ids where label = 'c1')),
  'un employé déclare la provenance d''une commande');
select is((select orders_count from public.list_campaigns(:biz_a, true) where code = 'NOEL-2026'), 1::bigint,
  'commande comptée pour la campagne');
reset role;
select is((select updated_at from public.orders where id = :ord_2), (select updated_at from before_update),
  'la date de mise à jour vue par le client ne change pas');
select pg_temp.login(:alice);
select throws_ok(
  format('select public.set_order_campaign(%L, %L)', :ord_2,
    (select id from ids where label = 'b1')),
  '42501', null, 'campagne d''une autre entreprise refusée');
reset role;
select pg_temp.login(:bob);
select throws_ok(format('select public.set_order_campaign(%L, null)', :ord_2), '42501', null,
  'Bob ne modifie pas les commandes d''Alice');
reset role;

select * from finish();
rollback;
