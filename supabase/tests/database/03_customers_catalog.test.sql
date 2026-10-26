-- Clients et catalogue : isolation, droits par rôle, archivage, images (Phase 4).
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

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

-- Lecteur (viewer) d'Atelier Alice, créé pour ce test.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :viewer, 'authenticated', 'authenticated',
  'lecteur@exemple.test', '', now(), '{}', '{}', now(), now());
insert into public.business_members (business_id, user_id, role) values (:biz_a, :viewer, 'viewer');

-- 1. RLS ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), 'RLS activée sur customers');
select ok((select relrowsecurity from pg_class where oid = 'public.catalog_items'::regclass), 'RLS activée sur catalog_items');

set local role anon;
select throws_ok('select * from public.customers', '42501', null, 'anon ne lit pas les clients');
select throws_ok('select * from public.catalog_items', '42501', null, 'anon ne lit pas le catalogue');
reset role;

-- 2. Isolation entre entreprises -----------------------------------------------------
select pg_temp.login(:sam);
-- Indépendant des données ajoutées par les tests E2E sur la base locale.
select ok(
  (select count(*) from public.customers where business_id = :biz_a) >= 3
    and not exists (select 1 from public.customers where business_id <> :biz_a),
  'Sam voit les clients de son entreprise, et seulement eux'
);
select is_empty(format('select 1 from public.customers where id = %L', :cust_b), 'Sam ne lit pas un client de B');
select is_empty(format('select 1 from public.catalog_items where id = %L', :item_b), 'Sam ne lit pas le catalogue de B');
select is_empty(
  format($$select * from public.search_customers(%L, 'kamga')$$, :biz_b),
  'la recherche ne traverse pas les entreprises'
);
select is_empty(
  format($$update public.customers set name = 'Piraté' where id = %L returning 1$$, :cust_b),
  'Sam ne modifie pas un client de B'
);
select throws_ok(
  format($$insert into public.customers (business_id, name) values (%L, 'Intrus')$$, :biz_b),
  '42501', null, 'Sam ne crée pas de client dans B (business_id forgé)'
);
select throws_ok(
  format($$update public.customers set business_id = %L where id = %L$$, :biz_b, :cust_a),
  '42501', null, 'un client ne change pas d''entreprise'
);

-- 3. Droits du staff -----------------------------------------------------------------
select lives_ok(
  format($$insert into public.customers (business_id, name, phone_e164) values (%L, 'Nouvelle cliente', '+237677000999')$$, :biz_a),
  'le staff crée un client'
);
select isnt_empty(
  format($$update public.customers set notes = 'Taille M' where id = %L returning 1$$, :cust_a),
  'le staff modifie un client'
);
select throws_ok(
  format($$update public.customers set archived_at = now() where id = %L$$, :cust_a),
  '42501', null, 'le staff n''archive pas un client'
);
select throws_ok(
  format($$delete from public.customers where id = %L$$, :cust_a),
  '42501', null, 'suppression directe interdite'
);
select throws_ok(
  format($$insert into public.catalog_items (business_id, name, price) values (%L, 'Article', 1000)$$, :biz_a),
  '42501', null, 'le staff ne modifie pas le catalogue'
);
select ok(
  exists (select 1 from public.search_customers(:biz_a::uuid, '677 000 1') where name = 'Mireille Ngo')
    and not exists (
      select 1 from public.search_customers(:biz_a::uuid, '677 000 1')
      where strpos(coalesce(phone_e164, ''), '6770001') = 0
    ),
  'recherche par téléphone (chiffres seulement)'
);
select is(
  (select count(*)::int from public.search_customers(:biz_a::uuid, '%')),
  0,
  'les caractères spéciaux ne sont pas des jokers'
);

-- 4. Lecteur ------------------------------------------------------------------------
select pg_temp.login(:viewer);
select isnt_empty('select 1 from public.customers', 'le lecteur consulte les clients');
select throws_ok(
  format($$insert into public.customers (business_id, name) values (%L, 'X')$$, :biz_a),
  '42501', null, 'le lecteur ne crée pas de client'
);
select is_empty(
  format($$update public.customers set name = 'X' where id = %L returning 1$$, :cust_a),
  'le lecteur ne modifie pas de client'
);

-- 5. Propriétaire : archivage, consentement, catalogue, audit -------------------------
select pg_temp.login(:alice);
select isnt_empty(
  format($$update public.customers set archived_at = now() where id = %L returning 1$$, :cust_a),
  'le propriétaire archive un client'
);
select isnt_empty(
  format($$select 1 from public.audit_logs where entity_id = %L and action = 'customer.archived'$$, :cust_a),
  'archivage journalisé'
);
select ok(
  (select metadata::text not like '%Taille%' from public.audit_logs where entity_id = :cust_a order by id desc limit 1),
  'le journal ne contient pas les données personnelles'
);
select lives_ok(
  $$update public.customers set marketing_consent = true where id = 'c1a00000-0000-4000-8000-000000000002'$$,
  'consentement marketing enregistré'
);
select isnt(
  (select marketing_consent_at from public.customers where id = 'c1a00000-0000-4000-8000-000000000002'),
  null,
  'le consentement est horodaté par le serveur'
);
select throws_ok(
  format($$insert into public.catalog_items (business_id, name, price_mode, price) values (%L, 'Sans prix', 'fixed', null)$$, :biz_a),
  '23514', null, 'prix obligatoire sauf sur devis'
);
select isnt_empty(
  format($$update public.catalog_items set archived_at = now() where id = %L returning 1$$, :item_a),
  'le propriétaire archive une prestation'
);
select throws_ok(
  format($$update public.catalog_items set image_path = %L where id = %L$$,
    'bbbbbbbb-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp', :item_a),
  '23514', null, 'une image doit être dans le dossier de l''entreprise'
);

-- 6. Stockage : dossier d'une autre entreprise inaccessible ----------------------------
select throws_ok(
  format($$insert into storage.objects (bucket_id, name, owner) values ('catalog-images', %L, %L)$$,
    'bbbbbbbb-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.webp', :alice),
  '42501', null, 'Alice ne dépose pas d''image chez B'
);
reset role;
select isnt_empty(
  $$select 1 from storage.buckets b where b.id = 'catalog-images' and not b.public$$,
  'le bucket des images est privé'
);
insert into storage.objects (bucket_id, name)
values ('catalog-images', 'bbbbbbbb-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.webp');
select pg_temp.login(:alice);
select is_empty(
  $$select 1 from storage.objects where name like 'bbbbbbbb-0000-4000-8000-000000000001/%'$$,
  'Alice ne voit pas les images de B'
);

-- 7. Pas de suppression : archivage seulement ----------------------------------------
select throws_ok(
  format('delete from public.customers where id = %L', :cust_a),
  '42501', null, 'aucune suppression de client'
);

select * from finish();
rollback;
