# CÉLESTE BIZ — CAHIER DES CHARGES FONCTIONNEL ET TECHNIQUE

**Version :** 1.0 — 25 octobre 2026  
**Statut :** référence d'implémentation à faire valider progressivement  
**Public cible :** Claude Code et développeurs du projet  
**Marché de lancement :** Cameroun ; architecture extensible à d'autres pays africains  
**Produit :** plateforme SaaS **100 % web** de gestion commerciale adaptée au métier, avec site professionnel facultatif et intégration WhatsApp progressive  
**Stack fixée :** Next.js (React, TypeScript), Supabase (PostgreSQL, Auth, Storage, RLS), Vercel. **Pas de Django.**

---

## 0. Mission et règles absolues pour l'agent de développement

Tu agis comme architecte logiciel et développeur full-stack senior. Implémente **Céleste Biz** selon ce document et le fichier `CLAUDE.md`. L'objectif est de produire une application fonctionnelle, sécurisée, testée et livrable, **par incréments petits et vérifiables**.

### Obligations

1. Avant de coder, inspecter le dépôt existant, les versions, les migrations, les scripts et l'état Git. Ne pas écraser du travail existant.
2. Tenir à jour `docs/IMPLEMENTATION_STATUS.md` avec la checklist des phases et les choix d'architecture (ADR sous `docs/adr/`).
3. **Une phase à la fois** : concevoir, implémenter, tester, documenter, exécuter les vérifications, faire un **commit Git local** explicite si les tests passent. Ne pas créer de pull request par défaut. Ne pas pousser sur GitHub sans demande explicite.
4. Débloquer la phase suivante uniquement lorsque les critères d'acceptation de la précédente sont satisfaits. Si une ressource extérieure manque (identifiants Supabase, domaine, compte Meta, marchand Mobile Money), implémenter des interfaces, des mocks et un environnement sandbox ; **ne jamais inventer des identifiants ou des validations**. Signaler le blocage.
5. Pas de fausses intégrations silencieuses, de paiements marqués comme validés sans vérification, de factures déclarées fiscalement certifiées sans dispositif autorisé, de conversation WhatsApp automatisée non autorisée en production.
6. Écrire du code maintenable et modulaire, avec migrations SQL versionnées, tests et journalisation maîtrisée.
7. Toutes les données commerciales d'une entreprise doivent être isolées de celles des autres entreprises, y compris les médias, exports, URL privées et actions d'administration.
8. Proposer un produit **mobile-first, francophone, en FCFA**, lisible sur smartphones Android d'entrée de gamme et réseaux intermittents.
9. **Ne pas ajouter d'IA au MVP.** Les modèles de site, formulaires métiers et scripts de conversation fonctionnent avec des configurations déterministes.
10. Ne jamais prétendre avoir réalisé une vérification sans avoir exécuté la commande correspondante ; rapporter les limites de l'environnement.

### Exclusions fermes

- Pas d'application native Android/iOS et pas de publication sur Play Store/App Store.
- Pas de Django, pas de microservices obligatoires, pas de backend Node persistant pour le cœur du MVP.
- Pas de marketplace/annuaire de prestataires, de système de classement de professionnels ni de commission imposée sur leurs ventes.
- Pas de génération de domaine `.cm` offerte dans l'offre de base.
- Pas de constructeur visuel libre type Wix, pas de chatbot IA génératif, pas d'assistant vocal.
- Pas de wallet interne, crédit, prêt, séquestre ou garde de fonds au lancement.
- Pas de dépendance à OpenWA pour le fonctionnement du MVP commercial.

---

## 1. Vision, problème et positionnement

### 1.1 Promesse

**« Continuez à vendre comme vous en avez l'habitude. Céleste Biz vous aide à organiser vos commandes, retrouver vos soldes, facturer et suivre vos clients, sans vous obliger à créer un site web. »**

### 1.2 Problèmes à résoudre

- Informations clients dispersées entre WhatsApp, Facebook, appels, carnets et mémoires individuelles.
- Commandes oubliées ou détails perdus, notamment pour les prestations sur mesure.
- Acomptes, soldes et échéances difficiles à retrouver.
- Devis non suivis, délais de livraison ratés, relances non organisées.
- Temps répété pour répondre aux prix, disponibilités et suivi.
- Factures préparées manuellement, historique incomplet.
- Internet mobile limité, connexions instables, compétences numériques hétérogènes.

### 1.3 Distinction concurrentielle

Céleste Biz est **un outil appartenant fonctionnellement au professionnel** : les clients lui appartiennent, les ventes peuvent venir de partout et le site web est facultatif. Il n'oriente pas les clients vers d'autres professionnels, ne se présente pas comme intermédiaire obligé et ne vend pas prioritairement de la mise en relation.

### 1.4 Segment pilote

1. Couturiers et ateliers de confection ;
2. Pâtissiers et traiteurs sur commande ;
3. Vendeurs via Facebook/Instagram/WhatsApp ;
4. À terme, réparateurs, photographes, salons de coiffure et commerces de stock.

Lancer les **deux premiers templates métiers** « couture » et « pâtisserie/traiteur » ; les autres reposent sur le même noyau modulaire et arrivent après validation terrain.

### 1.5 Hypothèses à valider, pas à présenter comme faits

- Le suivi structuré réduit le temps nécessaire pour retrouver une commande ou son solde.
- Une part des commerçants acceptera un abonnement pour cet avantage.
- Les liens de suivi et factures améliorent l'expérience des clients.
- Un parcours de vente WhatsApp connecté augmente la conversion dans certains secteurs.
- La réduction du trafic et des saisies évite une augmentation significative du forfait Internet.

---

## 2. Acteurs, accès et droits

| Acteur | Accès | Actions |
|---|---|---|
| Visiteur | Public | Découvrir Céleste Biz, visiter le site public d'une entreprise publiée |
| Propriétaire d'entreprise (`owner`) | Authentifié | Paramétrer entreprise, membres, offres, commandes, finances, site, abonnement |
| Gestionnaire (`manager`) | Authentifié, autorisé | Commandes, clients, catalogue, devis, suivi, certains exports |
| Employé (`staff`) | Authentifié, autorisé | Créer/mettre à jour commandes et statuts selon habilitation, sans accès aux paramètres de facturation de l'abonnement |
| Lecteur (`viewer`) | Authentifié, autorisé | Consulter les éléments explicitement autorisés, sans modification |
| Client final | Généralement sans compte | Passer une demande, accepter un devis, consulter un suivi privé, télécharger ses propres pièces |
| Administrateur Céleste (`platform_admin`) | Accès distinct, renforcé | Modération, support autorisé, offre, incidents et état technique, sans accès libre aux données clients |
| Fournisseur externe | Serveur-à-serveur | Paiement et messagerie par webhooks signés et contrôlés |

