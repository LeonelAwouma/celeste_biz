-- Données FICTIVES de développement : deux entreprises isolées.
-- Mot de passe de tous les comptes : Motdepasse123
--   alice@exemple.test — propriétaire de « Atelier Alice » (couture)
--   sam@exemple.test   — employé (staff) de « Atelier Alice »
--   bob@exemple.test   — propriétaire de « Délices de Bob » (traiteur)

do $$
declare
  v_users constant jsonb := '[
    {"id": "a1111111-1111-4111-8111-111111111111", "email": "alice@exemple.test", "name": "Alice"},
    {"id": "a2222222-2222-4222-8222-222222222222", "email": "sam@exemple.test",   "name": "Sam"},
    {"id": "b1111111-1111-4111-8111-111111111111", "email": "bob@exemple.test",   "name": "Bob"}
  ]';
  v_user jsonb;
begin
  for v_user in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (v_user ->> 'id')::uuid, 'authenticated', 'authenticated',
      v_user ->> 'email',
      extensions.crypt('Motdepasse123', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('display_name', v_user ->> 'name'),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), (v_user ->> 'id')::uuid, v_user ->> 'id',
      jsonb_build_object('sub', v_user ->> 'id', 'email', v_user ->> 'email', 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

insert into public.businesses (id, owner_user_id, name, slug, profession_key, city)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111',
   'Atelier Alice', 'atelier-alice', 'couture', 'Douala'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111',
   'Délices de Bob', 'delices-de-bob', 'catering', 'Yaoundé');

insert into public.business_members (business_id, user_id, role)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'owner');

