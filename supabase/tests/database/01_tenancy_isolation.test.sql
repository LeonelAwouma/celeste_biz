-- Tests d'isolation multi-entreprises (critère bloquant de la Phase 2).
-- Données : supabase/seed.sql (Alice + Sam → Atelier Alice ; Bob → Délices de Bob).
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Bascule d'identité : simule une requête PostgREST authentifiée.
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

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on function pg_temp.login(uuid) to public;
grant execute on function pg_temp.logout() to public;

-- Identifiants du seed
\set alice '''a1111111-1111-4111-8111-111111111111'''
\set sam   '''a2222222-2222-4222-8222-222222222222'''
\set bob   '''b1111111-1111-4111-8111-111111111111'''
\set biz_a '''aaaaaaaa-0000-4000-8000-000000000001'''
\set biz_b '''bbbbbbbb-0000-4000-8000-000000000001'''

-- 1. RLS activée partout --------------------------------------------------------
select ok(relrowsecurity, format('RLS activée sur %s', relname))
from pg_class
where oid in (
  'public.profiles'::regclass, 'public.businesses'::regclass,
  'public.business_members'::regclass, 'public.audit_logs'::regclass
)
order by relname;

-- 2. Visiteur anonyme : aucun accès -----------------------------------------------
set local role anon;
select throws_ok('select * from public.businesses', '42501', null, 'anon ne lit pas les entreprises');
select throws_ok('select * from public.business_members', '42501', null, 'anon ne lit pas les membres');
select throws_ok($$select public.create_business('Pirate')$$, '42501', null, 'anon ne crée pas d''entreprise');
reset role;

-- 3. Alice (propriétaire A) ne voit que A ------------------------------------------
select pg_temp.login(:alice);

select results_eq('select id from public.businesses', array[:biz_a::uuid], 'Alice ne voit que son entreprise');
select is_empty(format('select 1 from public.businesses where id = %L', :biz_b), 'Alice ne lit pas B même avec son ID');
select is_empty(format('select 1 from public.business_members where business_id = %L', :biz_b), 'Alice ne lit pas les membres de B');
select is_empty(format('select 1 from public.audit_logs where business_id = %L', :biz_b), 'Alice ne lit pas l''audit de B');
select is_empty(format('select 1 from public.profiles where user_id = %L', :bob), 'Alice ne lit pas le profil de Bob');
select isnt_empty(format('select 1 from public.profiles where user_id = %L', :sam), 'Alice lit le profil de son employé');

-- Écritures forgées vers B : aucune ligne touchée
select is_empty(
  format($$update public.businesses set name = 'Piraté' where id = %L returning 1$$, :biz_b),
  'Alice ne modifie pas B (ID forgé)'
);
select throws_ok(
  format($$select public.set_member_role(%L, %L, 'viewer')$$, :biz_b, :bob),
  '42501', null, 'Alice ne change pas les rôles de B'
);
select throws_ok(
  format($$select public.revoke_member(%L, %L)$$, :biz_b, :bob),
  '42501', null, 'Alice ne révoque pas les membres de B'
);
select throws_ok(
  format($$insert into public.business_members (business_id, user_id, role) values (%L, %L, 'owner')$$, :biz_b, :alice),
  '42501', null, 'Alice ne s''ajoute pas comme membre de B'
);

-- Colonnes protégées, même sur sa propre entreprise
select throws_ok(
  format($$update public.businesses set owner_user_id = %L where id = %L$$, :bob, :biz_a),
  '42501', null, 'owner_user_id non modifiable'
);
select throws_ok(
  format($$update public.businesses set status = 'closed' where id = %L$$, :biz_a),
  '42501', null, 'statut non modifiable directement'
);
select throws_ok(
  format($$delete from public.businesses where id = %L$$, :biz_a),
  '42501', null, 'suppression directe interdite'
);
select throws_ok(
  $$insert into public.audit_logs (action, entity) values ('faux', 'x')$$,
  '42501', null, 'audit non falsifiable'
);

-- Modification légitime : journalisée
select isnt_empty(
  format($$update public.businesses set city = 'Kribi' where id = %L returning 1$$, :biz_a),
  'Alice modifie les paramètres de son entreprise'
);
select isnt_empty(
  format($$select 1 from public.audit_logs where business_id = %L and action = 'business.updated'$$, :biz_a),
  'la modification est journalisée'
);

-- Dernier propriétaire protégé
select throws_ok(
  format($$select public.revoke_member(%L, %L)$$, :biz_a, :alice),
  '23514', null, 'impossible de retirer le dernier propriétaire'
);

-- 4. Sam (staff A) : lecture, pas d'administration ---------------------------------
select pg_temp.login(:sam);

select results_eq('select id from public.businesses', array[:biz_a::uuid], 'Sam voit son entreprise');
select is_empty(
  format($$update public.businesses set name = 'Renommé' where id = %L returning 1$$, :biz_a),
  'un staff ne modifie pas les paramètres'
);
select throws_ok(
  format($$select public.set_member_role(%L, %L, 'owner')$$, :biz_a, :sam),
  '42501', null, 'un staff ne s''auto-promeut pas'
);
select is_empty('select 1 from public.audit_logs', 'un staff ne lit pas le journal d''audit');

-- 5. Bob (propriétaire B) ne voit pas A ---------------------------------------------
select pg_temp.login(:bob);
select results_eq('select id from public.businesses', array[:biz_b::uuid], 'Bob ne voit que son entreprise');
select is_empty(format('select 1 from public.profiles where user_id = %L', :alice), 'Bob ne lit pas le profil d''Alice');

-- 6. Création d'entreprise : atomique, propriétaire, audit ---------------------------
select lives_ok($$select public.create_business('Bob Événements', 'catering', 'Yaoundé')$$, 'Bob crée une 2e entreprise');
select is(
  (select count(*)::int from public.businesses),
  2,
  'Bob voit ses deux entreprises'
);
select is(
  (select m.role::text from public.business_members m join public.businesses b on b.id = m.business_id
   where b.name = 'Bob Événements' and m.user_id = :bob),
  'owner',
  'le créateur devient propriétaire'
);
select is(
  (select slug from public.businesses where name = 'Bob Événements'),
  'bob-evenements',
  'slug normalisé sans accents'
);

-- 7. Révocation : l'accès disparaît immédiatement ------------------------------------
select pg_temp.login(:alice);
select lives_ok(format($$select public.revoke_member(%L, %L)$$, :biz_a, :sam), 'Alice révoque Sam');
select pg_temp.login(:sam);
select is_empty('select 1 from public.businesses', 'un membre révoqué ne voit plus l''entreprise');

select pg_temp.logout();
select * from finish();
rollback;
