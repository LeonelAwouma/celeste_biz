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