insert into public.business_settings (business_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000001');

-- Clients et catalogue fictifs
insert into public.customers (id, business_id, name, phone_e164, notes, marketing_consent)
values
  ('c1a00000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Mireille Ngo', '+237677000101', 'Préfère les essayages le samedi.', true),
  ('c1a00000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Paul Etoga', '+237699000102', null, false),
  ('c1a00000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Cliente de passage', null, null, false),
  ('c1b00000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Société Kamga', '+237655000201', 'Commandes mensuelles pour le personnel.', false);

insert into public.catalog_items (id, business_id, kind, name, category, price_mode, price, unit, position)
values
  ('ca100000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'service', 'Robe sur mesure', 'Femme', 'from', 25000, 'pièce', 1),
  ('ca100000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'service', 'Retouche simple', 'Retouches', 'fixed', 2500, 'pièce', 1),
  ('ca100000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'service', 'Tenue de mariage', 'Femme', 'quote', null, null, 2),
  ('cb100000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'product', 'Gâteau d''anniversaire', 'Pâtisserie', 'from', 15000, 'gâteau', 1);

-- Commandes fictives (dates relatives à la réinitialisation de la base).
insert into private.order_counters (business_id, year, last_value)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', extract(year from now() at time zone 'Africa/Douala')::int, 3),
  ('bbbbbbbb-0000-4000-8000-000000000001', extract(year from now() at time zone 'Africa/Douala')::int, 1);

insert into public.orders (id, business_id, customer_id, code, status, profession_key, profession_version,
  details, production_step, due_at, assignee_id, notes, created_by, created_at, closed_at)
values
  ('0da00000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c1a00000-0000-4000-8000-000000000001',
   format('CMD-%s-0001', extract(year from now() at time zone 'Africa/Douala')), 'in_progress', 'couture', 1,
   '{"garment_type": "robe", "fabric_source": "client", "measurements": {"tour_poitrine": 92, "tour_taille": 74, "tour_hanches": 100}, "style_notes": "Robe longue en wax, manches bouffantes."}',
   'assemblage', now() + interval '2 days', 'a2222222-2222-4222-8222-222222222222',
   'Tissu déposé le lundi.', 'a1111111-1111-4111-8111-111111111111', now() - interval '5 days', null),
  ('0da00000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c1a00000-0000-4000-8000-000000000002',
   format('CMD-%s-0002', extract(year from now() at time zone 'Africa/Douala')), 'ready', 'couture', 1,
   '{"garment_type": "retouche"}', null, now() - interval '1 day', null, null,
   'a1111111-1111-4111-8111-111111111111', now() - interval '3 days', null),
  ('0da00000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c1a00000-0000-4000-8000-000000000001',
   format('CMD-%s-0003', extract(year from now() at time zone 'Africa/Douala')), 'closed', 'couture', 1,
   '{"garment_type": "ensemble"}', null, now() - interval '10 days', null, null,
   'a1111111-1111-4111-8111-111111111111', now() - interval '20 days', now() - interval '9 days'),
  ('0db00000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'c1b00000-0000-4000-8000-000000000001',
   format('CMD-%s-0001', extract(year from now() at time zone 'Africa/Douala')), 'confirmed', 'catering', 1,
   '{"event_date": "2026-12-12T15:00", "delivery_mode": "livraison", "portions": 40}', null,
   now() + interval '7 days', null, null, 'b1111111-1111-4111-8111-111111111111', now() - interval '1 day', null);

insert into public.order_items (business_id, order_id, position, catalog_item_id, name, unit, quantity, unit_price)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0da00000-0000-4000-8000-000000000001', 0,
   'ca100000-0000-4000-8000-000000000001', 'Robe sur mesure', 'pièce', 1, 35000),
  ('aaaaaaaa-0000-4000-8000-000000000001', '0da00000-0000-4000-8000-000000000002', 0,
   'ca100000-0000-4000-8000-000000000002', 'Retouche simple', 'pièce', 2, 2500),
  ('aaaaaaaa-0000-4000-8000-000000000001', '0da00000-0000-4000-8000-000000000003', 0,
   null, 'Ensemble pagne', 'pièce', 1, 25000),
  ('bbbbbbbb-0000-4000-8000-000000000001', '0db00000-0000-4000-8000-000000000001', 0,
   'cb100000-0000-4000-8000-000000000001', 'Gâteau d''anniversaire', 'gâteau', 2, 18000);

insert into public.payments (id, business_id, order_id, method, amount, paid_on, reference, recorded_by, created_at)
values
  ('0ea00000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   '0da00000-0000-4000-8000-000000000001', 'mobile_money', 15000, (now() - interval '5 days')::date,
   'MP241020.1532.A12345', 'a1111111-1111-4111-8111-111111111111', now() - interval '5 days'),
  ('0ea00000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   '0da00000-0000-4000-8000-000000000003', 'cash', 25000, (now() - interval '9 days')::date,
   null, 'a1111111-1111-4111-8111-111111111111', now() - interval '9 days');

insert into public.order_events (business_id, order_id, actor_id, type, to_status, created_at)
select business_id, id, created_by, 'created', 'confirmed', created_at from public.orders;

select private.recompute_order(id) from public.orders;

-- Devis de démonstration (Phase 6) : un devis envoyé, en attente de réponse.
insert into private.document_counters (business_id, prefix, year, last_value)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'DEV', extract(year from now() at time zone 'Africa/Douala')::int, 1);

insert into public.quotes (id, business_id, customer_id, code, status, valid_until, conditions, sent_at, created_by, created_at)
values
  ('0fa00000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c1a00000-0000-4000-8000-000000000002',
   format('DEV-%s-0001', extract(year from now() at time zone 'Africa/Douala')), 'sent',
   (now() at time zone 'Africa/Douala')::date + 10, 'Acompte de 50 % à la commande. Délai : 10 jours.',
   now() - interval '2 days', 'a1111111-1111-4111-8111-111111111111', now() - interval '2 days');

insert into public.quote_items (business_id, quote_id, position, catalog_item_id, name, unit, quantity, unit_price)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '0fa00000-0000-4000-8000-000000000001', 0,
   'ca100000-0000-4000-8000-000000000001', 'Robe sur mesure', 'pièce', 2, 35000),
  ('aaaaaaaa-0000-4000-8000-000000000001', '0fa00000-0000-4000-8000-000000000001', 1,
   null, 'Broderie col et manches', 'pièce', 2, 6000);

update public.quotes q
set subtotal = t.s, total = t.s
from (select quote_id, sum(line_net) as s from public.quote_items group by quote_id) t
where q.id = t.quote_id;
