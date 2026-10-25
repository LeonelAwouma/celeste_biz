# Céleste Biz

Plateforme SaaS **100 % web** de gestion commerciale pour les commerçants et
prestataires (lancement au Cameroun) : commandes, clients, acomptes, devis,
factures et suivi client par lien privé. Le site web est **facultatif**.

- Source de vérité fonctionnelle : [`CAHIER_DES_CHARGES_CELESTE_BIZ.md`](./CAHIER_DES_CHARGES_CELESTE_BIZ.md)
- Règles de travail : [`CLAUDE.md`](./CLAUDE.md)
- Avancement des phases : [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md)
- Décisions d'architecture : [`docs/adr/`](./docs/adr/)

## Stack

Next.js (App Router) + React + TypeScript, Tailwind CSS + shadcn/ui, Supabase (PostgreSQL, Auth,
Storage, RLS), hébergement Vercel. Pas de Django, pas d'application native,
pas d'IA générative dans le MVP.

## Démarrer en local

Prérequis : Node.js 22 ou plus (voir `.nvmrc`), npm et Docker (pour
Supabase en local).

```bash
npm ci
npm run db:start             # Supabase local (Postgres, Auth, Mailpit) + migrations + seed
cp .env.example .env.local   # puis renseigner l'URL et la clé « publishable »
                             # affichées par `npx supabase status`
npm run dev                  # http://localhost:3000
```

Sans Supabase, l'application démarre quand même : les pages de connexion
indiquent que l'authentification n'est pas configurée.

**Comptes fictifs du seed** (mot de passe `Motdepasse123`) :
`alice@exemple.test` (propriétaire, Atelier Alice), `sam@exemple.test`
(employé, Atelier Alice), `bob@exemple.test` (propriétaire, Délices de Bob).
Les e-mails envoyés en local (confirmation, mot de passe oublié) sont lisibles
dans Mailpit : http://127.0.0.1:54324.

## Brancher un projet Supabase hébergé

1. Appliquer les migrations : `npx supabase link --project-ref <ref>` puis
   `npx supabase db push` (ne pas exécuter `seed.sql` en production).
2. Variables Vercel : `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`.
3. Auth → URL Configuration : _Site URL_ = URL de l'application, et
   `<URL>/auth/confirm` dans les _Redirect URLs_.
4. Auth → Email : activer la confirmation d'adresse, mot de passe de
   8 caractères minimum avec lettres et chiffres, et reprendre les modèles
   `supabase/templates/confirmation.html` et `recovery.html` (liens vers
   `/auth/confirm` avec `token_hash`).
5. Configurer un SMTP de production (l'envoi intégré de Supabase est limité).

## Scripts de validation

| Commande                   | Rôle                                             |
| -------------------------- | ------------------------------------------------ |
| `npm run lint`             | ESLint (règles Next.js + TypeScript)             |
| `npm run typecheck`        | Génération des types de routes puis `tsc`        |
| `npm run test`             | Tests unitaires Vitest (`tests/unit`)            |
| `npm run format:check`     | Vérification Prettier (`npm run format` corrige) |
| `npm run test:db`          | Tests pgTAP (RLS, isolation entre entreprises)   |
| `npm run test:integration` | Vérifs contre Supabase local (profils métiers)   |
| `npm run build`            | Build de production Next.js                      |
| `npm run test:e2e`         | Playwright, profils mobile 360 px et bureau      |
| `npm run check`            | Enchaîne toutes les vérifications ci-dessus      |

`npm run test:db` et `npm run test:e2e` nécessitent Supabase local démarré
(`npm run db:start`). `npm run test:e2e` construit puis démarre l'application
sur le port 3100 ; `npm run db:reset` remet la base dans l'état du seed.

## Règles de contribution

1. **Une phase à la fois**, dans l'ordre du cahier des charges (§11). Une
   phase n'est terminée que si ses critères d'acceptation et la « définition
   de terminé » (§17) sont satisfaits.
2. Avant chaque commit : `npm run check` doit réussir. Les limites
   d'environnement sont documentées, jamais masquées.
3. Mettre à jour `docs/IMPLEMENTATION_STATUS.md` à chaque phase, et ajouter un
   ADR dans `docs/adr/` pour tout choix d'architecture.
4. **Aucun secret** dans le dépôt : seules les clés listées dans
   `.env.example` existent, sans valeur. La clé de service Supabase n'est
   jamais préfixée `NEXT_PUBLIC_`.
5. Multi-tenant : tout accès aux données est autorisé côté serveur **et** par
   RLS ; un `business_id` venant du navigateur ne suffit jamais.
6. Montants en `numeric` SQL / décimal côté serveur, jamais en `float` JS.
7. Intégrations externes (paiement, WhatsApp API, facturation fiscale,
   offline) derrière feature flags, désactivées par défaut, avec mocks en
   développement.
8. Messages de commit au format Conventional Commits (`feat:`, `fix:`,
   `chore:`…).
