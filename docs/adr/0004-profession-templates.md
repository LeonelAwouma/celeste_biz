# ADR-0004 — Profils métiers déterministes et versionnés

- **Statut :** accepté
- **Date :** 2026-10-25

## Contexte

F02 : adapter l'application au métier (couture, traiteur, générique) sans IA,
sans migration par entreprise et sans imposer un workflow incompatible.

## Décision

1. **Registre en code** (`features/professions/registry.ts`), validé par un
   schéma Zod (`schema.ts`) : libellés, modules facultatifs proposés et
   activés par défaut, champs de commande typés (texte, date, nombre, liste,
   mesures), libellés d'états, étapes de réalisation.
2. **Miroir en base** : table `profession_templates (key, version, schema)`,
   immuable (trigger), référencée par `businesses (profession_key,
profession_version)`. Un test d'intégration vérifie que la base et le
   registre sont identiques ; `npm run professions:sql` produit les lignes
   SQL d'une nouvelle version.
3. **Versionnage** : une version publiée ne change jamais. Une évolution crée
   la version N+1 ; changer de métier dans les paramètres passe à la dernière
   version. Les commandes futures stockeront leurs informations métier en
   JSON validé, sans modification du schéma SQL.
4. **Modules** : cœur toujours actif (commandes, clients, catalogue,
   encaissements, factures) ; facultatifs (devis, site, mesures,
   événements) activables par le propriétaire dans `business_settings.modules`
   (clés et booléens contrôlés par une contrainte SQL). Un module non proposé
   par le métier n'est jamais activé.
5. **Validation serveur** des informations métier d'une commande générée à
   partir du profil (`buildOrderDetailsSchema`) : champs obligatoires, clés
   inconnues refusées, dates réelles, mesures en cm bornées. Les champs
   `private` (ex. mesures) sont exclus de toute vue client
   (`publicOrderDetails`).
6. **Navigation** : la barre de navigation reste statique (affichage
   immédiat sur réseau lent) ; les modules désactivés disparaissent de
   « Plus » et leur page explique comment les réactiver.

## Conséquences

- Ajouter un métier = ajouter une entrée au registre + une migration, sans
  toucher au noyau.
- Le formulaire de commande (Phase 5) s'appuiera sur `orderFields` et sur le
  schéma de validation déjà testé.
