# Mise en production — Vercel + Supabase

Aucun compte, domaine ni secret n'est fourni dans ce dépôt : chaque valeur
ci-dessous est à créer par l'équipe Céleste Corp. Région recommandée la plus
proche des utilisateurs (Europe de l'Ouest, ex. Paris ou Francfort) tant
qu'aucune région africaine n'est proposée par les deux services.

## 1. Supabase

1. Créer le projet (offre payante recommandée pour les sauvegardes
   quotidiennes et la restauration à un instant donné, voir
   [OPERATIONS.md](./OPERATIONS.md)).
2. Appliquer les migrations depuis un poste de confiance :
   `npx supabase link --project-ref <ref>` puis `npx supabase db push`.
   **Ne jamais exécuter `supabase/seed.sql` en production** (comptes
   fictifs).
3. Auth → URL Configuration : _Site URL_ = URL de l'application ;
   _Redirect URLs_ : `<URL>/auth/confirm`.
4. Auth → Email : confirmation d'adresse activée, mot de passe de 8
   caractères minimum avec lettres et chiffres, modèles
   `supabase/templates/confirmation.html` et `recovery.html`.
5. SMTP de production (l'envoi intégré de Supabase est limité en volume).
6. Storage : les buckets `catalog-images`, `site-images` et `documents`
   sont créés par les migrations, **privés** ; ne pas les rendre publics.
7. Vérifier dans _Advisors_ (sécurité, performance) qu'aucune table
   publique n'est sans RLS.

## 2. Vercel

1. Importer le dépôt GitHub ; _Framework_ Next.js, commande `npm run build`.
2. Variables d'environnement (Production et Preview) :

| Variable                               | Valeur                                           | Secret |
| -------------------------------------- | ------------------------------------------------ | ------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL du projet Supabase                           | non    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé « publishable »                              | non    |
| `NEXT_PUBLIC_APP_URL`                  | URL publique (domaine choisi)                    | non    |
| `FEATURE_FISCAL_INVOICE_ISSUE`         | `false` tant que la conformité n'est pas validée | non    |
| `FEATURE_ONLINE_PAYMENTS`              | `false`                                          | non    |
| `FEATURE_WHATSAPP_API`                 | `false`                                          | non    |
| `FEATURE_OFFLINE_DRAFTS`               | `false`                                          | non    |

`SUPABASE_SECRET_KEY` n'est **pas** utilisée par l'application à ce stade :
ne pas la configurer tant qu'une fonctionnalité ne l'exige pas.

3. Domaine : configurer le domaine choisi puis mettre à jour
   `NEXT_PUBLIC_APP_URL` et l'URL Supabase Auth. Les sous-domaines
   `<slug>.domaine` des sites (cahier §5.11) viendront après.
4. Activer la protection des déploiements de prévisualisation (Vercel
   Authentication) : les Preview utilisent le même projet Supabase de
   préproduction, jamais celui de production.

## 3. Avant d'ouvrir au public

- `npm run check` vert sur la branche déployée (CI GitHub Actions :
  `.github/workflows/ci.yml`).
- `GET /api/health` renvoie `{"status":"ok"}` sur l'URL de production.
- Sonde externe (UptimeRobot ou équivalent) sur `/api/health` toutes les
  5 minutes, alerte par e-mail.
- Restauration testée au moins une fois sur un projet de préproduction
  (voir [OPERATIONS.md](./OPERATIONS.md)).
- Émission fiscale des factures : reste désactivée (double interrupteur
  `FEATURE_FISCAL_INVOICE_ISSUE` + `private.platform_flags`) jusqu'à
  validation réglementaire.
