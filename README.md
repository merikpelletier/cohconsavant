# Le Cochon Savant

Application React/Vite autonome reliée au projet Supabase existant et préparée pour Vercel.

## État du transfert — 1 septembre 2026

- Préversion privée Vercel : `https://le-cochon-savant-lb601itk1-sckript.vercel.app` (`sckript/le-cochon-savant`).
- Lecture serveur Vercel → Supabase vérifiée avec les dossiers publiés.
- 101 médias hérités copiés dans le compartiment public Supabase `site-media`.
- Aucun lien externe vers `base44.app` ne subsiste dans les tables publiques.
- Accueil, boutique et inventaire affiché, 13 profils membres et quiz vérifiés dans la préversion sans erreur navigateur ni image brisée.
- Connexions serveur Replicate, Dreamlove B2B et Authorize.Net Production vérifiées en lecture seule depuis Vercel.
- Parcours Boutique → fiche produit vérifié avec produit, prix, options, image et action panier.
- Aucun achat ni génération payante n'a été déclenché pendant ces vérifications; ces parcours transactionnels restent à tester séparément avant une mise en production.

## Configuration

Copier `.env.example` vers `.env.local`, puis fournir les clés publiques Supabase pour le navigateur et la clé secrète uniquement pour les fonctions serveur.

## Commandes

- `npm install`
- `npm run dev`
- `npm run build`

La clé `SUPABASE_SECRET_KEY` ne doit jamais être préfixée par `VITE_` ni exposée au navigateur.

## Messagerie administrative

Les messages envoyés depuis « Écrivez-nous » sont enregistrés dans la boîte « Messages » de l'administration. Ils sont lus et marqués comme traités dans la plateforme; ce parcours ne doit envoyer aucun courriel externe.

## Modèle IA validé

- L’outil **Portrait** utilise **Google Nano Banana 2** (`google/nano-banana-2`) avec le portrait téléversé comme référence d’identité.
- Ce choix concerne uniquement l’outil Portrait.

## Nouvel acteur — parcours validé

- L’objectif est d’offrir une façon ludique, visuelle et facile de créer des personnages, sans exposer un formulaire technique complexe.
- L’utilisateur peut créer un acteur à partir de ses propres photos.
- Il peut également employer les photos d’une autre personne lorsqu’il possède le droit de les utiliser.
- L’administration pourra publier des personnages modèles sélectionnables par les utilisateurs.
- À partir d’un personnage modèle, l’utilisateur pourra remplacer le visage par celui d’une autre personne, incluant son propre visage.
- Le remplacement doit conserver le corps, le costume, la pose et le style du personnage modèle.
- Les costumes et looks pourront provenir d’un catalogue administré ou de références téléversées par l’utilisateur.

## Accès temporaire au Studio

- Le Studio affiche « Bientôt disponible » au public pendant sa préparation.
- Les comptes ayant le rôle administrateur conservent l’accès complet afin de consulter et valider les changements.

## Publications des membres

- Un membre connecté peut créer une publication directement dans la section « Mes posts » de son profil.
- Le formulaire accepte un titre, un texte, jusqu’à quatre photos et des liens.
- Après publication, la liste « Mes posts » est actualisée immédiatement.
- Le fil communautaire et « Mes posts » présentent les publications de la plus récente à la plus ancienne.

## Profil des membres

- Les membres peuvent téléverser eux-mêmes l’avatar, les images de galerie et la bannière de leur profil.
- L’éditeur occupe la hauteur disponible de l’écran et possède une zone de défilement permanente.
- Chaque profil annonce la future publication de dossiers : développement d’une communauté, vente de contenus et d’articles, et soutien d’annonceurs sans minimum de fans ou d’abonnés.
- Tant que la publication de dossiers n’est pas ouverte aux membres, la création et la gestion de campagnes sont masquées aux utilisateurs publics dans le profil; les administrateurs conservent l’accès.
- La section privée « Sponsors & contributeurs » est également masquée aux membres jusqu’à son ouverture; les administrateurs conservent l’accès pour la préparer et la vérifier.

## Espace commanditaire

