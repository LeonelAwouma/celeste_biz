-- Devis, factures, avoirs : isolation, numérotation, immuabilité, interrupteur fiscal (Phase 6).
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

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
\set cust_a '''c1a00000-0000-4000-8000-000000000001'''
\set cust_b '''c1b00000-0000-4000-8000-000000000001'''
\set item_a '''ca100000-0000-4000-8000-000000000002'''
\set ord_a  '''0da00000-0000-4000-8000-000000000001'''
\set ord_b  '''0db00000-0000-4000-8000-000000000001'''
\set q_1    '''0f000000-0000-4000-8000-000000000001'''
\set q_2    '''0f000000-0000-4000-8000-000000000002'''
\set q_b    '''0f000000-0000-4000-8000-0000000000b1'''
\set q_ord  '''0f100000-0000-4000-8000-000000000001'''
\set inv_1  '''0f200000-0000-4000-8000-000000000001'''
\set inv_2  '''0f200000-0000-4000-8000-000000000002'''
\set inv_b  '''0f200000-0000-4000-8000-0000000000b1'''
\set av_1   '''0f300000-0000-4000-8000-000000000001'''
\set av_2   '''0f300000-0000-4000-8000-000000000002'''

select
  extract(year from now() at time zone 'Africa/Douala')::int as year,
  coalesce((select last_value from private.document_counters where business_id = :biz_a and prefix = 'DEV'
    and year = extract(year from now() at time zone 'Africa/Douala')), 0) as dev_a,
  coalesce((select last_value from private.document_counters where business_id = :biz_a and prefix = 'FAC'
    and year = extract(year from now() at time zone 'Africa/Douala')), 0) as fac_a,
  coalesce((select last_value from private.document_counters where business_id = :biz_a and prefix = 'AV'
    and year = extract(year from now() at time zone 'Africa/Douala')), 0) as av_a
\gset

-- Profil de facturation vide (les tests E2E partagent la base locale).
update public.business_settings set fiscal_profile = '{}' where business_id = :biz_a;

-- 1. Accès ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.quotes'::regclass), 'RLS activée sur quotes');
select ok((select relrowsecurity from pg_class where oid = 'public.invoices'::regclass), 'RLS activée sur invoices');
select ok((select relrowsecurity from pg_class where oid = 'public.credit_notes'::regclass), 'RLS activée sur credit_notes');
set local role anon;
select throws_ok('select * from public.invoices', '42501', null, 'anon ne lit pas les factures');
reset role;
select is((select public from storage.buckets where id = 'documents'), false, 'le bucket des pièces est privé');

-- 2. Devis ---------------------------------------------------------------------------
select pg_temp.login(:sam);
select is(
  (select code from public.create_quote(:q_1, :biz_a, :cust_a,
    format('[{"catalog_item_id": %s, "name": "Retouche simple", "quantity": "2", "unit_price": "2500"},
             {"name": "Broderie", "quantity": "1", "unit_price": "10000", "discount": "500", "tax_rate": "19.25"}]',
      to_json(:item_a::uuid))::jsonb,
    (now() at time zone 'Africa/Douala')::date + 15, 'Acompte de 50 % à la commande.')),
  format('DEV-%s-%s', :year, lpad((:dev_a + 1)::text, 4, '0')),
  'le staff crée un devis numéroté DEV-AAAA-NNNN'
);
-- 2 × 2500 = 5000 ; 10000 − 500 = 9500 ; TVA 19,25 % de 9500 = 1828,75.
select results_eq(
  format('select subtotal, tax_total, total, status::text from public.quotes where id = %L', :q_1),
  $$values (14500.00::numeric, 1828.75::numeric, 16328.75::numeric, 'draft'::text)$$,
  'totaux du devis calculés par le serveur'
);
select is(
  (select code from public.create_quote(:q_1, :biz_a, :cust_a, '[{"name": "x", "quantity": "1", "unit_price": "1"}]')),
  format('DEV-%s-%s', :year, lpad((:dev_a + 1)::text, 4, '0')),
  'double envoi : le même devis est renvoyé'
);
select throws_ok(
  format('select public.create_quote(%L, %L, %L, %L::jsonb)', :q_2, :biz_a, :cust_b,
    '[{"name": "x", "quantity": "1", "unit_price": "1"}]'),
  'CB422', 'Choisissez un client actif de votre entreprise.', 'pas de client d''une autre entreprise'
);
select throws_ok(
  format('select public.create_quote(%L, %L, %L, %L::jsonb)', :q_2, :biz_a, :cust_a, '[]'),
  'CB422', 'Ajoutez au moins une ligne au devis.', 'un devis a au moins une ligne'
);
select throws_ok(
  format('select public.create_quote(%L, %L, %L, %L::jsonb)', :q_b, :biz_b, :cust_b,
    '[{"name": "x", "quantity": "1", "unit_price": "1"}]'),
  '42501', null, 'pas de devis dans une autre entreprise'
);

