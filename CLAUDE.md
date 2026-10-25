# Règles de travail Claude Code — Céleste Biz

Tu dois suivre intégralement le document `CAHIER_DES_CHARGES_CELESTE_BIZ.md`, qui constitue la source de vérité du projet.

## Principes non négociables

- Stack : Next.js + React + TypeScript + Supabase, hébergement Vercel. Pas de Django, pas d'app native Android/iOS.
- Première version = web mobile, connectée, avec faible consommation de données. PWA et brouillons hors ligne seulement si décidés plus tard.
- Gestion commerciale autonome : commandes, clients, acomptes, devis, documents, suivi ; site web facultatif et non requis à l'inscription.
- Le client du commerçant n'a pas à créer de compte pour suivre une commande via lien privé.
- Aucune IA générative dans le MVP ; configuration des métiers déterministe.
- WhatsApp : lien `wa.me` au MVP. API officielle et bot seulement plus tard, sous autorisation et feature flag. Ne pas rendre OpenWA indispensable à la production.
- Ne jamais marquer un paiement fournisseur comme confirmé sans preuve API ; ne jamais présenter une facture PDF comme fiscalement certifiée sans intégration/validation réglementaire.
- Multi-tenant obligatoire : contrôle serveur + Supabase RLS + tests croisés.
- Pas de marketplace, pas de commission de mise en relation.

## Cycle pour chaque phase

1. Lire cahier des charges + état Git + `docs/IMPLEMENTATION_STATUS.md`.
2. Identifier la première phase non terminée.
3. Présenter brièvement son objectif, les fichiers concernés, ses dépendances et les commandes de vérification.
4. Implémenter **seulement cette phase**, avec fichiers et tests.
5. Exécuter les vérifications disponibles ; corriger les problèmes.
6. Mettre à jour `docs/IMPLEMENTATION_STATUS.md` (preuves des tests, limites, phase suivante).
7. Créer un commit Git local, descriptif. Ne pas ouvrir de pull request et ne pas pousser sans consigne de l'utilisateur.
8. Rapporter : fonctions terminées, fichiers clés, résultats des tests, commit, limites et prochaine phase.
9. Ne pas passer à une nouvelle phase avant d'avoir satisfait les critères de sortie. Pour les opérations externes, attendre les identifiants ou la validation humaine sans en inventer.

## Préservation du travail

- Ne pas réinitialiser, rebaser de force, nettoyer en masse ou supprimer des travaux préexistants.
- Si le dépôt existe déjà, auditer avant d'installer ou de réorganiser.
- Ne pas commiter `.env`, secrets ou fichiers clients réels.
- Utiliser fixtures fictives et fournisseurs mock en développement.

## Commandes attendues quand elles sont configurées

`npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build` et `supabase test db` pour RLS. Si scripts absents au départ, les ajouter à la phase pertinente.

## Format du compte rendu après chaque phase

- **Phase :**
- **Réalisé :**
- **Tests exécutés et résultats :**
- **Sécurité/tenancy vérifiés :**
- **Commit local :**
- **Blocages et décisions à valider :**
- **Prochaine phase :**

Commence par la **Phase 0**, sauf si le dépôt contient déjà des livrables vérifiés équivalents : dans ce cas, documente précisément pourquoi une phase peut être considérée comme faite.