- Le public et les membres voient une annonce « Bientôt disponible » présentant les futurs emplacements : sections, contenus officiels, contenus de membres et profils de membres.
- Les comptes administrateurs conservent l’accès à l’espace commanditaire existant pour préparer et vérifier la fonction.

## Registre financier administratif

- L’administration possède un onglet « Transactions » réservé aux administrateurs.
- Il regroupe les commandes, achats et utilisations de crédits, ventes de commandites et paiements aux membres déjà enregistrés par la plateforme.
- Les totaux mensuels affichent les ventes encaissées, la TPS, la TVQ et le montant hors taxes à partir des montants réellement stockés; aucun taux n’est inventé dans l’interface.
- Un dépôt fiscal peut être enregistré pour chaque mois avec sa date, sa référence et des notes. Le dépôt conserve un instantané des montants TPS et TVQ du mois.
- Les dépôts fiscaux sont stockés dans une table Supabase non accessible aux comptes publics ou membres; seul le serveur administratif y accède après validation du rôle administrateur.

## Devis IA en CAD — candidat non déployé

Voir [docs/AI-QUOTES.md](docs/AI-QUOTES.md) pour le périmètre, la configuration
USD → CAD, les tests et les limites. La confirmation d'un devis et le contrôle
préalable remplacent l'observation seule pour les services membres concernés.
La validation complète avec génération réelle reste à faire.

## Observation des coûts IA (phase initiale)

- L’administration possède un onglet « Coûts IA » qui enregistre les prédictions Replicate terminées sans intervenir dans leur exécution.
- L’inventaire couvre les outils visuels, la voix, la transcription, l’assistant de production, les membres IA, les Story Blocks, les quiz et le jeu.
- Tous les services d’intelligence artificielle doivent être exécutés par Replicate. La synthèse vocale utilise `elevenlabs/v2-multilingual` via Replicate; aucun appel direct à ElevenLabs n’est requis.
- Chaque événement conserve le modèle, la version, le statut, les durées Replicate, les unités d’entrée/sortie, l’outil, les tokens facturés lorsqu’ils sont connus et un coût fournisseur estimé lorsque le tarif du modèle a été configuré.
- Les tarifs des modèles, la valeur moyenne d’un token et la conversion USD vers CAD sont configurables par l’administrateur; aucune valeur financière n’est présumée.
- Le suivi est non bloquant : une erreur d’enregistrement des coûts ne doit jamais interrompre la génération du client.
- Un service facturé aux membres doit toutefois posséder un prix en tokens actif et supérieur à zéro; sinon il reste temporairement inaccessible aux membres, sans être supprimé. Les administrateurs peuvent continuer à le tester.
- Les seuils automatiques de rentabilité demeurent désactivés pendant la phase d’observation.

## Assistant de développement administratif — candidat non déployé

L’onglet « Coder » de l’administration utilise `anthropic/claude-sonnet-4.6`
exclusivement par Replicate. Il prépare une proposition révisable, puis crée une
branche GitHub et une demande de fusion en brouillon après confirmation d’un
administrateur. Il ne fusionne jamais la demande et ne publie jamais directement.

Voir [docs/ADMIN-CODER.md](docs/ADMIN-CODER.md) pour la connexion GitHub serveur,
les protections et l’état exact de validation.

## Régressions à restaurer — 2 septembre 2026

Ces informations existaient avant le transfert et ne sont plus affichées dans la version actuelle :

- les prix en tokens des outils;
- les prix des abonnements;
- les prix des packages de crédits.

Il faut restaurer les valeurs de la dernière version validée. Aucun montant ne doit être inventé s'il n'est pas retrouvé dans les données ou le code d'origine.

## Règle d’acceptation permanente des transferts

Une page affichée ou une compilation réussie ne prouve pas qu’une fonction a été transférée. Toute fonction héritée doit être inventoriée avec sa dépendance Base44 d’origine, son remplacement Supabase/Vercel et un test réel couvrant l’interface, l’API, les données persistées et les permissions. Une fonction n’est déclarée opérationnelle qu’après la réussite de ce parcours complet; sinon elle demeure explicitement non validée.
