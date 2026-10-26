-- Site web métier : brouillon, publication explicite, instantané figé, isolement (Phase 9).
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

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

-- État de départ indépendant des tests E2E (base partagée).
delete from public.websites where business_id = :biz_a;
update public.business_settings set modules = modules - 'website' where business_id in (:biz_a, :biz_b);
update public.catalog_items set price = 25000, visibility = 'public', archived_at = null where id = :robe;

-- 1. Accès à la table ----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.websites'::regclass), 'RLS activée');
set local role anon;
select throws_ok('select id from public.websites', '42501', null, 'anon ne lit pas les brouillons');
reset role;
select pg_temp.login(:alice);
select is((select count(*)::int from public.websites where business_id = :biz_b), 0,
  'Alice ne voit pas le site de Bob');
reset role;

-- 2. Création --------------------------------------------------------------------------
select pg_temp.login(:sam);
select throws_ok(format('select public.create_website(%L)', :biz_a), '42501', null,
  'un employé ne crée pas le site');
reset role;
select pg_temp.login(:bob);
select throws_ok(format('select public.create_website(%L)', :biz_a), '42501', null,
  'Bob ne crée pas de site pour Alice');
reset role;
select pg_temp.login(:alice);
select lives_ok(format('select public.create_website(%L)', :biz_a), 'la propriétaire crée son site');
select is((select template_key from public.websites where business_id = :biz_a), 'couture',
  'modèle du métier proposé par défaut');
select is((select slug from public.websites where business_id = :biz_a), 'atelier-alice',
  'adresse tirée du nom de l''entreprise');
select is(public.create_website(:biz_a), (select id from public.websites where business_id = :biz_a),
  'un seul site par entreprise');

-- 3. Brouillon ---------------------------------------------------------------------------
select throws_ok(format($q$select public.save_website(%L, 99, 'couture', 'atelier-alice', '{}')$q$, :biz_a),
  'CB409', null, 'version périmée refusée');
select throws_ok(format($q$select public.save_website(%L, 1, 'couture', 'admin', '{}')$q$, :biz_a),
  'CB422', null, 'adresse réservée refusée');
select throws_ok(format($q$select public.save_website(%L, 1, 'couture', 'delices-de-bob', '{}')$q$, :biz_a),
  'CB422', null, 'adresse d''une autre entreprise refusée');
select throws_ok(format($q$select public.save_website(%L, 1, 'couture', 'Mon Site!', '{}')$q$, :biz_a),
  'CB422', null, 'adresse mal formée refusée');
select throws_ok(
  format($q$select public.save_website(%L, 1, 'couture', 'atelier-alice', '{"service_ids": [%s]}')$q$,
    :biz_a, to_json(:gateau::text)),
  'CB422', null, 'prestation d''une autre entreprise refusée');
reset role;
update public.catalog_items set visibility = 'private' where id = :retouche;
select pg_temp.login(:alice);
select throws_ok(
  format($q$select public.save_website(%L, 1, 'couture', 'atelier-alice', '{"service_ids": [%s]}')$q$,
    :biz_a, to_json(:retouche::text)),
  'CB422', null, 'prestation privée refusée');
select is(
  public.save_website(:biz_a, 1, 'couture', 'atelier-alice',
    jsonb_build_object('headline', 'Couture sur mesure à Douala', 'show_prices', true,
      'service_ids', jsonb_build_array(:robe))),
  2, 'brouillon enregistré (version 2)');

set local role anon;
select is(public.get_public_site('atelier-alice'), null, 'rien de public avant publication');
reset role;

-- 4. Publication -------------------------------------------------------------------------
select pg_temp.login(:sam);
select throws_ok(format('select public.publish_website(%L, 2)', :biz_a), '42501', null,
  'un employé ne publie pas');
reset role;
select pg_temp.login(:alice);
select throws_ok(format('select public.publish_website(%L, 1)', :biz_a), 'CB409', null,
  'seule la version prévisualisée est publiée');
