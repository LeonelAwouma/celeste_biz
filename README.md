# Céleste Biz

Plateforme SaaS **100 % web** de gestion commerciale pour les commerçants et
prestataires (lancement au Cameroun) : commandes, clients, acomptes, devis,
factures et suivi client par lien privé. Le site web est **facultatif**.

- Source de vérité fonctionnelle : [`CAHIER_DES_CHARGES_CELESTE_BIZ.md`](./CAHIER_DES_CHARGES_CELESTE_BIZ.md)
- Règles de travail : [`CLAUDE.md`](./CLAUDE.md)
- Avancement des phases : [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md)
- Décisions d'architecture : [`docs/adr/`](./docs/adr/)

## Stack

Next.js (App Router) + React + TypeScript, Supabase (PostgreSQL, Auth,
Storage, RLS), hébergement Vercel. Pas de Django, pas d'application native,
pas d'IA générative dans le MVP.

## Démarrer en local

Prérequis : Node.js 22 ou plus (voir `.nvmrc`) et npm.

```bash
npm ci
cp .env.example .env.local   # facultatif tant que Supabase n'est pas branché (Phase 2)
npm run dev                  # http://localhost:3000
```

## Scripts de validation

| Commande               | Rôle                                             |
| ---------------------- | ------------------------------------------------ |
| `npm run lint`         | ESLint (règles Next.js + TypeScript)             |
| `npm run typecheck`    | Génération des types de routes puis `tsc`        |
| `npm run test`         | Tests unitaires Vitest (`tests/unit`)            |
| `npm run format:check` | Vérification Prettier (`npm run format` corrige) |
| `npm run build`        | Build de production Next.js                      |
| `npm run check`        | Enchaîne toutes les vérifications ci-dessus      |

Les scripts `test:e2e` (Playwright) et `supabase test db` (pgTAP/RLS) seront
ajoutés aux phases qui en ont besoin.

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
