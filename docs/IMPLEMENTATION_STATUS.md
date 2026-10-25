# État d'implémentation — Céleste Biz

Référence : `CAHIER_DES_CHARGES_CELESTE_BIZ.md` §11 (plan) et §17 (définition
de terminé). Mettre à jour ce fichier à la fin de chaque phase.

## Checklist des phases

| Phase | Intitulé                                         | Statut      |
| ----- | ------------------------------------------------ | ----------- |
| 0     | Audit / cadrage du dépôt                         | ✅ terminée |
| 1     | Fondations UX et structure de projet             | ⏭ suivante  |
| 2     | Supabase Auth + isolement multi-entreprises      | à faire     |
| 3     | Onboarding et profils métiers                    | à faire     |
| 4     | Clients et catalogue                             | à faire     |
| 5     | Commandes et acomptes manuels                    | à faire     |
| 6     | Devis + facturation (émission sous feature flag) | à faire     |
| 7     | Tableau « Aujourd'hui »                          | à faire     |
| 8     | Portail client privé (**premier pilote**)        | à faire     |
| 9     | Site web métier optionnel                        | à faire     |
| 10    | WhatsApp sans automatisation, liens de campagne  | à faire     |
| 11    | Exports, supervision, qualité de production      | à faire     |
| 12    | Pilotage terrain, optimisation réseau            | à faire     |
| 13    | Paiements en ligne (feature flag)                | à faire     |
| 14    | WhatsApp Business Cloud API (feature flag)       | à faire     |
| 15    | Offline navigateur (facultatif)                  | à faire     |
| 16    | Abonnements Céleste Biz                          | à faire     |

## Feature flags

| Variable                       | Défaut  | Rôle                                     |
| ------------------------------ | ------- | ---------------------------------------- |
| `FEATURE_FISCAL_INVOICE_ISSUE` | `false` | Émission fiscale définitive des factures |
| `FEATURE_ONLINE_PAYMENTS`      | `false` | Paiements en ligne via PSP               |
| `FEATURE_WHATSAPP_API`         | `false` | WhatsApp Business Cloud API / chatbot    |
| `FEATURE_OFFLINE_DRAFTS`       | `false` | Brouillons hors ligne navigateur         |

Les flags sont déclarés dans `.env.example` ; leur lecture côté serveur sera
implémentée à la première phase qui en a besoin.

---

## Phase 0 — Audit / cadrage du dépôt

**Date :** 2026-10-25

### Audit de l'existant

- Dépôt `LeonelAwouma/celeste_biz` : un seul commit (`Initial commit`)
  contenant uniquement `LICENSE` (MIT). Aucun code, migration ni dépendance à
  préserver.
- Environnement : Node.js 22.22.0, npm 10.9.4.

### Réalisé

- Initialisation Next.js **16.4.3** (App Router, React 19.3, TypeScript
  strict) via `create-next-app`, contenu de démonstration retiré.
- Page d'accueil minimale en français (`lang="fr"`), polices système (pas de
  Google Fonts) pour limiter les données mobiles.
- Scripts : `lint`, `typecheck` (`next typegen && tsc --noEmit`), `test`
  (Vitest), `format` / `format:check` (Prettier), `build`, `check`.
- ESLint (config Next.js core-web-vitals + TypeScript) + `eslint-config-prettier`.
- `.env.example` sans valeur secrète ; `.gitignore` ignore `.env*` sauf
  l'exemple.
- Documentation : `README.md` (démarrage, scripts, règles de contribution),
  `docs/adr/0001-architecture.md`, ce fichier ; copie du cahier des charges et
  de `CLAUDE.md` dans le dépôt.
- Tests unitaires : hygiène `.env.example` (pas de secret, rien de secret en
  `NEXT_PUBLIC_`, flags désactivés), aucun `.env` réel versionné, rendu de la
  page d'accueil.

### Tests exécutés et résultats

| Commande               | Résultat                                 |
| ---------------------- | ---------------------------------------- |
| `npm run lint`         | ✅ aucun avertissement                   |
| `npm run typecheck`    | ✅                                       |
| `npm run test`         | ✅ 2 fichiers, 5 tests                   |
| `npm run format:check` | ✅                                       |
| `npm run build`        | ✅ routes `/` et `/_not-found` statiques |
| `npm run start` + curl | ✅ page servie, `<html lang="fr">`       |

### Sécurité / tenancy

- Aucun secret commité (vérifié par test). Pas encore de données ni de
  Supabase : la tenancy est traitée en Phase 2.

### Limites et décisions

- Pas de CI GitHub Actions pour l'instant (à ajouter en Phase 11, ou plus tôt
  si souhaité).
- Push : `CLAUDE.md` demande de ne pas pousser sans consigne. Le propriétaire
  a validé le 2026-10-25 le push de chaque phase sur la branche de travail,
  sans ouverture de PR.
- `AGENTS.md` est généré et maintenu par Next.js (`next dev`) ; il est
  conservé tel quel.

### Prochaine phase

**Phase 1 — Fondations UX** : Tailwind + shadcn/ui, layout mobile 360 px,
page d'accueil marketing, navigation (Aujourd'hui, Commandes, Clients,
Factures, Catalogue, Mon site, Paramètres), design tokens, composants
loading/error/empty, routes réservées, tests de base.
