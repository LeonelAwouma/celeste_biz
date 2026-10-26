# ADR-0007 — Devis, factures sous interrupteur et pièces PDF

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F06 (devis) et F07 (factures) : préparer un devis partageable sur
WhatsApp, le transformer en commande, préparer des factures et des reçus,
sans jamais présenter un document comme une facture fiscalement valable
tant que la conformité n'est pas validée (CLAUDE.md, cahier §9.4).

## Décision

1. **Même modèle d'écriture que les commandes** : lecture sous RLS,
   écritures par fonctions `SECURITY DEFINER` (`create_quote`,
   `update_quote`, `transition_quote`, `convert_quote_to_order`,
   `create_invoice_from_order`, `update_invoice_draft`,
   `discard_invoice_draft`, `issue_invoice`, `issue_credit_note`,
   `attach_document_pdf`, `update_fiscal_profile`), verrou de ligne,
   `version` pour la concurrence, identifiants générés par le formulaire
   pour l'idempotence.
2. **Devis** : numéro `DEV` attribué à la création (pièce commerciale, un
   trou de numérotation est sans conséquence). Seul le brouillon se
   modifie ; un devis envoyé repasse en brouillon pour être corrigé.
   L'acceptation est déclarée par le commerçant (`acceptance_source =
manual`, auteur, date, note) ; le lien client viendra en Phase 8.
   Acceptation refusée après la date de validité.
3. **Factures en deux temps** : un brouillon n'a **pas de numéro** ; le
   numéro `FAC` n'est attribué qu'à l'émission, dans la même transaction,
   ce qui garantit une suite sans trou. Vendeur (dont le profil de
   facturation) et acheteur sont figés dans la facture à l'émission.
4. **Double interrupteur d'émission** : variable serveur
   `FEATURE_FISCAL_INVOICE_ISSUE` (interface et actions) **et** drapeau
   plateforme `private.platform_flags.fiscal_invoice_issue` lu par la
   fonction SQL. Les deux sont désactivés : aucune facture ni aucun avoir
   ne peut être émis, même par appel direct à l'API.
5. **Immuabilité** par déclencheurs, valables même pour les fonctions
   serveur et le superutilisateur : une facture émise, ses lignes et ses
   avoirs ne se modifient ni ne se suppriment ; seul l'archivage du PDF
   (chemin et empreinte, une seule fois) est permis. Les corrections
   passent par des avoirs `AV` bornés au reste à créditer.
6. **PDF générés côté serveur** avec `pdf-lib` (polices standard, aucune
   dépendance native) par des routes authentifiées qui relisent la pièce
   sous RLS. Brouillons et devis sont régénérés à chaque demande ; une
   pièce émise est archivée au premier téléchargement dans le bucket privé
   `documents` (`<entreprise>/factures/FAC-….pdf`) avec son SHA-256, puis
   resservie à l'identique.
7. **Mentions honnêtes** : devis « n'est pas une facture » ; brouillon
   filigrané « non valable comme facture » ; reçu « déclaré, non vérifié
   auprès de l'opérateur, sans valeur fiscale » ; facture émise sans aucune
   mention de certification, identifiants fiscaux « déclarés par le
   vendeur, non vérifiés ».
8. **Partage WhatsApp** par lien `wa.me` prérempli ; le PDF reste privé et
   est joint par le commerçant.

## Conséquences

- Activer l'émission demande une décision réglementaire puis deux gestes
  d'exploitation (variable d'environnement et drapeau en base).
- Le PDF archivé fait foi : les avoirs ultérieurs n'y figurent pas, ils
  ont leur propre PDF.
- Les polices standard limitent les caractères au Latin-1 (suffisant pour
  le français ; remplacement par « ? » sinon).
