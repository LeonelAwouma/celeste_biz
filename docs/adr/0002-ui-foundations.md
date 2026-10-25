# ADR-0002 — Fondations de l'interface

- **Statut :** accepté
- **Date :** 2026-10-25

## Contexte

La Phase 1 pose le design system et la coquille de l'espace commerçant.
Cible : smartphones Android d'entrée de gamme (écran de 360 px), réseau
intermittent, utilisateurs aux compétences numériques hétérogènes.

## Décision

1. **Tailwind CSS v4** (PostCSS) et **design tokens** en variables CSS dans
   `app/globals.css` (convention shadcn/ui), thème clair et sombre selon la
   préférence système. Polices système uniquement.
2. **shadcn/ui** : composants copiés dans `components/ui/` (Button, Card,
   Skeleton) et configurés par `components.json`. Le registre
   `ui.shadcn.com` étant inaccessible depuis l'environnement de
   développement, les composants ont été écrits à la main selon les modèles
   shadcn ; les suivants pourront être ajoutés avec `npx shadcn add` quand
   le réseau le permet. Seuls les composants utilisés sont présents.
3. **Navigation** : la navigation recommandée (§3) en barre latérale sur
   grand écran ; sur mobile, une barre d'onglets en bas avec 4 entrées
   (Aujourd'hui, Commandes, Clients, Factures) et « Plus » qui regroupe
   Catalogue, Mon site (facultatif), Paramètres, Devis et Encaissements.
   Sept onglets ne sont pas lisibles à 360 px.
4. **« + Nouvelle commande »** toujours visible : bouton flottant au-dessus
   des onglets sur mobile, dans l'en-tête sur grand écran.
5. **États** : composants `EmptyState` (didactique), `ErrorState`
   (`role="alert"`, bouton Réessayer branché sur `retry()` de Next.js 16),
   `LoadingState` (squelette + libellé accessible) et `OfflineBanner`
   (« Connexion requise » quand le navigateur est hors ligne, aucune
   promesse de sauvegarde).
6. **Accessibilité** : `lang="fr"`, lien d'évitement « Aller au contenu »,
   `aria-current` sur l'onglet actif, focus visible, cibles tactiles de
   44 px minimum, `prefers-reduced-motion` respecté pour les squelettes.
7. **URL** : espaces en anglais sous `/dashboard/*` (arborescence du cahier),
   `/login`, `/signup`, `/reset-password` réservées à la Phase 2,
   `/sites/[slug]` (Phase 9) et `/suivi/[token]` (Phase 8) répondent 404 tant
   qu'elles ne sont pas implémentées, sans rien révéler.

## Conséquences

- Les pages des espaces sont des états vides pour l'instant ; chaque phase
  les remplace par de vraies données.
- Le nom d'entreprise de l'en-tête est un emplacement fixe jusqu'au
  sélecteur d'entreprise active (Phase 2).
- Tests E2E Playwright sur un profil mobile 360 px et un profil bureau.