select is(public.publish_website(:biz_a, 2), 'atelier-alice', 'publication explicite');
reset role;

set local role anon;
create temp table site_1 as select public.get_public_site('atelier-alice') as s;
reset role;
select is((select s #>> '{content,headline}' from site_1), 'Couture sur mesure à Douala', 'textes publiés');
select is((select (s #>> '{services,0,price}')::numeric from site_1), 25000.00::numeric, 'prix publié');
select is(
  (select array_agg(k order by k) from site_1, jsonb_object_keys(s) k),
  array['business', 'content', 'media', 'published_at', 'services', 'template_key', 'version'],
  'instantané limité aux champs publics'
);
select ok(
  (select s::text not like '%c1a00000%' and s::text not like '%Mireille%' and s::text not like '%assets%' from site_1),
  'aucun client ni donnée interne'
);

-- 5. Aucune publication implicite ------------------------------------------------------
update public.catalog_items set price = 99000 where id = :robe;
select pg_temp.login(:alice);
select public.save_website(:biz_a, 2, 'generic', 'atelier-alice-douala',
  jsonb_build_object('headline', 'Brouillon non publié', 'show_prices', false,
    'service_ids', jsonb_build_array(:robe)));
reset role;
set local role anon;
select is(public.get_public_site('atelier-alice') #>> '{content,headline}', 'Couture sur mesure à Douala',
  'le brouillon ne modifie pas le site publié');
select is((public.get_public_site('atelier-alice') #>> '{services,0,price}')::numeric, 25000.00::numeric,
  'un changement de prix du catalogue attend la prochaine publication');
select is(public.get_public_site('atelier-alice-douala'), null, 'nouvelle adresse inactive avant publication');
reset role;

select pg_temp.login(:alice);
select public.publish_website(:biz_a, 3);
reset role;
set local role anon;
select is(public.get_public_site('atelier-alice'), null, 'ancienne adresse libérée après republication');
select is(public.get_public_site('atelier-alice-douala') #>> '{services,0,price}', null,
  'prix masqués sur demande');
select is(public.get_public_site('atelier-alice-douala') ->> 'template_key', 'generic', 'modèle publié');
reset role;

-- 6. Médias -------------------------------------------------------------------------------
select pg_temp.login(:alice);
select throws_ok(
  format('select public.set_website_media(%L, %L, null, null)', :biz_a,
    'bbbbbbbb-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp'),
  '42501', null, 'image d''un autre dossier refusée');
select throws_ok(
  format('select public.set_website_media(%L, null, null, %L)', :biz_a,
    (select array_agg(format('%s/%s.webp', 'aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid())) from generate_series(1, 9))),
  'CB422', null, 'galerie limitée à 8 photos');
select public.set_website_media(:biz_a, 'aaaaaaaa-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.webp', null, null);
select public.publish_website(:biz_a, 3);
reset role;
set local role anon;
select ok(public.is_public_site_asset('site-images',
  'aaaaaaaa-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.webp'),
  'logo publié lisible par tous');
select ok(not public.is_public_site_asset('site-images',
  'aaaaaaaa-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.webp'),
  'fichier non publié illisible');
reset role;

-- 7. Module désactivé, dépublication ------------------------------------------------------
update public.business_settings set modules = modules || '{"website": false}' where business_id = :biz_a;
set local role anon;
select is(public.get_public_site('atelier-alice-douala'), null, 'module désactivé : site hors ligne');
reset role;
update public.business_settings set modules = modules - 'website' where business_id = :biz_a;

select pg_temp.login(:alice);
select public.unpublish_website(:biz_a);
reset role;
set local role anon;
select is(public.get_public_site('atelier-alice-douala'), null, 'site dépublié hors ligne');
select ok(not public.is_public_site_asset('site-images',
  'aaaaaaaa-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.webp'),
  'photos dépubliées illisibles');
reset role;

select * from finish();
rollback;
