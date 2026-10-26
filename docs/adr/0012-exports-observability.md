# ADR-0012 — Exports CSV, quotas et supervision sans données sensibles

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F15 et F16 : chaque entreprise doit pouvoir récupérer ses données ; les
erreurs doivent être visibles par l'équipe sans exposer de jeton ni de
donnée personnelle ; l'usage doit être borné pour protéger le service.

## Décision

1. **Exports générés côté serveur** par une route authentifiée
   (`/dashboard/exports/telecharger`) : session de l'utilisateur, RLS et
   filtre explicite `business_id`, rôles propriétaire et gestionnaire.
2. **Format Excel français** : UTF-8 avec BOM, « ; », CRLF, cellules entre
   guillemets, virgule décimale. Les cellules de texte commençant par
   = + - @, tabulation ou retour chariot sont préfixées d'une apostrophe ;
   les montants, produits par l'application, sont typés et jamais
   préfixés.
3. **Traçabilité et quota en base** : `log_export` vérifie le rôle,
   consomme le quota et écrit le journal ; l'export n'est renvoyé que si
   l'appel réussit.
4. **Quotas génériques** `consume_quota(entreprise, type)` sur la table de
   fenêtres de la Phase 8 ; limites centralisées dans
   `private.quota_limit`, futures valeurs d'offre.
5. **Journalisation masquée** : `logEvent` produit une ligne JSON lue par
   l'hébergeur ; tout texte passe par `redact` (jetons de chemin,
   paramètres de requête sensibles, JWT, clés, e-mails, téléphones). Les
   chemins sont journalisés sans requête.
6. **`digest` comme lien** entre l'erreur vue par l'utilisateur et la ligne
   de journal, sans afficher le message technique.
7. **Contrôle des secrets** par script versionné, en local et en CI.

## Conséquences

- Brancher un service d'alerte = compléter `instrumentation.ts` en
  réutilisant `redact`.
- Ajouter un export = une entrée dans `features/exports/definitions.ts` et
  dans la liste de `log_export`.
