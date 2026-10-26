# État d'implémentation — Céleste Biz

Référence : `CAHIER_DES_CHARGES_CELESTE_BIZ.md` §11 (plan) et §17 (définition
de terminé). Mettre à jour ce fichier à la fin de chaque phase.

## Checklist des phases

| Phase | Intitulé                                         | Statut      |
| ----- | ------------------------------------------------ | ----------- |
| 0     | Audit / cadrage du dépôt                         | ✅ terminée |
| 1     | Fondations UX et structure de projet             | ✅ terminée |
| 2     | Supabase Auth + isolement multi-entreprises      | ✅ terminée |
| 3     | Onboarding et profils métiers                    | ✅ terminée |
| 4     | Clients et catalogue                             | ✅ terminée |
| 5     | Commandes et acomptes manuels                    | ✅ terminée |
| 6     | Devis + facturation (émission sous feature flag) | ✅ terminée |
| 7     | Tableau « Aujourd'hui »                          | ✅ terminée |
| 8     | Portail client privé (**premier pilote**)        | ✅ terminée |
| 9     | Site web métier optionnel                        | ✅ terminée |
| 10    | WhatsApp sans automatisation, liens de campagne  | ✅ terminée |
| 11    | Exports, supervision, qualité de production      | ✅ terminée |
| 12    | Pilotage terrain, optimisation réseau            | ⏭ suivante  |
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

Les flags sont déclarés dans `.env.example` ; chacun est lu côté serveur à
la première phase qui en a besoin. `FEATURE_FISCAL_INVOICE_ISSUE` est lu
depuis la Phase 6 (`lib/env.ts`) et ne suffit pas seul : l'émission exige
aussi l'interrupteur plateforme en base (`private.platform_flags`,
désactivé), qui reste la barrière de référence.

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

---

## Phase 2 — Supabase Auth + isolement multi-entreprises

**Date :** 2026-10-25 · décisions : `docs/adr/0003-auth-and-tenancy.md`

### Réalisé