Exiger la vérification du rôle **à chaque opération côté serveur** et dans la base via RLS. Un propriétaire peut posséder plusieurs entreprises. Un utilisateur peut appartenir à plusieurs entreprises. Un `business_id` envoyé par le client ne suffit jamais comme autorisation.

---

## 3. Principes UX et accessibilité

- Français par défaut ; architecture prête pour anglais ; devise XAF (FCFA) ; fuseau `Africa/Douala` à l'affichage ; timestamps stockés en UTC.
- Mobile-first, menus simples, gros éléments tactiles, contrastes suffisants, états de chargement explicites.
- Navigation principale recommandée : **Aujourd'hui**, **Commandes**, **Clients**, **Factures**, **Catalogue**, **Mon site (facultatif)**, **Paramètres**.
- Bouton rapide persistant « + Nouvelle commande » ; maximum d'informations essentielles en une vue compacte ; pas de tableau de bord surchargé.
- Afficher « À faire aujourd'hui » plutôt qu'une avalanche de graphiques.
- Aucun parcours métier n'exige de site web ou de chatbot connecté.
- Chaque montant indique explicitement XAF ; nombres formatés en français, dates au format local.
- États vides didactiques, aide contextuelle, messages d'erreur utilisables, pas de jargon technique côté commerçant.
- Une demande de devis complexe ne doit pas être tarifée automatiquement si elle nécessite validation humaine.
- Les actions critiques (émission de facture, remboursement, suppression, changement de rôle) exigent une confirmation explicite.

---

## 4. Parcours utilisateur de référence

### P1. Onboarding du prestataire

1. Le commerçant visite Céleste Biz, crée un compte, confirme son identité par la méthode Auth configurée.
2. Il renseigne nom commercial, métier, ville, contact, logo facultatif, fuseau/horaire, informations fiscales selon son statut.
3. Le moteur charge le **profil métier** : modules et champs spécialisés (sans IA).
4. Il peut ajouter son premier service ou produit puis enregistrer une commande.
5. Il découvre le tableau « Aujourd'hui » et peut **ignorer totalement la création de site**.
6. Il invite éventuellement un employé.

**Acceptation :** en moins de 10 minutes lors d'un essai encadré, un nouveau compte doit pouvoir créer une entreprise, une prestation et une commande simple (objectif à mesurer).

### P2. Commande reçue directement à l'atelier (sans chatbot)

1. Le client passe physiquement ou appelle.
2. Le commerçant sélectionne un client existant ou crée une fiche minimale.
3. Il crée une commande avec produits/services, prix, quantité, délai et notes.
4. Il enregistre un acompte manuel avec type, montant, date et référence facultative, statut **« déclaré, non vérifié par API »**.
5. Le système calcule montant total, encaissements, solde et échéances.
6. Le commerçant actualise les statuts, puis prépare et émet un document après contrôle.

### P3. Vente issue d'un lien WhatsApp sans bot

1. Le commerçant publie une offre sur Facebook, Instagram ou un statut WhatsApp.
2. La publication contient un lien `wa.me` avec texte prérempli et code de campagne facultatif.
3. Le client converse **directement** avec le professionnel.
4. Le professionnel transforme la demande en commande depuis Céleste Biz ; aucune lecture automatique de la conversation n'est supposée.
5. Il partage manuellement un devis, un lien de suivi ou une facture générés sur la plateforme.

### P4. Vente avec chatbot officiel (phase ultérieure)

1. Le commerçant connecte **son** numéro professionnel via un parcours officiel éligible.
2. Le client arrive dans WhatsApp depuis un lien de publication ou via un message direct.
3. Le bot indique clairement son caractère automatisé et présente des menus déterministes (offre, disponibilité, commande, aide humaine).
4. Le bot identifie l'entreprise et la campagne ; collecte uniquement les informations nécessaires.
5. Si prix calculable et conditions connues : devis généré. Sinon : demande `pending_review`, validation du prestataire requise.
6. L'acceptation crée une commande, puis un lien de paiement uniquement si le paiement intégré est activé.
7. Après **confirmation serveur** par le prestataire de paiement, émission du justificatif de paiement adapté.
8. Le client peut consulter son lien privé de suivi ; à la clôture il accède à sa facture, aux conditions de garantie éventuelles et à une nouvelle demande.
9. Le client peut écrire « parler à une personne » ; le bot suspend son automatisation le temps de la reprise humaine.

**Important :** si le commerçant n'a pas Internet, le bot serveur peut traiter les messages courants, mais ne doit pas annoncer une validation humaine ou une réalisation non enregistrée. Le suivi expose l'heure de dernière mise à jour.

### P5. Client final, sans création de compte

- Le client reçoit une URL privée de suivi et, si nécessaire, un lien de confirmation ou de paiement.
- La page affiche entreprise, référence, résumé, montants pertinents, état, dernière mise à jour, documents autorisés.
- Elle ne révèle ni données d'autres clients, ni informations internes (marges, notes privées, identifiants personnels).
- Un lien peut expirer ou être révoqué ; mesures anti-énumération et anti-abus.

### P6. Litige ou annulation

- Une demande d'annulation suit une règle métier explicite.
- Aucun paiement réel ne peut être supprimé pour « faire disparaître » une transaction.
- Un éventuel remboursement nécessite une opération séparée, référencée et confirmée par le fournisseur.
- Le journal de changements permet de comprendre qui a modifié l'état de la commande et quand.

---

## 5. Périmètre fonctionnel, priorités et règles détaillées

### 5.1 F01 — Comptes, entreprise et accès (**MVP, P0**)

- Supabase Auth : e-mail/mot de passe et récupération de compte ; autres méthodes après tests de délivrabilité/coût.
- Plusieurs entreprises par utilisateur, sélection d'entreprise active.
- Invitations, acceptation, révocation, rôles `owner`, `manager`, `staff`, `viewer`.
- Paramètres de l'entreprise : métier, ville, logo, numéro WhatsApp professionnel, adresse (facultative), devise, fuseau.
- Profil fiscal optionnel, configuré sans présumer du régime d'imposition.
- Journal d'audit pour changements sensibles.
- Fermeture/export de compte à prévoir selon obligations légales et rétention nécessaire.

### 5.2 F02 — Moteur de configuration métier (**MVP, P0**)

- Registre versionné de `profession_templates` (ex. couture, traiteur, générique).
- Chaque profil déclare modules visibles, champs de prestation, états de workflow, libellés, modules facultatifs.
- Profil couture : commande sur mesure, prise de mesures facultatives/privées, acompte, date de livraison, étapes de confection.
- Profil traiteur : date/lieu d'événement, portions, logistique, acompte, statut de préparation/livraison.
- Profil générique : service/produit, demande, devis, commande, paiement, suivi.
- La configuration s'applique sans altérer la structure du noyau et sans migration par entreprise.
- Permettre l'ajustement manuel des modules ; jamais imposer un workflow incompatible.

