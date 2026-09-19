# Assistant de développement administratif

## Fonctionnement

L’onglet **Coder** est réservé aux administrateurs. Une demande en langage simple
est envoyée à `anthropic/claude-sonnet-4.6` par Replicate avec une sélection limitée
des fichiers du dépôt. La proposition est conservée dans Supabase pour révision.

Après une seconde confirmation administrative, le serveur crée une branche GitHub,
y écrit les fichiers proposés et ouvre une demande de fusion en brouillon. Il ne
fusionne pas la demande et ne déclenche aucune publication directe.

## Configuration serveur Vercel

- `REPLICATE_API_TOKEN` : jeton Replicate déjà utilisé par la plateforme.
- `GITHUB_REPO_TOKEN` : jeton GitHub finement limité au seul dépôt, avec lecture et
  écriture du contenu et des demandes de fusion. Ne jamais l’exposer au navigateur.
- `GITHUB_REPOSITORY` : `merikpelletier/cohconsavant`.
- `GITHUB_DEFAULT_BRANCH` : `main`.

Le dépôt GitHub doit contenir la source courante avant le premier usage. La connexion
de Codex à GitHub ne remplace pas `GITHUB_REPO_TOKEN` dans l’application déployée.

## Protections

- authentification administrateur vérifiée côté serveur;
- aucun accès public à la table `admin_code_proposals`;
- maximum de 12 fichiers donnés en contexte et 6 fichiers modifiés;
- secrets, fichiers d’environnement, justificatifs, paiements et verrous de
  dépendances exclus;
- les nouveaux fichiers sont limités à `src/components/admin/`;
- une proposition identique au fichier d’origine est rejetée;
- branche et demande de fusion en brouillon obligatoires avant tout déploiement.

## Coûts

L’usage est interne et ne retire aucun jeton aux membres. Les coûts Replicate sont
enregistrés sous `admin_coder`. Tarif fournisseur configuré le 19 septembre 2026 :
0,003 USD par 1 000 jetons d’entrée et 0,015 USD par 1 000 jetons de sortie. Le tarif
doit être revérifié s’il change chez Replicate.

## État de validation

- code et schéma Supabase installés dans la copie locale;
- syntaxe vérifiée;
- aucun appel Replicate payant exécuté;
- aucune branche ni demande de fusion réelle créée;
- aucune publication Vercel effectuée;
- validation complète à faire après chargement de la source dans GitHub et ajout du
  jeton GitHub serveur dans Vercel.
