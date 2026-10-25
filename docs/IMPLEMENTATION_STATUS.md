# État d'implémentation — Céleste Biz

Référence : `CAHIER_DES_CHARGES_CELESTE_BIZ.md` §11 (plan) et §17 (définition
de terminé). Mettre à jour ce fichier à la fin de chaque phase.

## Checklist des phases

| Phase | Intitulé                                         | Statut      |
| ----- | ------------------------------------------------ | ----------- |
| 0     | Audit / cadrage du dépôt                         | ✅ terminée |
| 1     | Fondations UX et structure de projet             | ✅ terminée |
| 2     | Supabase Auth + isolement multi-entreprises      | ⏭ suivante  |
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

---

## Phase 1 — Fondations UX et structure de projet

**Date :** 2026-10-25 · décisions : `docs/adr/0002-ui-foundations.md`

### Réalisé

- Tailwind CSS 4 + design tokens (clair/sombre) dans `app/globals.css`,
  composants shadcn/ui `Button`, `Card`, `Skeleton` (`components/ui/`),
  icônes `lucide-react`.
- Page d'accueil marketing (`app/(marketing)/page.tsx`) : promesse, 6 atouts,
  site présenté comme facultatif, liens inscription/connexion.
- Coquille de l'espace commerçant (`components/dashboard/app-shell.tsx`) :
  en-tête, barre latérale (≥ md), onglets en bas (mobile) avec « Plus »,
  bouton « + Nouvelle commande » persistant, lien d'évitement, bandeau
  « Connexion requise » hors ligne.
- Espaces sous `/dashboard/*` : today, orders, orders/new, customers,
  invoices, catalog, website, settings, quotes, payments, more — avec états
  vides didactiques ; `/dashboard` redirige vers « Aujourd'hui ».
- `loading.tsx` (squelette), `error.tsx` (Réessayer), `not-found.tsx` en
  français.
- Routes réservées : `/login`, `/signup`, `/reset-password` (annonce de
  disponibilité prochaine, pas de faux formulaire), `/sites/[slug]` et
  `/suivi/[token]` en 404 (aucune information révélée).
- Script `test:e2e` (Playwright 1.63, profils `mobile-360` et `desktop`),
  inclus dans `npm run check`.

### Tests exécutés et résultats

| Commande               | Résultat                                             |
| ---------------------- | ---------------------------------------------------- |
| `npm run lint`         | ✅                                                   |
| `npm run typecheck`    | ✅                                                   |
| `npm run test`         | ✅ 4 fichiers, 18 tests                              |
| `npm run format:check` | ✅                                                   |
| `npm run build`        | ✅ 21 pages (statiques + 2 routes réservées en PPR)  |
| `npm run test:e2e`     | ✅ 15 tests (5 ignorés car propres à l'autre profil) |

Couverture E2E : pas de défilement horizontal à 360 px sur l'accueil et les
11 espaces, onglet actif (`aria-current`), cibles tactiles ≥ 44 px,
navigation via « Plus », bouton « Nouvelle commande », lien d'évitement au
clavier, 404 sur un jeton de suivi inconnu, barre latérale sur grand écran.
Contrôle visuel par captures (360 px et 1280 px).

### Sécurité / tenancy

- Aucune donnée ni authentification encore : l'espace `/dashboard` est
  public et ne contient que des états vides. Protection en Phase 2.
- Espace commerçant et suivi marqués `noindex`.

### Limites

- Registre shadcn inaccessible depuis l'environnement : composants écrits à
  la main selon les modèles shadcn (voir ADR-0002).
- Pas d'audit Lighthouse ni de test sur appareil réel : à faire au pilotage
  (Phase 12), aucun chiffre de performance n'est annoncé.
- Le bascule thème sombre suit uniquement la préférence système.

### Prochaine phase

**Phase 2 — Supabase Auth + isolement multi-entreprises** : nécessite un
projet Supabase (URL + clés) ou, à défaut, Supabase CLI en local (Docker)
pour les migrations, la RLS et les tests pgTAP.
