# ADR-0003 — Authentification et isolation multi-entreprises

- **Statut :** accepté
- **Date :** 2026-10-25

## Contexte

Critère bloquant de la Phase 2 : un utilisateur d'une entreprise A ne peut ni
lire ni modifier les données d'une entreprise B, même en forgeant un
identifiant. Un utilisateur peut appartenir à plusieurs entreprises.

## Décision

### Base de données (barrière de référence)

- Tables `profiles`, `businesses`, `business_members` (rôle `owner`,
  `manager`, `staff`, `viewer` ; statut `active`/`revoked`) et `audit_logs`
  (append-only).
- **RLS activée sur toutes les tables**, aucun privilège pour `anon`.
- Fonctions d'autorisation `private.has_business_role()` /
  `private.is_business_member()` en `SECURITY DEFINER` dans un schéma non
  exposé par l'API : les politiques les appellent, ce qui évite la récursion
  sur `business_members`.
- Privilèges par colonne : seuls `name`, `city`, `whatsapp_phone_e164` et
  `timezone` d'une entreprise sont modifiables (par son propriétaire) ;
  `owner_user_id`, `status`, `slug` ne le sont pas.
- **Pas d'INSERT/DELETE direct** sur les entreprises et les membres : les
  écritures passent par des fonctions RPC (`create_business`,
  `set_member_role`, `revoke_member`) qui vérifient le rôle, protègent le
  dernier propriétaire et journalisent dans la même transaction.
- Tests pgTAP (`supabase/tests/database/`) qui jouent chaque rôle et tentent
  les accès croisés.

### Application

- `@supabase/ssr` : session en cookies, rafraîchie par `proxy.ts` (Next.js 16)
  qui fait aussi des redirections optimistes (non connecté → `/login?next=`).
- Couche d'accès aux données (`lib/auth/session.ts`,
  `features/businesses/active-business.ts`) : chaque lecture revérifie la
  session (`getClaims`) et passe par la RLS ; aucune clé secrète n'est
  utilisée par l'application.
- **Entreprise active** : cookie httpOnly de préférence ; il ne donne aucun
  droit, l'adhésion active est revérifiée à chaque requête (un cookie forgé
  vers une autre entreprise est ignoré).
- Liens e-mail (confirmation, réinitialisation) vers `/auth/confirm` avec
  `token_hash` vérifié côté serveur (fonctionne même si le lien est ouvert
  sur un autre appareil).
- Messages d'erreur neutres (connexion, inscription, mot de passe oublié)
  pour ne pas révéler l'existence d'un compte ; paramètre `next` limité aux
  chemins internes.
- Avec Cache Components, toute lecture de session est rendue à la demande
  derrière une frontière `<Suspense>` ; la coquille reste statique.
- Matrice des rôles dupliquée en TypeScript (`lib/permissions/roles.ts`) pour
  l'affichage et les contrôles d'actions ; la base reste la référence.

## Conséquences

- Toute nouvelle table commerciale devra : porter `business_id`, activer la
  RLS avec ces fonctions, révoquer `anon`, et ajouter ses tests croisés.
- Les invitations de membres sont reportées à la Phase 3 (onboarding).
- La confirmation d'e-mail doit être activée sur le projet hébergé (voir
  README).
