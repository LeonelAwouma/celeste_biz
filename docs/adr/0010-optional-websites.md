# ADR-0010 — Site web métier : instantané publié et rendu multi-tenant

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F11 : un site facultatif par entreprise, construit à partir d'un modèle
métier, prévisualisé puis publié explicitement à `/sites/<adresse>`. Pas de
déploiement par entreprise, cache maîtrisé, aucune donnée privée exposée.

## Décision

1. **Brouillon et instantané séparés** (`websites.content`, `media`,
   `published`). `publish_website` copie dans l'instantané le modèle, les
   textes, les médias, les coordonnées publiques de l'entreprise et les
   prestations choisies (prix compris). La route publique ne lit que cet
   instantané, par `published_slug` : modifier le brouillon, le catalogue,
   la fiche entreprise ou l'adresse n'a aucun effet visible avant la
   publication suivante.
2. **Publication de la version prévisualisée** : `publish_website` exige la
   version du brouillon affichée (verrou optimiste) ; une modification
   concurrente oblige à revoir l'aperçu.
3. **Validation en base** : adresse (format, mots réservés, unicité y
   compris face aux adresses publiées des autres sites), prestations
   publiques et actives de l'entreprise uniquement, chemins de photos dans
   le dossier de l'entreprise, tailles bornées. Écritures réservées au
   propriétaire et au gestionnaire.
4. **Photos privées par défaut** (`site-images`, bucket non public). Une
   politique de stockage autorise `anon` à lire un fichier seulement s'il
   figure dans la liste `assets` d'un instantané publié et visible
   (`is_public_site_asset`), y compris les photos du catalogue choisies.
   Elles sont servies par une route du site, sans clé secrète.
5. **Rendu multi-tenant mis en cache** : `getPublicSite` (`"use cache"`,
   client anonyme sans cookies) est étiqueté `site:<adresse>` et invalidé
   par `updateTag` à la publication (ancienne et nouvelle adresse), au
   retrait et au changement de modules ou de métier.
6. **Un seul composant de rendu** (`SiteView`) pour l'aperçu et le site
   public ; l'aperçu lit le brouillon et le catalogue actuel via la session
   du commerçant et des URL signées.
7. **Modèles à sections fixes** (couture, traiteur, générique) : ordre des
   sections, intitulés, message WhatsApp prérempli ; couleurs d'accent
   choisies dans une palette au contraste suffisant avec le texte blanc.

## Conséquences

- Republier est nécessaire pour refléter un changement de prix ou de
  numéro WhatsApp ; l'écran l'indique.
- Ajouter un modèle = une entrée dans `features/websites/templates.ts` et
  dans la contrainte `template_key`.
- Sous-domaines et domaines personnels pourront résoudre le même
  instantané sans changer le modèle de données.
