# Exploitation — supervision, sauvegardes, quotas, incidents

## Supervision

| Élément             | Où                                     | Ce qu'on y trouve                                        |
| ------------------- | -------------------------------------- | -------------------------------------------------------- |
| Disponibilité       | `GET /api/health`                      | `200 {"status":"ok"}` ou `503` si la base ne répond pas  |
| Erreurs serveur     | Journaux Vercel (`instrumentation.ts`) | une ligne JSON `request_error` par erreur, avec `digest` |
| Base de données     | Supabase → Logs, Reports, Advisors     | requêtes lentes, erreurs Postgres, alertes de sécurité   |
| Actions des équipes | Application → Plus › Exports › Journal | émissions, annulations, exports, publications, rôles     |

Les journaux techniques sont **masqués** (`lib/observability/redact.ts`) :
jetons de suivi et d'invitation, paramètres de requête, JWT, clés, e-mails
et numéros de téléphone n'y figurent jamais en clair. Le `digest` affiché
dans la page d'erreur permet de retrouver la ligne correspondante.

Un service d'alerte (Sentry ou équivalent) pourra être branché dans
`instrumentation.ts` une fois le compte choisi ; ne pas y transmettre de
contenu métier.

## Sauvegardes et restauration

- **Supabase** : sauvegardes quotidiennes automatiques sur les offres
  payantes (durée de rétention selon l'offre) ; la restauration à un
  instant donné (PITR) est une option payante à activer avant la
  commercialisation. L'offre gratuite n'offre pas de sauvegarde
  téléchargeable : ne pas y héberger de données réelles.
- **Copie indépendante** hebdomadaire (en plus des sauvegardes Supabase),
  depuis un poste de confiance :
  `npx supabase db dump --db-url "$DATABASE_URL" -f sauvegarde-AAAA-MM-JJ.sql`
  (schéma) et `--data-only` (données), chiffrée puis stockée hors de
  Supabase. Les fichiers du stockage (photos, PDF archivés) se copient avec
  l'API Storage ou `rclone`.
- **Test de restauration** (avant ouverture, puis trimestriel) : restaurer
  sur un projet de préproduction, lancer `npm run test:db` contre lui,
  ouvrir une facture émise et vérifier que son PDF archivé a le même
  condensat (`pdf_sha256`). Noter la date et la durée du test.
- **Rétention** : les factures émises et avoirs ne sont jamais supprimés
  par l'application (obligations comptables) ; l'export CSV permet à chaque
  entreprise de récupérer ses données.

## Quotas (par entreprise, fenêtre de 10 minutes)

| Action                           | Limite                      | Comportement au-delà                           |
| -------------------------------- | --------------------------- | ---------------------------------------------- |
| Export CSV                       | 30                          | réponse 429, message « réessayez dans 10 min » |
| Envoi de photo (catalogue, site) | 60                          | message d'erreur, rien n'est envoyé            |
| Échecs d'ouverture d'un suivi    | 30 par client, 600 au total | lien considéré introuvable                     |
| Consultations d'un lien de suivi | 300                         | lien considéré introuvable pendant la fenêtre  |
| Clics comptés par campagne       | 1 000                       | redirection maintenue, clic non compté         |

Les valeurs sont dans `private.quota_limit` et les fonctions SQL ; elles
deviendront des droits d'offre en Phase 16.

## Exports

`/dashboard/exports` (propriétaire, gestionnaire) : CSV UTF-8 avec BOM,
séparateur « ; », formules neutralisées, 20 000 lignes au maximum par
fichier, données filtrées par entreprise (filtre explicite + RLS), chaque
export inscrit au journal (type, période, nombre de lignes).

## Coûts à suivre

Vercel (fonctions, bande passante), Supabase (base, stockage, sorties
réseau, e-mails), SMTP, nom de domaine, sonde de disponibilité. Relever
chaque mois les compteurs des tableaux de bord des fournisseurs ; aucun
montant n'est estimé ici.

## Incident : premières actions

1. Vérifier `/api/health` et le statut des fournisseurs (status.vercel.com,
   status.supabase.com).
2. Rechercher les lignes `request_error` récentes dans Vercel ; relier au
   `digest` signalé par l'utilisateur.
3. Fuite suspectée d'un lien de suivi : le commerçant révoque le lien
   depuis la commande (effet immédiat).
4. Compte compromis : le propriétaire retire le membre (Paramètres ›
   Équipe) ; en dernier recours, désactiver l'utilisateur dans Supabase Auth.
5. Consigner l'incident (date, impact, cause, correction) et prévenir les
   entreprises concernées si des données ont pu être exposées.