- Supabase local (CLI 2.122, Postgres 17) : `supabase/config.toml`
  (confirmation d'e-mail activée, mot de passe 8 caractères lettres+chiffres,
  modèles d'e-mail en français), migration
  `20261025000001_tenancy_foundation.sql`, `seed.sql` fictif (2 entreprises,
  3 comptes).
- Schéma : `profiles` (créé automatiquement à l'inscription), `businesses`,
  `business_members`, `audit_logs` ; RLS partout, fonctions d'autorisation
  privées, privilèges par colonne, RPC `create_business`, `set_member_role`,
  `revoke_member` (dernier propriétaire protégé, audit).
- Next.js : `proxy.ts` (rafraîchissement de session + redirections),
  inscription, confirmation par e-mail (`/auth/confirm`), connexion,
  déconnexion, mot de passe oublié, nouveau mot de passe, création
  d'entreprise minimale (`/onboarding`), sélecteur d'entreprise active dans
  l'en-tête, garde de l'espace `/dashboard` (session + entreprise).
- Formulaires accessibles (`components/forms/`), bouton désactivé pendant
  l'envoi, valeurs conservées après erreur (jamais le mot de passe),
  messages sans jargon.
- L'application se construit et démarre sans Supabase (message explicite).

### Tests exécutés et résultats

| Commande               | Résultat                                             |
| ---------------------- | ---------------------------------------------------- |
| `npm run lint`         | ✅                                                   |
| `npm run typecheck`    | ✅                                                   |
| `npm run test`         | ✅ 8 fichiers, 41 tests                              |
| `npm run format:check` | ✅                                                   |
| `npm run test:db`      | ✅ pgTAP 36/36                                       |
| `npm run build`        | ✅ avec et sans variables Supabase                   |
| `npm run test:e2e`     | ✅ 34 tests (5 ignorés car propres à l'autre profil) |

### Sécurité / tenancy vérifiées

- pgTAP : anon sans aucun accès ; Alice ne lit ni l'entreprise, ni les
  membres, ni l'audit, ni le profil de Bob, même avec l'ID ; écritures
  forgées vers B sans effet ou refusées ; `owner_user_id`/`status` non
  modifiables ; suppression et audit direct interdits ; staff sans
  administration ni lecture d'audit ; dernier propriétaire protégé ;
  révocation immédiate ; création atomique avec rôle `owner` et audit.
- E2E : redirection vers la connexion puis retour à la page demandée,
  `next` externe neutralisé, lien e-mail invalide refusé, message neutre
  sur mauvais mot de passe et sur mot de passe oublié, inscription →
  confirmation → entreprise → changement d'entreprise persistant,
  réinitialisation du mot de passe par e-mail, Bob ne voit jamais l'entreprise
  d'Alice même avec un cookie d'entreprise forgé, déconnexion.
- Aucune clé secrète utilisée ni exposée ; `.env.local` ignoré par Git.

### Limites et décisions à valider

- **Projet Supabase hébergé non branché** (choix du propriétaire) : tout est
  vérifié sur Supabase local. Procédure de branchement dans le README.
- Invitations de membres reportées à la Phase 3 (onboarding, « inviter un
  employé ») ; le changement de rôle et la révocation existent en base.
- Pas encore de limitation de débit propre à l'application : on s'appuie sur
  celle de Supabase Auth (à compléter en Phase 11).
- Fermeture/export de compte (F01) : reportés aux Phases 11 et 16.

### Prochaine phase

**Phase 3 — Onboarding et profils métiers** : choix du métier (couture,
traiteur, générique), registre versionné `profession_templates`, modules et
champs activés sans IA, invitation d'un employé, site toujours facultatif.

---

## Phase 3 — Onboarding et profils métiers

**Date :** 2026-10-25 · décisions : `docs/adr/0004-profession-templates.md`

### Réalisé

- Registre versionné des profils `couture`, `catering` (pâtisserie/traiteur)
  et `generic` en v1 : champs de commande (ex. type de vêtement, mesures
  privées, date d'essayage / date d'événement, portions, mode de remise),
  étapes de réalisation, libellés, modules proposés.
- Migration `20261025000002_professions_settings_invitations.sql` :
  `profession_templates` (immuable), `businesses.profession_version` + clé
  étrangère, `business_settings` (modules, image de marque, profil fiscal
  privé), nouvelles RPC `create_business` (métier + WhatsApp),
  `set_business_profession`, `list_business_members`, invitations
  (`create_invitation`, `revoke_invitation`, `get_invitation`,
  `accept_invitation`) avec jeton haché SHA-256, usage unique, 7 jours,
  réservé à l'adresse invitée.
- Onboarding : nom, choix du métier (cartes radio), ville, numéro WhatsApp
  normalisé E.164 (format camerounais accepté sans indicatif).
- « Aujourd'hui » : premiers pas adaptés au métier (« première prestation »,
  « première commande sur mesure »…), étapes facultatives (inviter, créer mon
  site) clairement indiquées, résumé de la configuration métier.
- Paramètres : informations de l'entreprise, métier, modules facultatifs,
  équipe (changement de rôle et retrait avec confirmation), invitations par
  lien à copier ou partager sur WhatsApp (aucun envoi automatique), lecture
  seule pour les non-propriétaires.
- Page `/invitation/[token]` : rien n'est révélé sans connexion ; parcours
  inscription → confirmation e-mail → retour à l'invitation → acceptation.
- Validation serveur des informations métier d'une commande prête pour la
  Phase 5.

### Tests exécutés et résultats

| Commande                   | Résultat                                              |
| -------------------------- | ----------------------------------------------------- |
| `npm run lint`             | ✅                                                    |
| `npm run typecheck`        | ✅                                                    |
| `npm run test`             | ✅ 10 fichiers, 74 tests                              |
| `npm run format:check`     | ✅                                                    |
| `npm run test:db`          | ✅ pgTAP 69/69 (2 fichiers)                           |
| `npm run test:integration` | ✅ registre TypeScript = table `profession_templates` |
| `npm run build`            | ✅                                                    |
| `npm run test:e2e`         | ✅ 50 tests (5 ignorés car propres à l'autre profil)  |

### Sécurité / tenancy vérifiées

- pgTAP : réglages d'une autre entreprise ni lisibles ni modifiables ;
  modules cœur non désactivables ; profil fiscal non modifiable ; staff sans
  modification ni changement de métier ; adresses e-mail des membres visibles
  du propriétaire seulement ; pas d'invitation au rôle propriétaire, ni dans
  une autre entreprise, ni d'un membre existant ; hachage du jeton illisible ;
  invitation refusée pour une autre adresse ; lien à usage unique.
- E2E : invitation forgée sans information, invitation ouverte avec un autre
  compte refusée, employé en lecture seule dans les paramètres.

### Limites et décisions à valider

- Les invitations ne sont pas envoyées par e-mail par l'application (pas de
  SMTP applicatif) : le propriétaire partage le lien lui-même, conformément
  au principe « pas d'envoi automatisé ».
- Le changement de métier n'a pas encore d'effet sur des commandes
  existantes (il n'y en a pas encore) ; la Phase 5 figera la version du
  profil dans chaque commande.
- Les pages Catalogue, Commandes, etc. restent des états vides jusqu'à leurs
  phases.

### Prochaine phase

**Phase 4 — Clients et catalogue** : CRUD clients (téléphone E.164, notes
privées, consentement marketing), catalogue (prix fixe / à partir de / sur
devis, archivage), recherche, droits par rôle et audit.

---

## Phase 4 — Clients et catalogue

**Date :** 2026-10-25 · décisions : `docs/adr/0005-customers-catalog-money.md`

### Réalisé

- Migration `20261025000003_customers_catalog.sql` : tables `customers` et
  `catalog_items`, privilèges par colonne, RLS, triggers de règles métier et
  d'audit, RPC `search_customers`, bucket privé `catalog-images` et ses
  politiques.
- Clients : liste avec recherche (nom ou chiffres du numéro), onglets
  Actifs / Archivés, « Voir la suite » (20 par page), bouton d'appel
  direct, fiche avec historique (vide jusqu'à la Phase 5), création et
  modification (téléphone normalisé, e-mail, notes internes, consentement
  marketing horodaté), avertissement de doublon par numéro, archivage et
  restauration avec confirmation.
- Catalogue : liste groupée par catégorie avec vignette et prix, recherche,
  archivés ; article avec type (service/produit), prix fixe / à partir de /
  sur devis, unité, catégorie (suggestions), description, ordre, visibilité
  interne ; photo réduite dans le navigateur puis vérifiée côté serveur.
- Montants FCFA : saisie souple, stockage décimal exact, affichage
  « 25 000 FCFA ».
- Interface adaptée au rôle : l'employé ajoute et modifie des clients, mais
  n'archive pas et consulte le catalogue en lecture seule.
- Données de démonstration : 3 clients et 3 articles pour l'atelier
  d'Alice, 1 client et 1 article pour Bob.
- Correctif transverse : la navigation est rendue sans onglet actif puis
  complétée derrière une frontière Suspense, condition pour les routes
  dynamiques (`/clients/[id]`) avec `cacheComponents`.

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 12 fichiers, 121 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 102/102 (3 fichiers)                        |
| `npm run test:integration` | ✅                                                   |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 62 tests (5 ignorés car propres à l'autre profil) |

### Sécurité / tenancy vérifiées

- pgTAP : clients et catalogue d'une autre entreprise ni lisibles, ni
  modifiables, ni recherchables ; pas de déplacement vers une autre
  entreprise ; pas de suppression ; employé sans archivage ni écriture au
  catalogue ; lecteur sans écriture ; consentement horodaté par le serveur ;
  audit sans contenu personnel ; jokers de recherche neutralisés ; bucket
  privé ; photos d'une autre entreprise ni lisibles ni déposables.
- E2E : faux fichier image refusé (contrôle de la signature), droits de
  l'employé dans l'interface, pagination sur un compte neuf (insertion sous
  RLS avec la session du propriétaire).

### Limites et décisions à valider

- Fusion de fiches clients reportée (nécessite commandes et paiements).
- Import CSV de clients non prévu au MVP (à confirmer).
- Historique client, solde et commandes : Phase 5.

### Prochaine phase

**Phase 5 — Commandes et acomptes manuels** : commande avec lignes figées
issues du catalogue, statuts et transitions contrôlées, numéro `CMD` unique
par entreprise, acomptes manuels et solde exacts, vues « En cours » et
« En retard ».

---

## Phase 5 — Commandes et acomptes manuels

**Date :** 2026-10-26 · décisions : `docs/adr/0006-orders-manual-payments.md`

### Réalisé

- Migration `20261026000001_orders_payments.sql` : `orders`, `order_items`
  (copie figée du catalogue, montants en colonnes générées),
  `order_events` (journal append-only), `payments`, table de référence des
  transitions, compteur `CMD-AAAA-NNNN`, fonctions transactionnelles et
  `list_orders` (filtres, recherche, pagination par clé).
- Nouvelle commande : client existant (recherche) ou fiche minimale,
  lignes depuis le catalogue ou libres (quantité décimale, remise, taxe),
  total estimé en direct, échéance date + heure, champs du métier
  (type de vêtement, mesures si module actif, date d'événement…),
  responsable, notes internes, acompte facultatif, option brouillon.
- Liste : En cours, En retard, À encaisser, Brouillons, Terminées ;
  recherche par numéro ou client ; solde et retard visibles.
- Fiche : montants (total, encaissé, reste), actions d'état selon le rôle,
  annulation avec motif, informations métier, lignes, encaissements
  (ajout, annulation avec motif), historique horodaté avec l'auteur.
- Modification : version contrôlée ; lignes figées après confirmation ;
  étape de réalisation pendant la confection/préparation.
- Fiche client : commandes récentes, solde dû, « Nouvelle commande ».
- Données de démonstration : 3 commandes chez Alice (en cours avec
  acompte, prête en retard, clôturée soldée), 1 chez Bob.

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 13 fichiers, 139 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 156/156 (4 fichiers)                        |
| `npm run test:integration` | ✅ profils métiers + transitions identiques en base  |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 72 tests (5 ignorés car propres à l'autre profil) |

### Critères d'acceptation (cahier §11, phase 5)

- Transitions invalides bloquées : pgTAP (`confirmée → livrée` refusée,
  rôle vérifié par transition, version périmée refusée).
- Calculs exacts : exemple avec quantité décimale, remise et taxe vérifié
  au centime en SQL et dans l'aperçu TypeScript.
- Doubles soumissions : même commande et même encaissement renvoyés, aucun
  doublon (pgTAP) ; bouton désactivé pendant l'envoi.
- `CMD` unique par entreprise : contrainte `unique (business_id, code)`,
  compteur atomique, numérotation propre à chaque entreprise (pgTAP).
- Aucun montant en virgule flottante : `numeric` en base, chaînes
  décimales et BigInt côté TypeScript.

### Sécurité / tenancy vérifiées

- pgTAP : aucune écriture directe ; commandes, lignes et listes d'une autre
  entreprise invisibles ; pas de client ni d'article d'une autre entreprise
  dans une commande ; responsable obligatoirement membre ; employé sans
  annulation de commande ni d'encaissement ; lecteur en lecture seule ;
  encaissement jamais supprimé ; pas d'encaissement au-delà du solde ni
  daté dans le futur ; commande clôturée non modifiable.
- E2E : commande d'une autre entreprise introuvable par URL.

### Limites et décisions à valider

- Le fuseau d'affichage est Africa/Douala (valeur par défaut des
  entreprises ; pas encore modifiable dans les paramètres).
- Fichiers privés attachés à une commande : non inclus (à confirmer avec le
  pilote ; le stockage privé par entreprise existe déjà pour le catalogue).
- Vue Kanban : non incluse, liste compacte filtrée à la place (§5.5).
- Remboursements : prévus comme opérations séparées (phases 6 et 13).

### Prochaine phase

**Phase 6 — Devis + module documentaire** : brouillons de devis, PDF,
acceptation, conversion en commande, factures en brouillon, reçus manuels
clairement marqués ; émission définitive derrière feature flag.

---

## Phase 6 — Devis et facturation (émission sous interrupteur)

**Date :** 2026-10-26 · décisions : `docs/adr/0007-quotes-invoices-documents.md`

### Réalisé

- Migration `20261026000002_quotes_invoices.sql` : `quotes`, `quote_items`,
  `invoices`, `invoice_items`, `credit_notes`, compteurs `DEV`, `FAC`, `AV`
  par entreprise et par année, profil de facturation (`fiscal_profile`),
  interrupteur plateforme `fiscal_invoice_issue` (désactivé), bucket privé
  `documents`, déclencheurs d'immuabilité des pièces émises.
- Devis (module facultatif « Devis ») : liste filtrée (en cours, acceptés,
  refusés ou expirés, tous), création et modification en brouillon avec le
  même éditeur de lignes que les commandes, validité (15 jours proposés),
  conditions imprimées, notes internes.
- Cycle du devis : brouillon → envoyé → accepté / refusé / expiré, retour en
  brouillon pour corriger, annulation avec motif (propriétaire ou
  gestionnaire). L'acceptation est **déclarée manuellement** : auteur, date
  et note de provenance enregistrés (`acceptance_source = manual`).
- Devis accepté → commande confirmée en un geste (lignes et prix copiés,
  date de remise facultative), idempotent ; lien conservé entre devis et
  commande.
- Partage : PDF du devis et lien `wa.me` avec un message prérempli
  (aucun envoi automatique).
- Factures : « Préparer une facture » depuis une commande (propriétaire ou
  gestionnaire) crée un **brouillon sans numéro** ; échéance, conditions,
  reprise des lignes de la commande, abandon du brouillon. Le PDF du
  brouillon porte le filigrane « Brouillon — non valable comme facture ».
- Émission définitive : bouton désactivé avec explication tant que la
  conformité n'est pas validée ; si elle est activée (variable + base) :
  numéro `FAC` attribué à l'émission, vendeur et acheteur figés, PDF
  archivé une seule fois avec son empreinte SHA-256, correction par avoir
  (`AV`) uniquement.
- Profil de facturation dans les paramètres (raison sociale, NIU, RCCM,
  régime, adresse, contacts, mentions) : saisi par le propriétaire, non
  vérifié par Céleste Biz, et dit comme tel.
- Reçu PDF pour chaque encaissement : « déclaré, non vérifié auprès de
  l'opérateur », « n'est pas une facture et n'a pas de valeur fiscale ».
- Fiche commande : section Facturation (brouillons et factures liés) et
  lien « Reçu PDF » par encaissement.
- Données de démonstration : un devis envoyé chez Alice (Paul Etoga,
  82 000 FCFA).

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 14 fichiers, 155 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 204/204 (5 fichiers)                        |
| `npm run test:integration` | ✅                                                   |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 84 tests (5 ignorés car propres à l'autre profil) |

Vérification manuelle supplémentaire en local, interrupteurs activés puis
désactivés : émission `FAC-2026-0003`, PDF archivé dans `documents`, deux
téléchargements à l'empreinte identique, avoir émis et archivé.

### Critères d'acceptation (cahier §11, phase 6)

- Totaux cohérents : calcul SQL au centime (remise, taxe 19,25 %) vérifié
  en pgTAP ; conversion devis → commande au même montant.
- PDF privés : routes authentifiées, en-tête `Cache-Control: private,
no-store`, bucket privé, lecture par les seuls membres ; 404 pour une
  autre entreprise (E2E).
- Numérotation atomique à l'émission : aucun numéro consommé tant que
  l'émission est refusée (pgTAP).
- Documents émis immuables : modification, suppression et changement de
  lignes refusés même au superutilisateur, sauf l'archivage unique du PDF.
- Corrections par avoir : montant borné au reste à créditer.
- Brouillon et émis clairement distingués (titre, filigrane, bandeau).

### Sécurité / tenancy vérifiées

- pgTAP : RLS sur les cinq tables, aucune écriture directe, devis et
  factures d'une autre entreprise invisibles et non modifiables, client
  d'une autre entreprise refusé, employé sans annulation de devis ni
  préparation de facture, profil de facturation réservé au propriétaire.
- E2E : devis d'une autre entreprise introuvable (page et PDF), employé
  sans « Préparer une facture » ni « Annuler le devis ».

### Limites et décisions à valider

- L'émission définitive reste **désactivée** : il faut une validation
  réglementaire (mentions obligatoires, éventuelle certification) avant
  d'activer l'interrupteur en base et la variable.
- Le lien client d'acceptation en ligne (`acceptance_source = link`) est
  prévu pour la Phase 8 (portail client).
- PDF en polices standard (Helvetica) : caractères hors Latin-1 remplacés.
- Pas de liste de factures par client ni d'export comptable (Phase 11).

### Prochaine phase

**Phase 7 — Tableau « Aujourd'hui »** : priorités du jour (à remettre, en
retard, à encaisser, devis sans réponse), actions rapides.

---

## Phase 7 — Tableau « Aujourd'hui » et alertes actionnables

**Date :** 2026-10-26 · décisions : `docs/adr/0008-today-dashboard.md`

### Réalisé

- Migration `20261026000003_dashboard.sql` : fonction `dashboard_summary`
  (une seule requête, réservée aux membres, bornée), index partiels sur les
  commandes ouvertes et les devis envoyés, filtres `soon` et `unassigned`
  ajoutés à `list_orders`.
- Écran « Aujourd'hui » : section « À faire » avec des alertes
  déterministes (en retard, à remettre sous 48 h, soldes en attente, devis
  envoyés sans réponse depuis 5 jours, commandes sans responsable si
  l'équipe compte plusieurs personnes). Chaque alerte affiche sa règle
  (dates, états), les 5 premiers dossiers avec leur échéance ou leur solde,
  et un lien vers la liste filtrée correspondante.
- « En chiffres » : commandes en cours, soldes à encaisser, encaissé sur
  7 jours et sur le mois (déclarés), devis sans réponse ; aucune marge ni
  bénéfice (coûts non saisis), mention explicite.
- Liste des commandes : onglet « Sous 48 h », filtre « Sans responsable ».
- « Premiers pas » reste affiché tant qu'aucune commande n'existe.
- Données de démonstration : le devis envoyé date de 6 jours.

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 15 fichiers, 161 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 228/228 (6 fichiers)                        |
| `npm run test:integration` | ✅                                                   |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 90 tests (5 ignorés car propres à l'autre profil) |

### Critères d'acceptation (cahier §11, phase 7)

- Alertes expliquées et associées aux vrais dossiers : pgTAP (dossier en
  retard listé avec échéance et état, devis trop récent non signalé,
  brouillon/annulée/livrée jamais en retard) et E2E (clic vers la commande,
  « Tout voir » vers la liste filtrée).
- Agrégats corrects : écarts mesurés en pgTAP après création de commandes
  contrôlées (total des soldes au franc près, encaissement annulé exclu).
- Aucune marge inventée : aucune clé de marge ou de bénéfice (pgTAP).
- Performance : 5 000 commandes ouvertes, calcul en moins de 300 ms
  (pgTAP ; ~18 ms mesurés en local).

### Sécurité / tenancy vérifiées

- Non-membre et anonyme refusés (42501) ; dossiers d'une autre entreprise
  absents (pgTAP et E2E avec Bob).

### Limites et décisions à valider

- Seuils fixes (48 h, 5 jours) : réglables en paramètre SQL, pas encore
  dans les paramètres de l'entreprise.
- Pas de notifications ni de rappels envoyés au client (Phase 10, liens
  `wa.me` uniquement).

### Prochaine phase

**Phase 8 — Portail client privé** (premier pilote) : lien de suivi à jeton
haché, expiration et révocation, pièces partageables.

---

## Phase 8 — Portail client privé (premier pilote utilisable)

**Date :** 2026-10-26 · décisions : `docs/adr/0009-customer-tracking.md`

### Réalisé

- Migration `20261026000004_tracking_links.sql` : table `tracking_links`
  (seul le SHA-256 du jeton est stocké, colonne non lisible même par les
  membres), expiration de 1 à 365 jours, révocation, compteur de
  consultations ; limite de tentatives (`private.rate_limits`, fenêtres de
  10 minutes) ; fonctions `create_tracking_link`, `revoke_tracking_link`,
  `get_tracking_view` et `get_tracking_document` (seules portes d'entrée
  anonymes).
- Fiche commande : section « Suivi client » (propriétaire, gérant,
  employé ; pas pour un brouillon). Le lien n'est montré qu'à sa création,
  avec « Copier » et « WhatsApp » (`wa.me`, message prérempli). Durée au
  choix, montants et pièces partageables ou non. Un nouveau lien révoque
  l'ancien. Le commerçant voit les dates, le nombre de consultations et
  peut révoquer.
- Page `/suivi/<jeton>` sans compte, pensée pour 360 px : état et étapes
  avec les libellés du métier, étape de fabrication, dernière mise à jour,
  échéance indicative, articles, total / déjà réglé / reste à payer (si
  autorisé), historique des états (sans motif ni auteur), reçus et
  factures émises en PDF (si autorisé), bouton WhatsApp vers le commerce.
  Lien expiré ou révoqué : message clair et contact, aucune donnée.
- En-têtes sur `/suivi/*` : `Referrer-Policy: no-referrer`,
  `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`.

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 16 fichiers, 168 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 258/258 (7 fichiers)                        |
| `npm run test:integration` | ✅                                                   |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 92 tests (5 ignorés car propres à l'autre profil) |

### Critères d'acceptation (cahier §11, phase 8)

- Aucun client n'accède au dossier d'un autre : le jeton ne résout qu'une
  commande ; un reçu d'une autre commande est refusé (pgTAP) ; Bob ne crée
  ni ne révoque de lien sur les commandes d'Alice (pgTAP).
- Jeton non devinable : 256 bits aléatoires (`gen_random_bytes`), seul son
  condensat est en base, jeton inconnu ou mal formé = même réponse
  « introuvable », 30 échecs par client bloquent 10 minutes (pgTAP).
- Lien expiré ou révoqué rejeté, sans aucune donnée de commande (pgTAP,
  E2E après révocation).
- Documents privés protégés : PDF seulement via un jeton valide autorisant
  les pièces, réponse `no-store` ; 404 après révocation (E2E). Aucune note
  interne ni détail de fabrication exposé (pgTAP et E2E).

### Sécurité / tenancy vérifiées

- Table illisible pour `anon` ; `token_hash` illisible pour tous les rôles
  applicatifs ; les fonctions anonymes sont `SECURITY DEFINER` et ne
  renvoient que des champs choisis.
- Contexte E2E vierge (aucun cookie) pour la consultation client.

### Limites et décisions à valider

- Les PDF partagés sont produits à la volée depuis les instantanés figés
  (facture) ou la commande (reçu), sans URL signée de stockage : celle-ci
  exigerait `SUPABASE_SECRET_KEY` côté serveur, non fourni. L'original
  archivé de la facture reste la référence côté commerçant.
- La clé de limitation est le condensat de l'adresse IP transmise par
  l'hébergeur (`x-forwarded-for`) : plusieurs clients derrière une même
  passerelle opérateur partagent la limite d'échecs (une requête valide
  n'est pas comptée comme échec). À revoir avec les mesures du pilote.
- Une page de suivi inconnue est diffusée en flux : elle affiche
  « Page introuvable » mais le statut HTTP est fixé avant la vérification
  du jeton ; elle n'est jamais indexée (`noindex`).
- Le lien n'est pas réaffichable (condensat seul) : pour le renvoyer, le
  commerçant en crée un nouveau.

### Prochaine phase

**Phase 9 — Site web métier optionnel** : modèles couture, traiteur et
générique, éditeur simple, prévisualisation, publication explicite,
`/sites/[slug]`, contact WhatsApp.

---

## Phase 9 — Site web métier facultatif

**Date :** 2026-10-26 · décisions : `docs/adr/0010-optional-websites.md`

### Réalisé

- Migration `20261026000005_websites.sql` : table `websites` (un site par
  entreprise : brouillon versionné, médias, instantané publié), fonctions
  `create_website`, `save_website`, `set_website_media`, `publish_website`,
  `unpublish_website` (propriétaire ou gestionnaire), `get_public_site` et
  `is_public_site_asset` (anonymes), bucket privé `site-images`, lecture
  anonyme du stockage limitée aux fichiers d'un instantané publié.
- « Mon site » : « Créer mon site » ou « Plus tard », trois modèles
  (atelier de couture, pâtisserie et traiteur, générique) qui fixent
  l'ordre des sections et les intitulés ; éditeur simple (adresse,
  accroche, présentation, horaires, quartier, couleur parmi 5 teintes
  lisibles, prestations publiques du catalogue, prix affichés ou « Prix sur
  demande ») ; logo, bannière et galerie de 8 photos réduites dans le
  navigateur.
- Aperçu du brouillon (même rendu que le site publié, réservé à l'équipe),
  publication explicite avec confirmation, état « modifications non
  publiées », retrait du site.
- Page publique `/sites/<adresse>` : accroche, prestations et prix figés à
  la publication, galerie, présentation, horaires, zone approximative,
  bouton WhatsApp (`wa.me`, message prérempli selon le modèle). Rendu mis
  en cache par adresse et invalidé à la publication, au retrait, au
  changement de modules ou de métier.
- Données de démonstration : site publié de « Délices de Bob ».

### Tests exécutés et résultats

| Commande                   | Résultat                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm run lint`             | ✅                                                   |
| `npm run typecheck`        | ✅                                                   |
| `npm run test`             | ✅ 17 fichiers, 177 tests                            |
| `npm run format:check`     | ✅                                                   |
| `npm run test:db`          | ✅ pgTAP 295/295 (8 fichiers)                        |
| `npm run test:integration` | ✅                                                   |
| `npm run build`            | ✅                                                   |
| `npm run test:e2e`         | ✅ 97 tests (6 ignorés car propres à l'autre profil) |

### Critères d'acceptation (cahier §11, phase 9)

- Aucune publication implicite : rien n'est public avant « Publier »
  (pgTAP, E2E) ; un brouillon modifié, un prix de catalogue changé ou une
  nouvelle adresse restent invisibles jusqu'à la publication suivante
  (pgTAP, E2E) ; seule la version prévisualisée peut être publiée
  (verrou de version).
- Contenu d'une entreprise inaccessible depuis la mauvaise URL : une
  adresse ne résout que l'instantané de son site ; adresse d'une autre
  entreprise ou réservée refusée ; prestation d'une autre entreprise ou
  privée refusée ; photo non publiée jamais servie (pgTAP, E2E).
- Changement de prix catalogue sans effet sur les commandes passées (déjà
  vrai depuis la Phase 5 : lignes copiées) ni sur le site publié (pgTAP).

### Sécurité / tenancy vérifiées

- Brouillons illisibles pour `anon` et pour les autres entreprises ;
  employé et lecteur en lecture seule (pgTAP, E2E).
- L'instantané publié ne contient que nom, ville, numéro WhatsApp de
  l'entreprise, textes, photos et prestations choisies : aucune donnée
  client ni note interne (pgTAP).
- Module « Mon site » désactivé ou entreprise inactive : site hors ligne.

### Limites et décisions à valider

- Adresse `…/sites/<adresse>` uniquement ; sous-domaines et domaines
  personnels après la mise en production (cahier §5.11).
- Photos servies par `/sites/<adresse>/media/…` avec un cache d'une heure :
  après un retrait, une photo déjà en cache navigateur ou CDN peut rester
  visible jusqu'à une heure (la page, elle, est invalidée immédiatement).
- Pas d'éditeur visuel libre ni de sections personnalisées : trois modèles
  à sections fixes, par choix de simplicité.
- Les photos non référencées sont supprimées après chaque envoi,
  publication ou retrait.

### Prochaine phase

**Phase 10 — WhatsApp sans automatisation et traçabilité de campagne** :
liens `wa.me` et messages préremplis, codes campagne, partage de devis et
de suivi, métriques de clics si mesurables sans suivi abusif.

---

## Phase 10 — WhatsApp sans automatisation et liens de campagne

**Date :** 2026-10-26 · décisions : `docs/adr/0011-whatsapp-campaign-links.md`

### Réalisé

- Migration `20261026000006_campaigns.sql` : `campaign_links` (code lisible
  unique par entreprise, identifiant public aléatoire, canal, article
  facultatif, message prérempli, archivage), `campaign_clicks_daily`
  (compteurs par jour uniquement), `order_campaigns` (provenance déclarée
  d'une commande) ; fonctions `create_campaign_link`,
  `update_campaign_link`, `set_order_campaign`, `list_campaigns` et
  `open_campaign_link` (anonyme).
- Lien court `/c/<identifiant>` : redirection 302 vers `wa.me` sur le
  numéro WhatsApp de l'entreprise, message prérempli terminé par
  « Réf. CODE » ; campagne archivée ou numéro absent : page « Lien
  indisponible » (410) ; robots d'aperçu redirigés mais non comptés.
- Écrans « Campagnes » (menu « Plus ») : liste active/archivée avec clics
  et commandes, création (code proposé à partir du nom, message proposé à
  partir de l'article, aperçu du message reçu), page de campagne (lien à
  copier ou partager, clics totaux, 7 jours, histogramme 14 jours,
  commandes et montant déclarés, modification et archivage).
- Fiche commande : « Provenance » (campagne choisie d'après la référence
  lue dans la conversation) et bouton WhatsApp vers le client. Fiche
  client : boutons WhatsApp et Appeler. Facture émise : « Envoyer par
  WhatsApp » (message prêt, PDF à joindre). Devis et suivi : déjà
  partageables depuis les phases 6 et 8.
- Données de démonstration : numéro WhatsApp d'Alice, campagne
  `ROBE-WAX` (`/c/demoRobeWax1`) avec quelques clics et une commande.

### Tests exécutés et résultats

| Commande                   | Résultat                                              |
| -------------------------- | ----------------------------------------------------- |
| `npm run lint`             | ✅                                                    |
| `npm run typecheck`        | ✅                                                    |
| `npm run test`             | ✅ 18 fichiers, 183 tests                             |
| `npm run format:check`     | ✅                                                    |
| `npm run test:db`          | ✅ pgTAP 324/324 (9 fichiers)                         |
| `npm run test:integration` | ✅                                                    |
| `npm run build`            | ✅                                                    |
| `npm run test:e2e`         | ✅ 103 tests (6 ignorés car propres à l'autre profil) |

### Critères d'acceptation (cahier §11, phase 10)

- Le client ouvre le bon numéro et la bonne référence : redirection vers
  `wa.me/<numéro de l'entreprise>` avec le message et « Réf. CODE »
  vérifiée en pgTAP et en E2E (lien créé et lien de démonstration).
- Fonctionne sans API WhatsApp : uniquement des liens `wa.me` ; aucune
  lecture de conversation ; la provenance est déclarée par l'équipe.
- Métriques sans suivi abusif : compteur par jour, ni IP, ni cookie, ni
  agent utilisateur enregistrés (structure vérifiée en pgTAP) ; aperçus
  automatiques exclus ; plafond de comptage par fenêtre de 10 minutes.

### Sécurité / tenancy vérifiées

- Campagnes, clics et provenances illisibles pour `anon` et les autres
  entreprises ; création et modification réservées au propriétaire et au
  gestionnaire ; provenance par l'équipe (employé inclus) ; campagne
  d'une autre entreprise refusée (pgTAP).
- Déclarer une provenance ne change pas la date de mise à jour visible
  sur le suivi client.

### Limites et décisions à valider

- Les clics restent approximatifs (aperçus non reconnus, clics répétés
  d'une même personne comptés) : présentés comme indicatifs.
- Le code d'une campagne n'est plus modifiable après création (il figure
  dans les publications) ; le message peut changer.
- Pas d'export ni de comparaison entre campagnes (Phase 11).

### Prochaine phase

**Phase 11 — Exports, supervision et qualité de production** : CSV
sécurisés, supervision, audit, quotas, sauvegardes, configuration
Vercel/Supabase, documentation utilisateurs.

---

## Phase 11 — Exports, supervision et qualité de production

**Date :** 2026-10-26 · décisions : `docs/adr/0012-exports-observability.md`

### Réalisé

- Exports CSV (`/dashboard/exports`, propriétaire et gestionnaire) :
  clients, catalogue, commandes, encaissements, devis, factures ; période
  facultative ; UTF-8 avec BOM, séparateur « ; », virgule décimale ;
  formules neutralisées ; 20 000 lignes au maximum ; filtre explicite par
  entreprise en plus de la RLS ; export inscrit au journal et limité à
  30 par 10 minutes.
- Journal consultable (`/dashboard/audit`) : actions lisibles, auteur,
  détails sans jeton ni contenu, pagination.
- Quotas par entreprise (`consume_quota`) : envois de photos (catalogue et
  site) limités à 60 par 10 minutes.
- Supervision : `instrumentation.ts` journalise chaque erreur serveur en
  JSON masqué (jetons, requêtes, JWT, clés, e-mails, téléphones) avec son
  `digest`, affiché à l'utilisateur comme code à transmettre au support ;
  sonde `GET /api/health` (application + base, sans donnée).
- En-têtes de sécurité sur toutes les pages (`nosniff`, `DENY` en cadre,
  `Referrer-Policy`, `Permissions-Policy`, HSTS).
- `npm run check:secrets` (aucun `.env` ni clé versionnés), ajouté en tête
  de `npm run check` ; CI GitHub Actions (`.github/workflows/ci.yml`) :
  contrôles statiques, build, pgTAP, intégration et E2E sur Supabase local.
- Documentation : `docs/DEPLOYMENT.md` (Vercel, Supabase, variables),
  `docs/OPERATIONS.md` (supervision, sauvegardes et test de restauration,
  quotas, coûts, incidents), `docs/GUIDE_UTILISATEUR.md`.

### Tests exécutés et résultats

| Commande                   | Résultat                                              |
| -------------------------- | ----------------------------------------------------- |
| `npm run check:secrets`    | ✅ aucun secret (289 fichiers)                        |
| `npm run lint`             | ✅                                                    |
| `npm run typecheck`        | ✅                                                    |
| `npm run test`             | ✅ 19 fichiers, 192 tests                             |
| `npm run format:check`     | ✅                                                    |
| `npm run test:db`          | ✅ pgTAP 336/336 (10 fichiers)                        |
| `npm run test:integration` | ✅                                                    |
| `npm run build`            | ✅                                                    |
| `npm run test:e2e`         | ✅ 113 tests (6 ignorés car propres à l'autre profil) |

La CI GitHub Actions est ajoutée mais n'a pas encore tourné sur GitHub au
moment de ce commit : son premier passage est à vérifier.

### Critères d'acceptation (cahier §11, phase 11)

- Exports limités à l'entreprise : E2E (aucune donnée de « Délices de
  Bob » dans l'export d'Alice), employé refusé (403), pgTAP (rôles,
  autre entreprise).
- Anti-injection CSV : unitaires (= + - @ tabulation, retour chariot) et
  E2E (client nommé `=HYPERLINK(…)` exporté avec apostrophe).
- Erreurs instrumentées : `onRequestError` + masquage testé en unitaires ;
  code d'erreur affiché à l'utilisateur.
- Secrets absents : `check:secrets` dans `npm run check` et en CI.
- Scripts CI verts : `npm run check` complet vert en local.

### Limites et décisions à valider

- Aucun service d'alerte externe (Sentry, etc.) n'est branché : compte à
  choisir ; le point d'intégration est `instrumentation.ts`.
- Sauvegardes : dépendent de l'offre Supabase choisie ; procédure et test
  de restauration documentés, non exécutés faute de projet hébergé.
- Console d'administration plateforme (cahier F16) et accès assisté du
  support : non réalisés, à cadrer avec les offres (Phase 16).
- Export complet à la fermeture du compte : possible type par type ;
  archive unique (ZIP avec PDF) à prévoir.

### Prochaine phase

**Phase 12 — Pilotage terrain et optimisation réseau** : mesures d'usage
respectueuses de la vie privée, collecte des retours, améliorations UX,
évaluation de l'offline navigateur.