### 5.3 F03 — Catalogue professionnel (**MVP, P0**)

- Ajouter/modifier/archiver un service ou produit, description courte, prix fixe/à partir de/sur devis, photo facultative.
- `active`, `visibility`, ordre d'affichage, regroupement par catégorie.
- Un prix ancien d'une commande ne doit **pas changer** lorsque le prix courant du catalogue change : figer des instantanés de lignes (`order_items`).
- Si un métier nécessite stock, activer seulement une gestion simple dans une phase ultérieure ; pas de caisse complexe au MVP.

### 5.4 F04 — CRM clients (**MVP, P0**)

- Création rapide nom/alias + téléphone optionnel ; notes séparées des données publiques.
- Normalisation des numéros camerounais au format E.164 quand fournis ; possibilité d'un client sans téléphone pour les ventes directes.
- Recherche, historique des commandes, devis et paiements, solde agrégé.
- Fusion de doublons uniquement avec écran de confirmation et piste d'audit.
- Consentement distinct pour notifications non essentielles / marketing.
- Aucune synchronisation automatique du carnet d'adresses sans consentement approprié.

### 5.5 F05 — Commandes et suivi (**MVP, P0**)

États génériques : `draft` → `pending_confirmation` → `confirmed` → `in_progress` → `ready` → `delivered` → `closed`, avec voies `cancelled` et `disputed`. Transitions configurables par métier, mais validées par le serveur.

- Code lisible unique par entreprise (ex. `CMD-2026-0042`) et identifiant UUID technique.
- Lignes, quantité, unité, prix et remises explicites ; taxes configurables, jamais codées en dur.
- Dates de promesse/échéance ; responsable interne ; notes métier ; fichiers privés limités et contrôlés.
- Historique immuable des transitions (acteur, horodatage, ancien/nouveau statut).
- Plusieurs encaissements pour une commande, solde calculé, pas de solde négatif non justifié.
- Interdiction des modifications arbitraires après clôture ; actions de correction séparées et journalisées.
- Vue mobile Kanban ou liste compacte ; filtres « Aujourd'hui », « En retard », « À encaisser ».

### 5.6 F06 — Devis (**MVP, P0**)

États : `draft` → `sent` → `accepted|rejected|expired`, avec `cancelled` documenté.

- Montants calculés côté serveur avec précision décimale ; jamais de `float` JS pour l'argent.
- Génération PDF HTML/PDF fiable ; stockage privé ; numéro de devis par entreprise ; date de validité et conditions.
- Consentement/acceptation du client horodaté lorsque recueilli via lien ; sinon acceptation marquée manuelle avec provenance.
- Conversion du devis accepté en commande avec copie **figée** des lignes.
- Devis sur mesure « à valider » : bot interdit de le finaliser sans approbation du commerçant.

### 5.7 F07 — Factures, reçus et avoirs (**MVP fonctionnel, conformité avant émission réelle**)

- **Gestion intégrée à la plateforme**, sans obligation d'outil externe.
- Documents distincts : devis, facture, reçu de paiement, avoir, facture d'acompte si appropriée au régime applicable.
- Gestion des brouillons ; émission définitive avec numérotation unique par entreprise et exercice, verrouillage des champs fiscaux/montants après émission.
- Corrections par avoir et nouvelle pièce appropriée, sans suppression d'une facture émise.
- Numéro, dates, identité vendeur/acheteur selon situation, lignes, totaux, conditions, paiements associés, mentions et taux **configurables**.
- Stocker instantané du profil fiscal et lignes lors de l'émission ; conserver le PDF lié et empreinte si pertinente.
- Export PDF et recherche ; historique des téléchargements sensible uniquement si justifié.
- État financier issu des écritures de paiement, pas modifiable par simple clic « payé » sans transaction/enregistrement correspondant.
- **Conformité Cameroun :** vérifier avec conseiller fiscal/autorités les exigences applicables à chaque régime et l'évolution de la facturation électronique ; laisser une frontière d'intégration (`FiscalInvoiceProvider`). Jusqu'à validation, ne jamais afficher « facture fiscalement certifiée » ni un cachet de l'administration.
- Si le module de facturation conforme n'est pas juridiquement validé, ouvrir en pilote **devis, pro forma ou brouillons identifiés comme tels** selon conseil applicable ; bloquer l'émission fiscale finale lorsque nécessaire.

### 5.8 F08 — Encaissements et paiements (**MVP manuel, intégration P1**)

- Méthodes : espèces, transfert Mobile Money déclaré, autre ; référence, date, montant, auteur, note.
- Distinguer `manual_declared`, `pending_provider`, `provider_verified`, `failed`, `refunded`, `cancelled`.
- En mode manuel, statut honnête : « enregistré manuellement », **pas** « vérifié par MTN/Orange ».
- Adaptateur `PaymentProvider` pour une passerelle disposant de capacités confirmées sur le marché camerounais ; environnement sandbox obligatoire.
- Webhook : vérifier authenticité et transaction via API quand applicable, contrôler identité marchand, entreprise, montant, devise, état et référence, idempotence et rejeu.
- Un webhook reçu deux fois ne doit jamais créditer une commande deux fois.
- Pour les paiements de clients finaux, faire créditer directement le compte marchand/partenaire approprié selon les conditions du prestataire ; **ne pas collecter des fonds tiers sur le compte de Céleste Corp** sans cadre juridique et contractuel adapté.
- Abonnements Céleste Biz et paiements commerciaux des commerçants = deux flux séparés.

### 5.9 F09 — Tableau « Aujourd'hui » et actions utiles (**MVP, P0**)

Indicateurs : commandes en cours, livraisons proches/en retard, devis en attente, total des soldes, encaissements sur période ; pas de « bénéfice » si coûts non renseignés.

Actions déterministes :
- « 3 commandes à livrer sous 48 h » ;
- « 4 soldes en attente » ;
- « 2 devis envoyés sans réponse depuis 5 jours » ;
- « 1 commande sans responsable attribué ».

Toujours afficher **le fondement de l'alerte** (dates/états) et un lien vers les dossiers concernés. Rappels client soumis aux autorisations et aux règles du canal.

### 5.10 F10 — Portail privé de suivi client (**MVP, P1**)

- Page web épurée consultable sur mobile sans compte, via token opaque longue entropie.
- Montrer uniquement infos autorisées, état, date de dernière mise à jour, échéance indicative, pièces partageables.
- Token **haché en base**, expiration et révocation ; anti-enumération, limites de requêtes.
- Téléchargement de fichiers via URL signées temporaires émises côté serveur après vérification du jeton.
- Messages explicites si lien périmé/révoqué ; renouvellement contrôlé par le prestataire.

