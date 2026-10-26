# ADR-0009 — Suivi client privé par lien à jeton

- **Statut :** accepté
- **Date :** 2026-10-26

## Contexte

F10 : le client du commerçant suit sa commande sans créer de compte, via un
lien privé envoyé sur WhatsApp. Exigences bloquantes : jeton non devinable,
aucun accès croisé, lien expiré ou révoqué rejeté, pièces protégées, aucune
note interne exposée.

## Décision

1. **Jeton opaque de 256 bits** (base64url, 43 caractères), généré en base.
   Seul son SHA-256 est stocké (`tracking_links.token_hash`, colonne exclue
   des droits de lecture) ; le jeton n'est montré qu'une fois au
   commerçant. Un nouveau lien révoque l'ancien : une commande a au plus un
   lien actif.
2. **Accès anonyme par fonctions seulement** : `get_tracking_view` et
   `get_tracking_document` (`SECURITY DEFINER`) résolvent le jeton, vérifient
   révocation, expiration et entreprise active, puis renvoient une liste
   fermée de champs. La table reste fermée à `anon` (RLS, aucun droit).
3. **Réponse uniforme** : jeton inconnu ou mal formé → `{"state":
"not_found"}` sans autre information ; expiré ou révoqué → nom et
   téléphone du commerce seulement, pour redemander un lien.
4. **Limite de tentatives** en base (`private.hit_rate_limit`, fenêtres de
   10 min) : 30 échecs par clé client (condensat de l'IP), plafond global
   d'échecs, 300 consultations par lien. Un client bloqué l'est aussi pour
   un jeton valide pendant la fenêtre.
5. **Contenu choisi par le commerçant** : montants et pièces activables à
   la création ; historique réduit aux changements d'état (ni motif, ni
   auteur) ; jamais de notes, détails de fabrication ni mesures.
6. **Pièces rendues à la volée** depuis les données figées (instantanés de
   la facture émise, encaissement non annulé), réponse `no-store`, au lieu
   d'URL signées de stockage qui exigeraient une clé secrète serveur.
7. **Fuite d'URL limitée** : `Referrer-Policy: no-referrer`, `noindex`,
   `Cache-Control: private, no-store` sur `/suivi/*` ; la session Supabase
   n'est pas rafraîchie sur ces routes (hors `proxy`).

## Conséquences

- Révoquer est immédiat ; renvoyer un lien = en créer un nouveau.
- Les consultations sont visibles par le commerçant (date, nombre).
- La limite par IP pourra être ajustée après le pilote (passerelles
  opérateur partagées).
