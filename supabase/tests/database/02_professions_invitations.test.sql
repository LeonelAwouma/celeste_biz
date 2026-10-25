-- Profils métiers, réglages de modules et invitations (Phase 3).
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

\set alice '''a1111111-1111-4111-8111-111111111111'''
\set sam   '''a2222222-2222-4222-8222-222222222222'''
\set bob   '''b1111111-1111-4111-8111-111111111111'''
\set biz_a '''aaaaaaaa-0000-4000-8000-000000000001'''
\set biz_b '''bbbbbbbb-0000-4000-8000-000000000001'''

-- 1. Registre des profils -------------------------------------------------------
select results_eq(
  'select key from public.profession_templates order by key',
  array['catering', 'couture', 'generic'],
  'trois profils métiers v1'
);
select throws_ok(
  $$update public.profession_templates set label = 'x' where key = 'couture'$$,
  '42501', null, 'une version publiée est immuable (même pour postgres)'
);
select ok(rls_enabled, format('RLS activée sur %s', tbl))
from (values
  ('public.profession_templates', (select relrowsecurity from pg_class where oid = 'public.profession_templates'::regclass)),
  ('public.business_settings', (select relrowsecurity from pg_class where oid = 'public.business_settings'::regclass)),
  ('public.business_invitations', (select relrowsecurity from pg_class where oid = 'public.business_invitations'::regclass))
) as t(tbl, rls_enabled);

set local role anon;
select throws_ok('select * from public.profession_templates', '42501', null, 'anon ne lit pas les profils');
reset role;

-- 2. Création avec métier -------------------------------------------------------
select pg_temp.login(:bob);
select throws_ok(
  $$select public.create_business('Inconnu SARL', 'astronaute')$$,
  '22023', null, 'métier inconnu refusé'
);
select lives_ok(
  $$select public.create_business('Bob Couture', 'couture', 'Douala', '+237677000001')$$,
  'création avec métier, ville et WhatsApp'
);
select is(
  (select profession_key || ':' || profession_version from public.businesses where name = 'Bob Couture'),
  'couture:1',
  'version du profil enregistrée'
);
select is(
  (select s.modules from public.business_settings s join public.businesses b on b.id = s.business_id where b.name = 'Bob Couture'),
  '{}'::jsonb,
  'réglages initialisés'
);
select throws_ok(
  $$select public.create_business('Mauvais numéro', 'generic', null, '677000001')$$,
  '23514', null, 'numéro WhatsApp non E.164 refusé par la base'
);

-- 3. Réglages : membres lisent, propriétaire modifie, valeurs validées ------------
select pg_temp.login(:alice);
select is_empty(
  format('select 1 from public.business_settings where business_id = %L', :biz_b),
  'Alice ne lit pas les réglages de B'
);
select is_empty(
  format($$update public.business_settings set modules = '{"website": false}' where business_id = %L returning 1$$, :biz_b),
  'Alice ne modifie pas les réglages de B'
);
select isnt_empty(
  format($$update public.business_settings set modules = '{"website": false}' where business_id = %L returning 1$$, :biz_a),
  'Alice désactive le site de son entreprise'
);
select throws_ok(
  format($$update public.business_settings set modules = '{"orders": false}' where business_id = %L$$, :biz_a),
  '23514', null, 'un module cœur ne se désactive pas'
);
select throws_ok(
  format($$update public.business_settings set modules = '{"website": "non"}' where business_id = %L$$, :biz_a),
  '23514', null, 'valeur de module non booléenne refusée'
);
select throws_ok(
  format($$update public.business_settings set fiscal_profile = '{}' where business_id = %L$$, :biz_a),
  '42501', null, 'profil fiscal non modifiable directement à ce stade'
);
select isnt_empty(
  format($$select 1 from public.audit_logs where business_id = %L and action = 'business.modules_changed'$$, :biz_a),
  'changement de modules journalisé'
);

select pg_temp.login(:sam);
select isnt_empty(
  format('select 1 from public.business_settings where business_id = %L', :biz_a),
  'un staff lit les réglages'
);
select is_empty(
  format($$update public.business_settings set modules = '{}' where business_id = %L returning 1$$, :biz_a),
  'un staff ne modifie pas les réglages'
);
select throws_ok(
  format($$select public.set_business_profession(%L, 'catering')$$, :biz_a),
  '42501', null, 'un staff ne change pas le métier'
);

-- 4. Membres : e-mails visibles du propriétaire seulement -------------------------
select is(
  (select count(*)::int from public.list_business_members(:biz_a::uuid) where email is not null),
  1,
  'un staff ne voit que sa propre adresse'
);
select is_empty(
  format('select 1 from public.list_business_members(%L)', :biz_b),
  'un non-membre ne liste pas les membres de B'
);

-- 5. Invitations -----------------------------------------------------------------
select throws_ok(
  format($$select public.create_invitation(%L, 'x@exemple.test', 'staff')$$, :biz_a),
  '42501', null, 'un staff n''invite pas'
);

select pg_temp.login(:alice);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@exemple.test', 'owner')$$, :biz_a),
  '22023', null, 'pas d''invitation au rôle propriétaire'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'sam@exemple.test', 'viewer')$$, :biz_a),
  '23505', null, 'un membre actif ne se ré-invite pas'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@exemple.test', 'staff')$$, :biz_b),
  '42501', null, 'Alice n''invite pas dans B'
);

-- Invitation de Bob dans A : le jeton en clair n'est jamais stocké.
create temp table invite as
  select public.create_invitation(:biz_a::uuid, 'Bob@Exemple.test', 'manager') as token;
grant select on invite to public;

select isnt_empty(
  'select 1 from public.business_invitations where email = ''bob@exemple.test'' and accepted_at is null',
  'invitation enregistrée (adresse normalisée)'
);
select throws_ok(
  'select token_hash from public.business_invitations',
  '42501', null, 'le hachage du jeton n''est pas lisible'
);

-- Sam ne peut pas utiliser le lien destiné à Bob.
select pg_temp.login(:sam);
select throws_ok(
  'select public.accept_invitation((select token from invite))',
  '42501', null, 'invitation refusée pour une autre adresse'
);

-- Bob accepte : il rejoint A comme gestionnaire, une seule fois.
select pg_temp.login(:bob);
select is(
  (select status from public.get_invitation((select token from invite))),
  'valid',
  'aperçu de l''invitation'
);
select is(
  public.accept_invitation((select token from invite)),
  :biz_a::uuid,
  'Bob accepte l''invitation'
);
select throws_ok(
  'select public.accept_invitation((select token from invite))',
  'P0002', null, 'un lien d''invitation ne sert qu''une fois'
);

select * from finish();
rollback;
