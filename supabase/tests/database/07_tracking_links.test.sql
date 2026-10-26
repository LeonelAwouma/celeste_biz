-- Portail client : jeton haché, vue filtrée, expiration, révocation, limites (Phase 8).
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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
\set cust_a '''c1a00000-0000-4000-8000-000000000001'''
\set ord_1  '''0da00000-0000-4000-8000-000000000001'''
\set ord_2  '''0da00000-0000-4000-8000-000000000002'''
\set ord_b  '''0db00000-0000-4000-8000-000000000001'''
\set pay_1  '''0ea00000-0000-4000-8000-000000000001'''
\set pay_3  '''0ea00000-0000-4000-8000-000000000002'''
\set draft  '''0d700000-0000-4000-8000-000000000001'''

create temp table tokens (label text primary key, token text);
grant all on tokens to public;

-- 1. Accès à la table -------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.tracking_links'::regclass), 'RLS activée');
set local role anon;
select throws_ok('select id from public.tracking_links', '42501', null, 'anon ne lit pas les liens');
reset role;
select pg_temp.login(:alice);
select throws_ok('select token_hash from public.tracking_links', '42501', null,
  'le condensat du jeton n''est jamais lisible');
reset role;

-- 2. Création --------------------------------------------------------------------------
select pg_temp.login(:sam);
insert into tokens values ('t1', public.create_tracking_link(:ord_1, 30));
select ok((select token ~ '^[A-Za-z0-9_-]{43}$' from tokens where label = 't1'),
  'jeton opaque de 256 bits (43 caractères base64url)');
reset role;
select is(
  (select token_hash from public.tracking_links where order_id = :ord_1 and revoked_at is null),
  (select encode(extensions.digest(token, 'sha256'), 'hex') from tokens where label = 't1'),
  'seul le SHA-256 du jeton est stocké'
);
select ok(
  not exists (select 1 from public.tracking_links l, tokens t where l.token_hash = t.token),
  'le jeton en clair n''est pas en base'
);
select pg_temp.login(:bob);
select throws_ok(format('select public.create_tracking_link(%L)', :ord_1), '42501', null,
  'pas de lien sur la commande d''une autre entreprise');
reset role;
select pg_temp.login(:sam);
select public.create_order(:draft, :biz_a, :cust_a, '[{"name": "x", "quantity": "1", "unit_price": "1"}]', 'draft');
select throws_ok(format('select public.create_tracking_link(%L)', :draft), 'CB422', null,
  'pas de suivi pour un brouillon');
select throws_ok(format('select public.create_tracking_link(%L, 0)', :ord_1), 'CB422', null,
  'durée de validité bornée');
reset role;

-- 3. Vue client (anonyme) ---------------------------------------------------------------
set local role anon;
create temp table view_1 as
select public.get_tracking_view((select token from tokens where label = 't1'), 'client-1') as v;
reset role;
select is((select v ->> 'state' from view_1), 'valid', 'un client sans compte ouvre son suivi');
select is((select v #>> '{order,code}' from view_1), format('CMD-%s-0001', extract(year from now() at time zone 'Africa/Douala')),
  'numéro de la commande');
select is((select v #>> '{order,status}' from view_1), 'in_progress', 'état de la commande');
select ok((select v #> '{order,updated_at}' is not null from view_1), 'date de dernière mise à jour');
select is((select (v #>> '{amounts,balance}')::numeric from view_1), 20000.00::numeric, 'solde affiché si autorisé');
select ok(
  (select v::text not like '%Tissu déposé%' and v::text not like '%notes%' from view_1),
  'aucune note interne'
);
select ok(
  (select v::text not like '%reason%' and v::text not like '%actor%' and v::text not like '%a1111111%' from view_1),
  'ni motifs ni auteurs dans l''historique'
);
select is((select view_count from public.tracking_links where order_id = :ord_1 and revoked_at is null), 1,
  'consultation comptée');

set local role anon;
select is(public.get_tracking_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'client-2') ->> 'state', 'not_found',
  'jeton inconnu : introuvable');
select is(public.get_tracking_view('court', 'client-2') ->> 'state', 'not_found', 'jeton mal formé : introuvable');
select is(public.get_tracking_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'client-2'),
  '{"state": "not_found"}'::jsonb, 'aucune information sur un jeton inconnu');

-- 4. Pièces partagées --------------------------------------------------------------------
select is(
  (public.get_tracking_document((select token from tokens where label = 't1'), 'receipt', :pay_1, 'client-1') ->> 'amount')::numeric,
  15000.00::numeric, 'reçu de la commande accessible'
);
select is(
  public.get_tracking_document((select token from tokens where label = 't1'), 'receipt', :pay_3, 'client-1'),
  null, 'reçu d''une autre commande refusé'
);
reset role;

-- 5. Révocation, remplacement, expiration -------------------------------------------------
select pg_temp.login(:sam);
insert into tokens values ('t2', public.create_tracking_link(:ord_1, 30, false, false));
reset role;
set local role anon;
select is(public.get_tracking_view((select token from tokens where label = 't1'), 'client-1') ->> 'state', 'revoked',
  'un nouveau lien remplace l''ancien');
select is(public.get_tracking_view((select token from tokens where label = 't1'), 'client-1') -> 'order', null,
  'un lien révoqué ne montre plus la commande');
select is(public.get_tracking_view((select token from tokens where label = 't2'), 'client-1') -> 'amounts', 'null'::jsonb,
  'montants masqués sur demande');
select is(
  public.get_tracking_document((select token from tokens where label = 't2'), 'receipt', :pay_1, 'client-1'),
  null, 'pièces masquées sur demande'
);
reset role;

update public.tracking_links set created_at = now() - interval '40 days', expires_at = now() - interval '1 second'
where order_id = :ord_1 and revoked_at is null;
set local role anon;
select is(public.get_tracking_view((select token from tokens where label = 't2'), 'client-1') ->> 'state', 'expired',
  'lien expiré rejeté');
reset role;

select pg_temp.login(:bob);
select throws_ok(
  format('select public.revoke_tracking_link(%L)',
    (select id from public.tracking_links where order_id = :ord_1 order by created_at desc limit 1)),
  '42501', null, 'Bob ne révoque pas un lien d''Alice'
);
reset role;

-- 6. Limite de tentatives ------------------------------------------------------------------
select pg_temp.login(:alice);
insert into tokens values ('t3', public.create_tracking_link(:ord_2, 30));
reset role;
set local role anon;
select count(public.get_tracking_view(format('B%sA', repeat('x', 41)), 'curieux')) from generate_series(1, 31);
select is(public.get_tracking_view((select token from tokens where label = 't3'), 'curieux') ->> 'state', 'not_found',
  'après 30 échecs, ce client est bloqué 10 minutes');
select is(public.get_tracking_view((select token from tokens where label = 't3'), 'autre-client') ->> 'state', 'valid',
  'les autres clients ne sont pas affectés');
reset role;

select * from finish();
rollback;
