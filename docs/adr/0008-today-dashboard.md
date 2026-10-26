# ADR-0008 — Tableau « Aujourd'hui » : agrégats et alertes déterministes

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F09 : montrer en ouvrant l'application ce qui demande une action (retards,
remises proches, soldes, devis sans réponse), avec le fondement de chaque
alerte et un lien vers les dossiers, sans estimation ni « bénéfice ».

## Décision

1. **Une fonction SQL** `dashboard_summary(entreprise, seuil_h, seuil_j,
limite)` renvoie en un aller-retour les compteurs, les 5 premiers
   dossiers de chaque alerte (identifiant, numéro, client, échéance, état,
   solde) et les seuils appliqués. Seuils et limite sont bornés.
2. **`SECURITY DEFINER` avec contrôle d'adhésion explicite** : la RLS
   évaluée ligne à ligne coûtait ~2 s pour 5 000 commandes ; la fonction
   vérifie une fois `is_business_member` puis filtre chaque requête sur
   l'entreprise (~18 ms). Elle est en lecture seule (`stable`).
3. **Règles identiques partout** : « en cours » = ni brouillon, ni remise,
   ni clôturée, ni annulée ; « en retard » = en cours et échéance dépassée ;
   « soldes » = solde positif hors brouillons et annulées ; encaissements
   comptés hors annulés, échoués, remboursés ou en attente. Les liens
   « Tout voir » ouvrent `list_orders` avec les mêmes règles (`late`,
   `soon`, `unassigned`, `to_collect`).
4. **Textes construits côté TypeScript** (`features/dashboard/alerts.ts`,
   fonction pure testée) : titre au pluriel correct, fondement, libellés
   d'état propres au métier. « Sans responsable » n'apparaît que si
   l'équipe compte plusieurs membres ; « devis » seulement si le module est
   actif.
5. **Aucun indicateur estimé** : pas de marge ni de bénéfice ; les montants
   encaissés sont dits « déclarés ».

## Conséquences

- Ajouter une alerte = une clé dans la fonction SQL, un cas dans
  `buildAlerts`, un test pgTAP.
- Les seuils pourront devenir des paramètres d'entreprise sans changer
  l'écran.