### 5.11 F11 — Site web métier facultatif (**P1**)

- Lors de l'onboarding : action « Créer mon site » et « Plus tard ».
- Bibliothèque de 2 modèles initiaux + 1 générique, sections configurées par métier.
- Champs : nom, bannière, description, services, prix visibles, galerie, horaires, localisation approximative, contact, bouton WhatsApp.
- Personnalisation couleurs/logo/textes/images ; prévisualisation brouillon avant publication.
- URL MVP `celestebiz.example/sites/<slug>` (domaine réel à choisir plus tard).
- Sous-domaines `slug.domaine.tld` **après** mise en production et configuration wildcard ; domaine personnel raccordable ultérieurement, facturé séparément.
- Pas de déploiement Next.js par prestataire ; un rendu multi-tenant avec cache maîtrisé et invalidation après publication.
- Contenus personnels et informations privées **jamais** accessibles par la route publique.

### 5.12 F12 — WhatsApp sans chatbot (**MVP/P1**)

- Champ numéro WhatsApp métier et bouton `wa.me` (téléphone validé et texte encodé).
- Générateur de lien d'offre/campagne avec ID côté Céleste Biz ; le texte prérempli inclut une référence lisible.
- Préciser que `wa.me` **n'accorde aucun droit d'accès** aux messages de la conversation : saisie manuelle nécessaire en mode non connecté.
- Partage manuel de devis et liens de suivi, sans lancement d'envois automatisés depuis l'application.

### 5.13 F13 — Chatbot WhatsApp officiel (**P2, après validation produit et compte Meta**)

- Abstraction `MessagingProvider` : recevoir événement, normaliser, envoyer message, rechercher état, `human_handoff`.
- Implémentation production : plateforme officielle Meta via fournisseur éligible ; onboarding des entreprises si les conditions d'intégration le permettent.
- Moteur d'états : accueil → métier/offre → questions métier → récapitulatif → devis/validation → commande → acompte → suivi → transfert humain.
- Idempotence `provider_message_id`, isolation des sessions par `business_id` + numéro client, journal des événements.
- Respect des fenêtres d'assistance, templates autorisés, préférences du destinataire, coût par type de message et quotas.
- Messages sortants non essentiels uniquement avec consentement adapté ; permettre arrêt des communications.
- Limites : pas de négociation de prix inventée, pas de promesse de délai sans données, pas de confirmation de paiement non vérifiée.
- Suivi des coûts et plafonds par entreprise ; arrêt propre lorsque quota dépassé ; canal de reprise manuelle.
- **OpenWA :** au plus adaptateur de laboratoire isolé, désactivé par défaut en production ; aucune architecture critique fondée dessus.

### 5.14 F14 — Abonnements et facturation de la plateforme (**P1**)

- Offre gratuite de démonstration/pilote, niveaux payants *à définir après essais* ; ne pas figer les tarifs comme acquis.
- Matrice de fonctionnalités (`entitlements`) et quotas vérifiés côté serveur.
- Abonnement, période, statut, limite d'activité, renouvellement, suspension gracieuse, téléchargement des données.
- Paiements des abonnements séparés des paiements des clients des commerçants.
- Pas de coupure brutale empêchant de récupérer documents comptables ou données exportables.
- Journal des changements d'offres et communications transparentes.

### 5.15 F15 — Exports et portabilité (**MVP, P1**)

- Exports CSV UTF-8 (avec BOM si nécessaire pour Excel FR), protection contre injection de formules dans CSV.
- Données propres à l'entreprise : clients, catalogue, commandes, devis, factures, encaissements.
- Filtrage par période et contrôles de permissions ; export traçable.
- Export complet sous forme structurée à la fermeture du compte, sous réserve d'obligations de rétention.

### 5.16 F16 — Administration, observabilité, support (**P1**)

- Console distincte pour plateforme : compte actif, forfait, quotas, statuts d'intégration, tickets support, erreurs ; pas de lecture implicite de données privées.
- Support « accès assisté » uniquement sur action explicite, limité dans le temps, journalisé et révocable.
- Logs techniques sans tokens privés, numéros complets, clés secrètes ni contenus sensibles.
- Système d'alertes d'erreurs et suivi des coûts Vercel/Supabase/fournisseurs.

### 5.17 F17 — Expérience web faible consommation (**MVP + amélioration P2**)

**MVP :** application web réactive **connectée** ; compression d'images, cache HTTP, pagination, pas de vidéo en lecture auto, chargement à la demande, formulaires rapides, indication claire « connexion requise ».

**Après validation (P2) :** cache navigateur contrôlé, dernière consultation en lecture seule, puis éventuellement saisie hors ligne via IndexedDB + file d'attente synchronisée avec politique de conflits explicite. **Aucune application de magasin n'est requise.**

Règles de sécurité offline : éviter stockage persistant de documents fiscaux ou PII sensibles sans justification ; afficher « enregistré seulement sur cet appareil » ; ne jamais émettre une facture fiscale finale, confirmer un paiement externe ni promettre une synchronisation qui n'a pas eu lieu.

---

## 6. Contraintes techniques et choix recommandés

### 6.1 Architecture

- Un dépôt Git pour une application Next.js (App Router) utilisant React/TypeScript.
- Next.js Route Handlers ou Server Actions pour les cas nécessitant contrôle métier ; Supabase pour Auth, PostgreSQL, Storage, RLS.
- Supabase Edge Functions pour webhooks externes et services secrets lorsque cela simplifie le déploiement ; tâches planifiées avec Supabase Cron si nécessaire.
- Vercel héberge la partie Next.js **commercialement sur une offre appropriée** ; le plan Hobby est réservé aux usages personnels non commerciaux.
- Une seule application multi-tenant ; pas de processus serveur permanent obligatoire dans le MVP.
- Pas de Prisma requis : privilégier `supabase-js` et migrations SQL Supabase pour éviter une deuxième couche ORM inutile.
- Pas de Redis imposé au départ. Ajouter un composant seulement si le profilage le justifie.

### 6.2 Bibliothèques de base

| Usage | Solution proposée |
|---|---|
| React / framework | `next`, `react`, `typescript` |
| Styles | `tailwindcss`, `shadcn/ui`, `lucide-react` |
| Auth SSR | `@supabase/supabase-js`, `@supabase/ssr` |
| Validation | `zod`, `react-hook-form`, `@hookform/resolvers` |
| Dates | `date-fns` ou équivalent maintenu |
| Valeurs monétaires | décimales SQL `numeric`, calculs côté serveur avec `decimal.js` si nécessaire |
| Graphiques (facultatifs) | `recharts` |
| PDF | `@react-pdf/renderer` côté serveur ou génération contrôlée compatible runtime choisi |
| Génération de tests unitaires | `vitest`, `@testing-library/react` |
| Tests fonctionnels | `playwright` |
| Qualité | `eslint`, `prettier`, `tsc` |
| Migrations et tests DB | Supabase CLI, migrations SQL, pgTAP |
| PWA ultérieure | service worker et `dexie` uniquement après décision d'ajout |