select lives_ok(
  format('select public.update_quote(%L, 1, %L, %L::jsonb, null, null, %L)', :q_1, :cust_a,
    '[{"name": "Broderie", "quantity": "2", "unit_price": "10000"}]', 'Client fidèle'),
  'un brouillon de devis se modifie'
);
select is((select total from public.quotes where id = :q_1), 20000.00::numeric, 'totaux recalculés après modification');
select throws_ok(
  format('select public.update_quote(%L, 1, %L, %L::jsonb, null, null, null)', :q_1, :cust_a,
    '[{"name": "x", "quantity": "1", "unit_price": "1"}]'),
  'CB409', null, 'conflit de version détecté'
);
select throws_ok(
  format('select public.convert_quote_to_order(%L, %L)', :q_1, :q_ord),
  'CB422', 'Seul un devis accepté peut devenir une commande.', 'un brouillon ne devient pas commande'
);
select throws_ok(
  format('select public.transition_quote(%L, 2, %L)', :q_1, 'accepted'),
  'CB422', null, 'brouillon → accepté interdit'
);
select is((select status::text from public.transition_quote(:q_1, 2, 'sent')), 'sent', 'brouillon → envoyé');
select throws_ok(
  format('select public.update_quote(%L, 3, %L, %L::jsonb, null, null, null)', :q_1, :cust_a,
    '[{"name": "x", "quantity": "1", "unit_price": "1"}]'),
  'CB422', null, 'un devis envoyé ne se modifie plus'
);
select throws_ok(
  format('select public.transition_quote(%L, 3, %L, %L)', :q_1, 'cancelled', 'Erreur'),
  '42501', null, 'le staff n''annule pas un devis'
);
select results_eq(
  format($q$select status::text, acceptance_source, decision_note, decided_by
    from public.transition_quote(%L, 3, 'accepted', 'Accord par téléphone')$q$, :q_1),
  format($q$values ('accepted'::text, 'manual'::text, 'Accord par téléphone'::text, %L::uuid)$q$, :sam),
  'acceptation déclarée manuellement, avec auteur et provenance'
);
select is(
  (select status::text || '|' || total from public.convert_quote_to_order(:q_1, :q_ord)),
  'confirmed|20000.00',
  'devis accepté → commande confirmée au même montant'
);
select is(
  (select id from public.convert_quote_to_order(:q_1, '0f100000-0000-4000-8000-000000000999')),
  :q_ord::uuid,
  'conversion idempotente'
);
select is((select order_id from public.quotes where id = :q_1), :q_ord::uuid, 'le devis garde le lien vers la commande');

-- Devis expiré : acceptation refusée.
select lives_ok(
  format('select public.create_quote(%L, %L, %L, %L::jsonb, %L::date)', :q_2, :biz_a, :cust_a,
    '[{"name": "x", "quantity": "1", "unit_price": "1"}]', (now() at time zone 'Africa/Douala')::date + 1),
  'second devis'
);
select public.transition_quote(:q_2, 1, 'sent');
reset role;
update public.quotes set valid_until = (now() at time zone 'Africa/Douala')::date - 1 where id = :q_2;
select pg_temp.login(:sam);
select throws_ok(
  format('select public.transition_quote(%L, 2, %L)', :q_2, 'accepted'),
  'CB422', null, 'un devis expiré ne s''accepte pas'
);
reset role;

-- Isolation en lecture.
select pg_temp.login(:bob);
select is((select count(*)::int from public.quotes where business_id = :biz_a), 0, 'Bob ne voit pas les devis de A');
select throws_ok(
  format('select public.transition_quote(%L, 4, %L)', :q_1, 'rejected'),
  '42501', null, 'Bob ne modifie pas un devis de A'
);
reset role;

