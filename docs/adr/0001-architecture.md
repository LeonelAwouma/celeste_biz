# ADR-0001 — Architecture générale

- **Statut :** accepté
- **Date :** 2026-10-25

## Contexte

Céleste Biz est un SaaS multi-entreprises, mobile-first, destiné à des
commerçants disposant souvent de smartphones d'entrée de gamme et d'un réseau
intermittent. Le cahier des charges fixe la stack et exclut Django, les
applications natives, les microservices et l'IA générative au MVP.

## Décision

1. **Une seule application Next.js (App Router), React, TypeScript**, en mode
   strict, déployée sur Vercel (offre commerciale adaptée, pas Hobby).
2. **Supabase** pour Auth, PostgreSQL, Storage et RLS. Accès via
   `supabase-js` / `@supabase/ssr` et **migrations SQL versionnées** ; pas
   d'ORM supplémentaire (pas de Prisma).
3. **Logique métier côté serveur** (Server Actions / Route Handlers) exposée
   derrière des services testables sous `features/<domaine>/`. Les opérations
   atomiques (numérotation, transitions, paiements) passent par des fonctions
   Postgres transactionnelles.
4. **Multi-tenant par `business_id`** sur toutes les entités commerciales,
   contrôlé deux fois : fonction d'autorisation serveur commune et politiques
   RLS fondées sur `business_members`. Tests croisés obligatoires.
5. **Pas de processus serveur permanent** au MVP ; webhooks via Route
   Handlers ou Supabase Edge Functions, tâches planifiées via Supabase Cron.
6. **Intégrations externes derrière des interfaces** (`PaymentProvider`,
   `MessagingProvider`, `FiscalInvoiceProvider`) et des feature flags
   désactivés par défaut ; implémentations mock en développement.
7. **Sobriété réseau** : polices système (aucune police web téléchargée),
   pas de bibliothèque installée sans usage, pagination par curseur, images
   compressées.
8. **Outillage qualité** : ESLint (config Next.js) + Prettier, `tsc`, Vitest
   pour l'unitaire ; Playwright (E2E) et pgTAP (RLS) ajoutés à leurs phases.

## Conséquences

- Un seul déploiement à maintenir ; le rendu des sites publics est
  multi-tenant (pas un déploiement par commerçant).
- La sécurité repose sur la double barrière serveur + RLS : chaque phase qui
  touche aux données doit livrer ses tests d'isolation.
- Next.js 16 introduit des changements d'API : se référer à
  `node_modules/next/dist/docs/` (voir `AGENTS.md`) plutôt qu'à des habitudes
  antérieures.
