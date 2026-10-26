# ADR-0006 — Commandes, transitions et encaissements manuels

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F05 (commandes) et F08 en mode manuel : enregistrer vite une commande sur
smartphone, suivre ses états et délais, encaisser des acomptes déclarés et
connaître le solde exact, à plusieurs, sans double saisie ni montant faux.

## Décision

1. **Aucune écriture directe** sur `orders`, `order_items`, `order_events`,
   `payments` : lecture sous RLS pour les membres, écritures par fonctions
   `SECURITY DEFINER` (`create_order`, `update_order`, `transition_order`,
   `record_manual_payment`, `cancel_payment`) qui vérifient le rôle,
   verrouillent la commande (`for update`), recalculent les montants et
   journalisent.
2. **Montants calculés en SQL** (`numeric(18,2)`) : lignes en colonnes
   générées (`round(quantité × prix, 2) − remise`, taxe arrondie au
   centime), totaux et montant encaissé recalculés à chaque opération,
   `balance` générée, contrainte `paid_total ≤ total` (pas de solde
   négatif). Taxe par ligne, 0 % par défaut : aucun taux codé en dur.
   Le navigateur affiche un aperçu avec la même règle d'arrondi
   (`lib/monetary/decimal.ts`, entiers BigInt), jamais enregistré.
3. **Numéro lisible** `CMD-AAAA-NNNN` par entreprise et par année (fuseau de
   l'entreprise), compteur atomique `insert … on conflict do update`.
4. **Idempotence** : identifiants de commande et d'encaissement générés par
   le formulaire ; un second envoi renvoie l'enregistrement existant.
5. **Concurrence** : `version` incrémentée à chaque modification ou
   changement d'état ; une version périmée est refusée (`CB409`) avec un
   message invitant à recharger.
6. **Transitions** : table de référence `order_status_transitions`
   (rôles par transition), miroir TypeScript vérifié par un test
   d'intégration. Annulation et litige : propriétaire ou gestionnaire,
   motif obligatoire pour annuler ; clôture refusée tant qu'un solde reste.
7. **Lignes figées** dès la confirmation (client, articles, prix) ; échéance,
   responsable, notes, informations métier et étape restent modifiables
   jusqu'à la clôture. Le catalogue est copié dans la ligne : un changement
   de prix n'altère jamais une commande existante.
8. **Encaissements honnêtes** : statut `manual_declared` affiché
   « enregistré manuellement, non vérifié auprès de l'opérateur » ; jamais
   supprimés, seulement annulés avec motif (propriétaire/gestionnaire) ;
   montant limité au solde ; date non future.
9. **Profil métier figé** dans la commande (`profession_key`,
   `profession_version`) ; informations métier validées côté serveur
   depuis ce profil. Un champ masqué depuis (module désactivé) garde sa
   valeur.
10. **Erreurs** : `CB422` (règle métier, message affichable), `CB409`
    (conflit), `42501` (droits) ; tout autre échec affiche « rien n'a été
    enregistré ».

## Conséquences

- La logique critique est testée directement en base (pgTAP) et reste vraie
  quel que soit le client (futur portail, API, chatbot).
- Le formulaire de commande nécessite JavaScript (lignes dynamiques) ; les
  autres actions (états, encaissements) restent de simples formulaires.
- Remboursements, avoirs et paiements en ligne : opérations séparées des
  phases 6 et 13 ; `pending_provider` / `provider_verified` sont réservés à
  une confirmation serveur du prestataire.