-- 3. Factures : brouillon ------------------------------------------------------------
select pg_temp.login(:sam);
select throws_ok(
  format('select public.create_invoice_from_order(%L, %L)', :inv_1, :ord_a),
  '42501', null, 'le staff ne prépare pas de facture'
);
reset role;
select pg_temp.login(:alice);
select results_eq(
  format('select status::text, number, total from public.create_invoice_from_order(%L, %L)', :inv_1, :ord_a),
  $$values ('draft'::text, null::text, 35000.00::numeric)$$,
  'brouillon de facture sans numéro, lignes copiées de la commande'
);
select throws_ok(
  format('select public.create_invoice_from_order(%L, %L)', :inv_2, :ord_a),
  'CB422', 'Un brouillon de facture existe déjà pour cette commande.', 'un seul brouillon par commande'
);
select throws_ok(
  format('select public.create_invoice_from_order(%L, %L)', :inv_b, :ord_b),
  '42501', null, 'pas de facture sur la commande d''une autre entreprise'
);
select is(
  (select version from public.update_invoice_draft(:inv_1, 1, (now() at time zone 'Africa/Douala')::date + 30, 'Payable à réception.')),
  2, 'le brouillon se modifie'
);

-- 4. Émission verrouillée par l'interrupteur ----------------------------------------
select is(public.fiscal_invoice_issue_enabled(), false, 'émission définitive désactivée par défaut');
select throws_ok(
  format('select public.issue_invoice(%L, 2)', :inv_1),
  'CB422', null, 'pas d''émission tant que la conformité n''est pas validée'
);
select is((select number from public.invoices where id = :inv_1), null, 'aucun numéro consommé');
select throws_ok(
  format('select public.issue_credit_note(%L, %L, 1000, %L)', :av_1, :inv_1, 'Geste'),
  'CB422', null, 'pas d''avoir tant que l''émission est désactivée'
);
select throws_ok(
  'update public.invoices set total = 1',
  '42501', null, 'aucune écriture directe sur les factures'
);
reset role;

-- Interrupteur activé (exploitation) pour vérifier le comportement après validation.
update private.platform_flags set enabled = true where key = 'fiscal_invoice_issue';
select pg_temp.login(:alice);
select throws_ok(
  format('select public.issue_invoice(%L, 2)', :inv_1),
  'CB422', null, 'profil de facturation requis avant émission'
);
select lives_ok(
  format('select public.update_fiscal_profile(%L, %L::jsonb)', :biz_a,
    '{"legal_name": "Atelier Mireille SARL", "niu": "M000000000000X", "address": "Akwa, Douala"}'),
  'le propriétaire renseigne le profil de facturation'
);
select results_eq(
  format($q$select status::text, number, seller -> 'fiscal' ->> 'legal_name', buyer ->> 'name'
    from public.issue_invoice(%L, 2)$q$, :inv_1),
  format($q$values ('issued'::text, %L::text, 'Atelier Mireille SARL'::text, 'Mireille Ngo'::text)$q$,
    format('FAC-%s-%s', :year, lpad((:fac_a + 1)::text, 4, '0'))),
  'émission : numéro FAC attribué, vendeur et acheteur figés'
);
reset role;

-- 5. Immuabilité (même pour le superutilisateur, sauf l'archivage du PDF) -------------
select throws_ok(
  format('update public.invoices set total = 1 where id = %L', :inv_1),
  '42501', null, 'une facture émise est immuable'
);
select throws_ok(
  format('update public.invoice_items set unit_price = 1 where invoice_id = %L', :inv_1),
  '42501', null, 'les lignes émises sont immuables'
);
select throws_ok(
  format('delete from public.invoices where id = %L', :inv_1),
  '42501', null, 'une facture émise ne se supprime pas'
);
select pg_temp.login(:alice);
select lives_ok(
  format('select public.attach_document_pdf(%L, %L, %L, %L)', 'invoice', :inv_1,
    'aaaaaaaa-0000-4000-8000-000000000001/factures/facture.pdf', repeat('a', 64)),
  'archivage du PDF émis'
);
select public.attach_document_pdf('invoice', :inv_1, 'aaaaaaaa-0000-4000-8000-000000000001/autre.pdf', repeat('b', 64));
select is((select pdf_sha256 from public.invoices where id = :inv_1), repeat('a', 64), 'le PDF archivé ne se remplace pas');

-- 6. Avoirs --------------------------------------------------------------------------
select is(
  (select number from public.issue_credit_note(:av_1, :inv_1, 5000, 'Remise accordée après livraison')),
  format('AV-%s-%s', :year, lpad((:av_a + 1)::text, 4, '0')),
  'avoir numéroté AV-AAAA-NNNN'
);
select throws_ok(
  format('select public.issue_credit_note(%L, %L, 30001, %L)', :av_2, :inv_1, 'Trop'),
  'CB422', null, 'l''avoir ne dépasse pas le reste à créditer'
);
reset role;
select throws_ok(
  format('delete from public.credit_notes where id = %L', :av_1),
  '42501', null, 'un avoir ne se supprime pas'
);

select * from finish();
rollback;
