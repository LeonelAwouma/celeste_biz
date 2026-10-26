-- Exports tracés, quotas, sonde de santé, accès au journal (Phase 11).
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Fenêtres de quota vierges (les E2E partagent la base).
delete from private.rate_limits where key like 'quota:%';

-- 1. Exports ---------------------------------------------------------------------------
select pg_temp.login(:sam);
select throws_ok(format($q$select public.log_export(%L, 'orders', 1, null, null)$q$, :biz_a),
  '42501', null, 'un employé n''exporte pas');
reset role;
select pg_temp.login(:bob);
select throws_ok(format($q$select public.log_export(%L, 'orders', 1, null, null)$q$, :biz_a),
  '42501', null, 'Bob n''exporte pas les données d''Alice');
reset role;
select pg_temp.login(:alice);
select throws_ok(format($q$select public.log_export(%L, 'secrets', 1, null, null)$q$, :biz_a),
  '22023', null, 'type d''export inconnu refusé');
select ok(public.log_export(:biz_a, 'orders', 3, '2026-10-01', '2026-10-31'), 'export autorisé');
reset role;
select is(
  (select metadata from public.audit_logs where business_id = :biz_a and action = 'export.created'
   order by id desc limit 1),
  '{"to": "2026-10-31", "from": "2026-10-01", "rows": 3}'::jsonb,
  'export inscrit au journal (type, période, lignes)'
);
select pg_temp.login(:alice);
select count(public.log_export(:biz_a, 'customers', 1, null, null)) from generate_series(1, 29);
select ok(not public.log_export(:biz_a, 'customers', 1, null, null), 'au-delà de 30 exports en 10 minutes : refusé');
reset role;

-- 2. Quotas ----------------------------------------------------------------------------
select pg_temp.login(:bob);
select throws_ok(format($q$select public.consume_quota(%L, 'upload')$q$, :biz_a), '42501', null,
  'quota d''une autre entreprise inaccessible');
reset role;
select pg_temp.login(:sam);
select throws_ok(format($q$select public.consume_quota(%L, 'inconnu')$q$, :biz_a), '22023', null,
  'quota inconnu refusé');
select ok(public.consume_quota(:biz_a, 'upload'), 'envoi de photo dans le quota');
select count(public.consume_quota(:biz_a, 'upload')) from generate_series(1, 59);
select ok(not public.consume_quota(:biz_a, 'upload'), 'au-delà de 60 envois en 10 minutes : refusé');
reset role;

-- 3. Santé et journal --------------------------------------------------------------------
set local role anon;
select ok(public.health_check(), 'sonde de santé accessible sans compte');
reset role;
select pg_temp.login(:sam);
select is((select count(*)::int from public.audit_logs where business_id = :biz_a), 0,
  'le journal est réservé au propriétaire et au gestionnaire');
reset role;

select * from finish();
rollback;