Avant toute installation, vérifier les versions **actuelles compatibles entre elles**, la documentation et les licences. Ne pas installer de bibliothèques non utilisées.

### 6.3 Arborescence cible

```text
celeste-biz/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (dashboard)/dashboard/
│   │   ├── today/
│   │   ├── customers/
│   │   ├── catalog/
│   │   ├── orders/
│   │   ├── quotes/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── website/
│   │   └── settings/
│   ├── (public)/sites/[slug]/
│   ├── suivi/[token]/
│   └── api/
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── orders/
│   ├── invoice/
│   └── website-templates/
├── features/
│   ├── businesses/
│   ├── professions/
│   ├── customers/
│   ├── catalog/
│   ├── orders/
│   ├── quotations/
│   ├── invoicing/
│   ├── payments/
│   ├── websites/
│   └── messaging/
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permissions/
│   ├── monetary/
│   ├── observability/
│   └── security/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   ├── tests/
│   └── functions/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── adr/
│   ├── IMPLEMENTATION_STATUS.md
│   ├── API.md
│   └── USER_GUIDE.md
├── CLAUDE.md
├── .env.example
└── README.md
```

Cette arborescence est indicative : l'agent peut ajuster les conventions sans changer l'architecture ni le périmètre.

---

## 7. Modèle de données logique — première base

**Convention :** identifiants UUID ; horodatages UTC ; montants décimaux (`numeric(18,2)` par prudence), devise `XAF` ; `business_id` sur les entités commerciales ; clés étrangères et index appropriés ; contraintes uniques tenant-scoped.

| Table | Champs principaux (non exhaustifs) | Règles |
|---|---|---|
| `profiles` | `user_id`, `display_name` | Référence à `auth.users` |
| `businesses` | `id`, `owner_user_id`, `name`, `slug`, `profession_key`, `status`, `timezone` | Propriétaire, slug unique dans espace approprié |
| `business_members` | `business_id`, `user_id`, `role`, `status` | Couples uniques, invitations séparées |
| `profession_templates` | `key`, `version`, `schema`, `features` | Config validée, version immuable ou historisée |
| `business_settings` | `business_id`, `features`, `branding`, `fiscal_profile` | Accès strict, profil fiscal non public |
| `customers` | `id`, `business_id`, `name`, `phone_e164`, `marketing_consent` | Un client peut être représenté dans plusieurs entreprises sans croisement |
| `catalog_items` | `id`, `business_id`, `kind`, `name`, `price_mode`, `price`, `active` | Archivage, pas suppression destructrice si utilisé |
| `orders` | `id`, `business_id`, `customer_id`, `code`, `status`, `due_at`, `total`, `version` | `code` unique dans tenant ; version pour concurrence |
| `order_items` | `order_id`, `catalog_item_id`, `name_snapshot`, `qty`, `unit_price`, `tax_snapshot` | Snapshots immuables après validation |
| `order_events` | `order_id`, `actor_id`, `type`, `from_state`, `to_state`, `metadata` | Audit append-only |
| `quotations` | `id`, `business_id`, `code`, `status`, `expires_at`, `total`, `version` | États et version |
| `quotation_items` | `quotation_id`, snapshots des lignes | Montants cohérents |
| `invoices` | `id`, `business_id`, `number`, `status`, `issued_at`, `totals`, `fiscal_snapshot`, `pdf_path` | Numérotation atomique, pièce émise immuable |
| `invoice_items` | `invoice_id`, snapshots de lignes | Historique figé |
| `credit_notes` | `invoice_id`, `business_id`, `reason`, `number`, montants | Corrige sans supprimer l'historique |
| `payments` | `id`, `business_id`, `order_id`, `invoice_id`, `method`, `amount`, `status`, `provider`, `provider_reference` | Pas de doublon de webhook |
| `provider_events` | `provider`, `event_id`, `payload_digest`, `processed_at` | `unique(provider,event_id)` |
| `websites` | `business_id`, `slug`, `template_key`, `published`, `published_at` | Publication explicite |
| `website_sections` | `website_id`, `section_type`, `position`, `data`, `visibility` | Schéma validé |
| `campaign_links` | `business_id`, `code`, `catalog_item_id`, `source` | Attribution limitée, non intrusive |
| `tracking_links` | `business_id`, `order_id`, `token_hash`, `expires_at`, `revoked_at` | Token opaque non exposé en DB |
| `subscriptions` | `business_id`, `plan_id`, `status`, période | Séparé des transactions commerciales |
| `plan_entitlements` | `plan_key`, `feature`, `limit` | Enforcement côté serveur |
| `audit_logs` | `business_id`, `actor_id`, `action`, `entity`, `entity_id`, `at` | Modifications critiques |
| `message_sessions` (P2) | `business_id`, `customer_id`, `provider`, `state`, `handoff`, `context` | Machine à états multi-tenant |
| `message_events` (P2) | `provider_id`, `business_id`, `direction`, `kind`, `status` | Minimalisation des données |

**Interdiction :** utiliser le seul `business_id` fourni par le navigateur pour autoriser un accès. Construire une fonction commune d'autorisation côté serveur et des politiques RLS qui consultent `business_members`, évitant les récursions entre policies.

### Relations et intégrité

