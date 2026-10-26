# ADR-0005 — Clients, catalogue, montants et photos

- **Statut :** accepté
- **Date :** 2026-10-25

## Contexte

F03 (clients) et F04 (catalogue) : saisie rapide sur smartphone 360 px,
réseau lent, plusieurs employés, données personnelles, montants en FCFA
exacts, photos facultatives sans exposer de fichiers publics.

## Décision

1. **Écritures directes sous RLS** plutôt que des RPC : `insert`/`update`
   autorisés colonne par colonne (`business_id`, `created_by`,
   `marketing_consent_at`, `archived_at` à l'insertion… ne sont pas
   modifiables librement), pas de `delete` (archivage seulement). Les règles
   sensibles sont dans des triggers `SECURITY DEFINER` :
   - changement d'entreprise interdit ;
   - archivage/restauration d'un client réservé au propriétaire et au
     gestionnaire (l'employé crée et modifie) ;
   - horodatage serveur du consentement marketing (preuve) ;
   - journal d'audit avec l'action et **les noms des champs modifiés**,
     jamais leur contenu (pas de données personnelles dans l'audit).
2. **Catalogue** modifiable par propriétaire et gestionnaire seulement ;
   contrainte SQL : prix obligatoire sauf « sur devis », jamais négatif.
3. **Montants** : `numeric(18,2)` en base, chaînes décimales côté
   TypeScript (`lib/monetary/xaf.ts`), jamais de `number` flottant pour un
   calcul. La saisie accepte « 15 000 », « 15.000 », « 2 500,50 » ;
   l'affichage est « 25 000 FCFA » (espaces insécables).
4. **Recherche clients** : RPC `search_customers` en `SECURITY INVOKER`
   (RLS appliquée), `strpos` (aucun caractère joker interprété), recherche
   par nom ou par 3 chiffres au moins du numéro, **pagination par clé**
   (`name_search, id`) avec curseur opaque, 20 par page.
5. **Doublons** : un numéro déjà connu déclenche un avertissement et une
   confirmation explicite ; la fusion de fiches est reportée (elle doit
   déplacer commandes et paiements, Phase 5+).
6. **Création idempotente** : l'identifiant est généré dans le formulaire ;
   un double envoi retombe sur la contrainte d'unicité et n'insère rien de
   plus.
7. **Photos** : bucket privé `catalog-images` (2 Mo, JPEG/PNG/WebP), un
   dossier par entreprise contrôlé par les politiques `storage.objects`,
   affichage par URL signées de 30 minutes. Le navigateur réduit la photo
   (1 200 px, WebP) pour économiser les données ; le serveur revérifie la
   taille et **le type réel** (signature du fichier), génère le nom du
   fichier et supprime l'ancienne photo.

## Conséquences

- Les pages restent rapides sans couche API supplémentaire ; la sécurité ne
  dépend pas des vérifications de l'interface (doublées côté serveur et RLS).
- Le futur site public (Phase 9) devra servir les photos des articles
  `public` par une route dédiée ou un bucket public de copies, jamais en
  ouvrant ce bucket.
- La recherche en `strpos` est linéaire par entreprise ; l'index trigramme
  est en place si le volume l'exige (centaines à quelques milliers de
  clients par entreprise attendus).
