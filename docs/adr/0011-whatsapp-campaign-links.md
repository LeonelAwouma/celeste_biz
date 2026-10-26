# ADR-0011 — Liens de campagne WhatsApp sans pistage

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F12 et parcours P3 : le commerçant publie une offre (réseaux, statut,
affiche) avec un lien qui ouvre WhatsApp sur son numéro et un message
prérempli contenant une référence lisible. Pas d'API WhatsApp, pas de
lecture des conversations, des mesures « si mesurables sans suivi
abusif ».

## Décision

1. **Lien court Céleste Biz** `/c/<identifiant>` (12 caractères
   aléatoires) plutôt qu'un lien `wa.me` direct : il permet de compter les
   clics, de changer le message ou d'archiver l'offre sans republier.
   Le numéro et le texte sont résolus à chaque clic (`open_campaign_link`).
2. **Référence lisible** « Réf. CODE » ajoutée au message : le commerçant
   la voit dans la conversation et déclare la provenance sur la commande
   (`order_campaigns`). Aucune attribution automatique.
3. **Compteurs agrégés uniquement** : total et clics par jour (fuseau de
   l'entreprise). Ni IP, ni cookie, ni identifiant d'appareil ; l'agent
   utilisateur sert seulement à exclure les robots d'aperçu et n'est pas
   enregistré. Plafond de comptage par fenêtre de 10 minutes.
4. **Indisponibilité explicite** : campagne archivée, entreprise inactive
   ou numéro absent → page « Lien indisponible » (410) sans numéro.
5. **Provenance dans une table séparée** pour ne pas modifier la date de
   mise à jour de la commande affichée au client.
6. **Partage manuel** partout ailleurs (devis, suivi, facture, client) :
   `wa.me` avec message prêt, envoyé par le commerçant lui-même.

## Conséquences

- Les chiffres sont indicatifs ; l'écran le dit.
- Le jour où l'API officielle sera branchée (Phase 14), le même code de
  campagne pourra être reconnu dans les messages entrants.