- Une `business` possède plusieurs membres, clients, produits, commandes, devis, factures et paiements.
- Une commande appartient à un seul tenant ; ses lignes ne peuvent référencer un catalogue d'un autre tenant.
- Toute association `invoice → order → customer` reste dans la même entreprise, vérifiée par contraintes et logique transactionnelle.
- Une facture émise peut être payée en plusieurs opérations ; des remises et avoirs suivent des règles explicites.
- Les actions qui doivent être atomiques (numéro de facture, création de paiement associé, changement d'état) sont réalisées via transaction SQL / fonction Postgres auditable.
- Les suppressions irréversibles sont restreintes pour les pièces légalement conservées.

---

## 8. API / contrats et règles de service

Les routes finales peuvent être Server Actions ou Route Handlers, mais les cas métier doivent être exposés derrière des services testables. Les exemples ci-dessous représentent des capacités et non une obligation d'implémenter chaque URL au MVP.

| Route logique | Méthode | Action |
|---|---|---|
| `/api/businesses` | POST / GET | Créer / lister ses entreprises |
| `/api/businesses/:id/members` | GET / POST | Gérer habilitations selon rôle |
| `/api/catalog` | GET / POST | Catalogue d'une entreprise autorisée |
| `/api/customers` | GET / POST | Clients autorisés |
| `/api/orders` | GET / POST | Commandes et filtres |
| `/api/orders/:id` | GET / PATCH | Détail / mise à jour autorisée |
| `/api/orders/:id/transition` | POST | Transition validée avec `expected_version` |
| `/api/quotes` | POST / GET | Devis |
| `/api/quotes/:id/accept` | POST | Acceptation authentifiée par contexte/token sécurisé |
| `/api/invoices/:id/issue` | POST | Émission atomique, conformité selon configuration |
| `/api/payments/manual` | POST | Encaissement déclaré avec audit |
| `/api/payment-provider/webhook` | POST | Webhook signé et idempotent |
| `/api/tracking/:token` | GET | Vue filtrée, token et rate limit |
| `/api/websites/:id/publish` | POST | Publier un site après validation |
| `/api/messaging/webhook` | GET / POST | Validation et réception provider en P2 |

Exiger : validation Zod, droits serveur, RLS, codes d'erreurs cohérents, pagination, champs autorisés explicites, idempotency keys là où nécessaire, limitation de débit sur endpoints publics.

---

## 9. Sécurité, vie privée, conformité et risques

### 9.1 Multi-tenant (bloquant pour lancement)

- RLS activée sur toutes les tables exposées, permissions SQL minimales, tests de lecture/écriture entre deux entreprises.
- Clés secrètes Supabase exclusivement côté serveur ; jamais dans bundle frontend, URLs de suivi ou logs.
- Séparation publique/privée pour Storage : toutes les pièces justificatives privées, seule la galerie explicitement publiée peut être publique.
- Non-divulgation de clients ou commandes via recherche, logs, exports, erreurs ou cache partagé.

### 9.2 Comptes et sessions

- Auth SSR documentée Supabase, renouvellement sécurisé, reset de mot de passe, anti-brute force, protection des mutations serveur.
- Contrôles robustes contre IDOR, CSRF selon mécanisme d'auth, injection, XSS, upload malveillant et dépassement des quotas.
- File uploads : liste blanche de types, taille maximale, neutralisation des noms, quotas par entreprise et liens signés.
- Journal d'audit des modifications critiques, rétention limitée et politique de restauration testée.

### 9.3 Données personnelles

- Notice de confidentialité compréhensible ; finalités de traitement ; droit d'accès, correction et demandes de suppression sous réserve de rétention réglementaire.
- Consentement et preuve pour marketing, minimisation des contacts et messages ; éviter une base de contacts inter-entreprises.
- Avant commercialisation, réaliser une analyse de conformité à la **loi camerounaise n°2024/017 du 23 décembre 2024 sur les données personnelles**, incluant éventuelles formalités et transferts internationaux. Consulter conseil juridique compétent.

### 9.4 Fiscalité

- Ne pas figer les taux de TVA ni présumer qu'ils s'appliquent à toutes les entreprises.
- Documents et numérotation conçus pour adaptation aux obligations du Cameroun.
- Vérifier la loi de finances 2026 et la documentation officielle de la DGI sur la facturation électronique avant d'émettre légalement des factures fiscales en production.
- Ne pas confondre le **Cameroun** avec les règles de la **République du Congo** parfois présentées sous des sigles voisins.

### 9.5 WhatsApp et paiements

- En production, respecter les conditions et tarifs de la plateforme WhatsApp Business, le consentement et les modèles de message approuvés.
- Le statut d'une transaction est déterminé par le prestataire externe vérifié, non par le retour navigateur ou une capture d'écran.
- Séparer les comptes marchands ; valider le mode de versement au commerçant avant activation des encaissements en ligne.
- Prévoir plan de panne : transactions suspendues correctement, reprise idempotente, file d'événements et journalisation.

---

## 10. Performance, réseau mobile, disponibilité et budgets

**Objectifs initiaux à vérifier** sur téléphone Android de gamme économique et réseau simulé lent ; ce ne sont pas des promesses déjà mesurées.

- Interface métier utilisable sur écran 360 px ; formulaires avec clavier mobile et choix adaptés.
- Optimiser les pages d'usage fréquent : documents et images hors chargement initial ; pagination par curseur, pas de liste de 10 000 clients d'un coup.
- Pas de revalidation serveur au moindre clic sans utilité ; cache maîtrisé ; compression Brotli/Gzip fournie par l'hébergeur.
- Définir budgets Lighthouse/Core Web Vitals après instrumentation ; test en 3G simulée pour les parcours « Aujourd'hui → commande → acompte ».
- Objectif pilote de trafic : suivre Mo/jour pour scénarios (première visite, 10 commandes, consultation facture, retour utilisateur). Ne pas annoncer « moins de 30 Mo/mois » sans mesure réelle.
- En cas de perte du réseau, conserver le formulaire localement en mémoire courte pour éviter la disparition du texte si possible ; afficher clairement « non enregistré » tant qu'aucune confirmation serveur n'est reçue.
- Aucune promesse de fonctionnement totalement hors connexion dans le MVP.
- Stratégie de sauvegarde/export/restauration Supabase documentée selon le forfait choisi ; vérification des restaurations avant commercialisation.
- Suivre coûts variables : Vercel, Supabase, stockage, emails, WhatsApp, SMS, frais PSP ; alertes et plafonds.

---

## 11. Plan d'exécution incrémental pour Claude Code

**Règle commune à toutes les phases :** mini-plan → implémentation ciblée → migration/seed si nécessaire → tests unitaires/intégration/E2E ciblés → lint/typecheck/build → documentation et captures si possible → commit local → rapport d'avancement. Ne pas mettre en production une fonctionnalité incomplète.

### Phase 0 — Audit / cadrage du dépôt

**Livrables :** arborescence, état Git, `README.md`, `.env.example`, ADR-0001 (architecture), `docs/IMPLEMENTATION_STATUS.md`, scripts de validation. Si dépôt vide : initialisation minimale Next.js compatible.  
**Acceptation :** projet démarre localement ; règles de contribution et plan de phases documentés ; aucun secret commité.  
**Commit suggéré :** `chore: initialize Celeste Biz project and implementation plan`.

### Phase 1 — Fondations UX et structure de projet

**Livrables :** Tailwind/shadcn, layout mobile, page d'accueil marketing, navigation des espaces, design tokens, composants loading/error/empty, routes réservées.  
**Acceptation :** parcours responsive 360 px, navigation clavier, build et tests de base passent.  
**Commit :** `feat: create responsive application shell`.

### Phase 2 — Supabase Auth + isolement multi-entreprises

**Livrables :** login/inscription/reset, profils, entreprises, adhésions/rôles, sélection d'entreprise, migrations SQL, RLS, tests pgTAP croisés, seed de deux entreprises.  
**Acceptation bloquante :** user A ne peut ni consulter ni modifier données business B, même en forgeant l'ID ; aucun secret côté navigateur ; redirections/session correctes.  
**Commit :** `feat: implement secure multitenant authentication`.

### Phase 3 — Onboarding et profils métiers

**Livrables :** création d'entreprise, choix métier, deux configurations métiers (couture, traiteur), profil générique, activation de menus et champs sans IA.  
**Acceptation :** couture et traiteur affichent des modules/configurations pertinents ; site web non requis.  
**Commit :** `feat: add business onboarding and profession profiles`.

### Phase 4 — Clients et catalogue

**Livrables :** CRUD clients et services, recherche, filtres, images facultatives, rôles et audit basique.  
**Acceptation :** un employé autorisé voit les clients de son entreprise seulement ; catalogue archivable ; interface mobile efficace.  
**Commit :** `feat: add customer and service catalog management`.

### Phase 5 — Commandes et gestion d'acomptes manuels

**Livrables :** commande, lignes figées, statuts, événements, délais, acompte manuel et calcul du solde, vues « Aujourd'hui/En cours/En retard ».  
**Acceptation :** transitions invalides bloquées ; calculs exacts ; doubles soumissions maîtrisées ; `CMD` unique par entreprise ; aucun montant en virgule flottante.  
**Commit :** `feat: build order workflow and manual payment tracking`.

### Phase 6 — Devis + module documentaire/facturation

**Livrables :** brouillons de devis, PDF, acceptation, conversion en commande, factures en brouillon, reçus manuels clairement marqués. Mécanisme d'émission définitive **derrière feature flag** tant que conformité fiscale non validée.  
**Acceptation :** totaux cohérents, PDF privés, numérotation atomique à l'émission, pièce émise immuable, corrections par avoir, distinction brouillon / émis ; tests.  
**Commit :** `feat: implement quotes and compliance-gated invoicing`.

### Phase 7 — Tableau « Aujourd'hui » et alertes actionnables

**Livrables :** agrégats corrects, liste de tâches déterministes, filtres et liens d'action.  
**Acceptation :** alertes expliquées et associées aux vrais dossiers, aucune marge inventée ; performance acceptable sur seed volumineux.  
**Commit :** `feat: add actionable business dashboard`.

### Phase 8 — Portail client privé

**Livrables :** lien token sécurisé, statuts, dernière mise à jour, pièces accessibles selon habilitation ; révocation/expiration ; tests d'accès.  
**Acceptation bloquante :** aucun client n'accède au dossier d'un autre ; token non devinable ; lien expiré rejeté ; documents privés protégés.  
**Commit :** `feat: add secure customer order tracking`.

### Phase 9 — Site web métier optionnel

**Livrables :** modèle couture, modèle traiteur, modèle générique, éditeur simple, prévisualisation, publication explicite, URL `/sites/[slug]`, contact WhatsApp.  
**Acceptation :** aucune publication implicite ; contenu d'une entreprise inaccessible depuis la mauvaise URL ; changement de prix catalogue ne modifie pas commandes passées.  
**Commit :** `feat: create optional profession-based websites`.

### Phase 10 — WhatsApp sans automatisation et traçabilité de campagne

**Livrables :** lien `wa.me`, messages préremplis, codes campagne, partage de devis/suivi, métriques de clics si mesurables sans suivi abusif.  
**Acceptation :** le client ouvre le bon numéro et la bonne référence ; le produit fonctionne si aucune API WhatsApp n'est branchée.  
**Commit :** `feat: add WhatsApp contact flows and campaign links`.

### Phase 11 — Exports, supervision et qualité de production

**Livrables :** CSV sécurisés, supervision, audit, quotas, politique de sauvegarde, configuration Vercel/Supabase, tests Playwright complets, documentation utilisateurs.  
**Acceptation :** exports respectent business_id, bonnes pratiques anti-injection CSV, erreurs instrumentées, secrets absents, scripts CI verts.  
**Commit :** `chore: harden exports monitoring and production readiness`.

### Phase 12 — Pilotage terrain et optimisation réseau (sans changer la stack)

**Livrables :** instrumentation du trafic par parcours, statistiques d'usage avec respect de la vie privée, collecte des retours, améliorations UX, évaluation de l'offline navigateur.  
**Acceptation :** chiffres mesurés et documentés, pas d'objectif présenté comme résultat ; rapport sur coût réseau, saisie et rétention.  
**Commit :** `perf: optimize mobile data usage after pilot measurements`.

### Phase 13 — Paiements en ligne (feature flag)

**Préconditions :** fournisseur validé pour le Cameroun, sandbox, contrats marchands, gestion des versements, analyse des coûts et conformité.  
**Livrables :** adaptateur PSP, paiement client, webhook vérifié/idempotent, rapprochement, gestion erreurs, reçu après confirmation.  
**Acceptation bloquante :** fake webhook refusé ; doublon ne crédite pas deux fois ; montant/devise concordants ; test d'échec/retour/annulation.  
**Commit :** `feat: integrate verified mobile money payments`.

### Phase 14 — WhatsApp Business Cloud API (feature flag)

**Préconditions :** compte/autorisation fournisseur, budget, templates, consentement, intégration de comptes clients éligible.  
**Livrables :** adaptateur officiel, machine à états, identification tenant, commandes, transfert humain, quotas et logs.  
**Acceptation bloquante :** aucun mélange de messages entre entreprises, double webhook sans doublon, client peut parler à un humain, absence d'envoi hors cadre autorisé.  
**Commit :** `feat: add opt-in official WhatsApp automation`.

### Phase 15 — Synchronisation offline web (facultative, uniquement si le pilote le justifie)

**Décision préalable :** ADR explicitant coûts et bénéfices.  
**Livrables si validé :** PWA navigateur sans store, cache minimal, IndexedDB, outbox, identifiants idempotents, versionnement, stratégie de conflits, purge à la déconnexion.  
**Acceptation bloquante :** ne jamais inventer une sauvegarde serveur, ne jamais perdre silencieusement une commande lors des tests, conflits visibles, aucun paiement externe validé hors ligne.  
**Commit :** `feat: add optional browser offline draft workflow`.

### Phase 16 — Abonnements Céleste Biz (à lancer après prix validés)

**Livrables :** matrice de forfaits, abonnements, quotas, paiement du SaaS séparé des paiements marchands, factures Céleste Corp, renouvellement.  
**Acceptation :** fonctionnalités bloquées proprement selon droits, données exportables après fin d'abonnement, pas de coupure opaque.  
**Commit :** `feat: add SaaS plan entitlements and billing`.

**Point d'arrêt pour le premier pilote utilisable : fin de la Phase 8** (gestion des commandes, devis/factures en mode conforme ou brouillon, tableau et suivi client) ; phases 9–10 renforcent l'acquisition. Ne pas attendre l'IA, les paiements connectés ou le bot pour tester le produit.

---

## 12. Stratégie de tests et scénarios critiques

### 12.1 Couverture par couche

- **Unitaires :** monétaires, arrondis, transitions, permissions, règles métier, génération de documents.
- **Intégration :** Supabase DB + RLS + migration, relations, numérotation et idempotence.
- **E2E :** Playwright sur appareil mobile simulé ; inscription → entreprise → service → client → commande → acompte → devis → portail privé.
- **Sécurité :** scénario de deux entreprises et clients distincts ; URL modifiées, autorisations révoquées, téléchargement croisé, injection CSV, webhooks falsifiés.
- **Performance :** tester au moins 100, 1 000 et 10 000 commandes de référence sur base de test ; vérifier index et paginations, sans annoncer de performance non mesurée.

### 12.2 Liste des tests d'acceptation incontournables

1. Un `staff` ne peut supprimer l'entreprise ni modifier son abonnement.
2. Un `owner` de A ne lit pas les commandes, clients, factures ou fichiers de B.
3. Le changement de prix catalogue n'altère pas une ligne de commande historique.
4. Deux clics rapides « enregistrer » ne créent pas deux commandes.
5. Deux émissions simultanées de facture ne créent pas le même numéro.
6. Une facture émise ne peut être écrasée silencieusement.
7. Un paiement déclaré manuellement est identifiable comme tel.
8. Un webhook rejoué ne crédite pas une nouvelle fois.
9. Un lien de suivi d'un client ne montre ni les autres commandes ni des notes internes.
10. Un lien privé expiré ou révoqué est refusé.
11. Une commande peut être créée sans site ni chatbot.
12. Un chatbot déconnecté ne bloque pas l'usage des commandes manuelles.
13. Une connexion coupée en cours d'action ne donne pas une fausse indication de sauvegarde.
14. Un formulaire métier affiche les bons champs selon le profil et applique une validation serveur.
15. Les champs et exports respectent les règles XAF, fuseau et formats locaux.

---

## 13. Critères de succès produit et tests sur le terrain

**Pilotage proposé** : 15 entreprises (couture, traiteur, vente via réseaux sociaux), observation pendant deux semaines ou plus.

Indicateurs à mesurer : temps de première prise en main, taux de commandes réellement saisies, temps pour retrouver solde, retards/erreurs signalés, trafic mobile incrémental, nombre de clients actifs à J+14, fréquence d'usage de « Aujourd'hui », volonté de payer effectivement. Seuils de réussite à fixer avant les tests, **sans inventer de résultats**.

Pour la première version, réussite minimale :

- Un commerçant crée une commande, enregistre un acompte et retrouve le solde sans aide récurrente.
- Un client peut consulter son suivi privé sans compte.
- Les devis et documents peuvent être préparés sans confusion avec une certification fiscale.
- Le commerçant continue d'utiliser WhatsApp à sa façon s'il le souhaite.
- L'interface est utilisable sur mobile et les données d'entreprise restent isolées.

---

## 14. Livrables finaux attendus

1. Code source Next.js/TypeScript versionné.
2. Migrations SQL Supabase complètes et instructions de déploiement/recréation.
3. Schéma de base et règles RLS documentées et testées.
4. Parcours UX testés et composants réutilisables.
5. Tests unitaires, intégration, E2E et scénario de sécurité multi-tenant.
6. `.env.example` sans valeur secrète, README, guide de configuration Supabase/Vercel.
7. Documentation utilisateur métier et guide administrateur.
8. Fichier `docs/IMPLEMENTATION_STATUS.md` à jour, avec commits, preuves de tests et dettes techniques.
9. Feature flags clairement documentés pour fiscalité, paiement connecté, WhatsApp, PWA/offline.
10. Guide de sauvegarde/restauration, observabilité, consommation réseau, coûts tiers et incidents.

---

## 15. Points nécessitant validation humaine avant exploitation commerciale

- Domaine principal et marque commerciale : disponibilité et propriété.
- Comptes Vercel/Supabase, région d'hébergement, politique de sauvegarde et budget.
- Conditions de paiement PSP, distribution des recettes aux marchands et comptes habilités.
- Conformité fiscale des documents Cameroun (régimes, mentions, numérotation, facturation électronique).
- Conformité données personnelles (loi 2024/017, hébergement/transferts, registres et obligations).
- Accès à l'API officielle WhatsApp, onboarding de comptes multiples, tarifs et modèles de messages.
- Conditions de vente, confidentialité, support, rétention, politique d'annulation et prix finaux.

**Ne jamais contourner ces points en prétendant qu'ils sont réglés.** Laisser les intégrations sous feature flags et poursuivre les modules indépendants.

---

## 16. Sources techniques et réglementaires à vérifier lors de chaque intégration

- Next.js App Router : https://nextjs.org/docs/app
- Next.js multi-tenant : https://nextjs.org/docs/app/guides/multi-tenant
- Exemple Vercel multi-tenant : https://vercel.com/kb/guide/nextjs-multi-tenant-application
- Vercel Hobby, restrictions commerciales : https://vercel.com/docs/plans/hobby
- Supabase + Next.js : https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Auth : https://supabase.com/docs/guides/auth
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions : https://supabase.com/docs/guides/functions
- Supabase Cron : https://supabase.com/docs/guides/cron
- PWA web et hors connexion (sans app store obligatoire) : https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Tarification officielle WhatsApp : https://whatsappbusiness.com/fr/products/platform-pricing/
- Paiements Fapshi (option à évaluer) : https://documentation.fapshi.com/
- Loi camerounaise 2024/017 protection des données : https://prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Loi de finances Cameroun 2026 : https://prc.cm/fr/actualites/actes/lois/8092-loi-n-2025-012-du-17-decembre-2025-portant-loi-des-finances-de-la-republique-du-cameroun-pour-l-exercice-2026

**Précision :** ces liens sont des références de conception, pas une attestation de conformité. Pour les textes camerounais, consulter également la DGI et un professionnel compétent avant mise en production des factures.

---

## 17. Définition de « terminé »

Une phase ne peut être déclarée « terminée » que si :

- le code utile est présent, pas seulement une maquette ;
- les migrations sont reproduisibles ;
- les autorisations et validations métier sont testées ;
- `lint`, typecheck, tests applicables et build réussissent, ou les limites environnementales sont documentées sans fausse réussite ;
- le parcours est utilisable sur mobile ;
- les changements sont décrits dans `docs/IMPLEMENTATION_STATUS.md` ;
- les blocages, risques et TODO sont signalés ;
- un commit Git local identifie cette phase (si autorisé par l'état du dépôt).

**Ordre de lancement : d'abord le logiciel de gestion utile sans WhatsApp automatisé ; ensuite le site optionnel et les liens ; enfin les paiements/WhatsApp officiels et le mode hors ligne avancé selon demande réellement mesurée.**
