# Devis IA — production candidate du 3 septembre 2026

## Décision validée

Replicate facture en USD; le calcul client se fait en CAD. Formule :
coût fournisseur USD × taux USD/CAD ÷ 0,60 ÷ valeur nette CAD du jeton,
arrondi au jeton supérieur et au moins égal au prix de départ configuré.
Il s'agit de 40 % de marge sur la vente, pas d'une majoration de 40 %.
La marge réelle reste dépendante des dépenses réelles, frais et échecs.

## Configuration nécessaire

Dans Administration → Coûts IA, renseigner la valeur nette prudente du jeton
(tenir compte des forfaits, bonus et frais) et le taux : 1 USD = X CAD.
Ce taux est manuel, sans mise à jour automatique. Aucun taux ni montant net
n'a été inventé. Ces deux paramètres étaient absents lors de l'implémentation.
Valider les unités et tarifs Replicate, puis autoriser les devis modèle par modèle.
Un tarif unique doit couvrir toutes les variantes accessibles; sinon ne pas activer.
Les variantes conditionnelles existent dans le moteur, pas encore dans l'éditeur.

Chaque devis conserve le coût USD, la valeur du jeton, le taux appliqué, sa source
manuelle et la date d'application (pas une prétendue date de marché).
Le client confirme un montant fixe en jetons avant le lancement.
L'équivalent net CAD sert à la comptabilité, pas à prétendre connaître le prix
d'achat brut des jetons du client.

## Portée et sécurité

Devis central pour image, fiche personnage, vidéo, outils Replicate, voix,
transcription, mixage et messages aux membres IA. Le devis est lié au compte,
à la fonction et à l'empreinte des paramètres, valable dix minutes.
Réservation atomique, rejeu sans deuxième débit du même devis, remboursement
unique en cas d'échec traité. Les appels fournisseur sont liés au devis;
les jetons sont comptés une seule fois au niveau de l'opération.
Les essais administratifs sans devis restent possibles.

Sans prix, unité bornée ou conversion, aucun lancement membre.
Les médias téléversés ne fournissent pas une durée fiable par simple déclaration
client. Les parcours non bornables restent donc indisponibles aux membres.
Story Blocks et jeu : budget complet non implémenté; essais administratifs conservés.
Les fonctions ne sont pas supprimées.

La limite Cancel-After est envoyée à Replicate. Elle ne garantit pas une marge
réelle, ni l'absence de frais si un appel échoue.
Une panne après réservation peut laisser un devis en running : rapprochement
administratif nécessaire; aucune relance ni remboursement automatique aveugle.
La récupération de résultat côté navigateur après interruption reste à compléter.
Le tableau de coûts est limité aux 500 dernières opérations et signale la limite.

## État de vérification

- Schéma AI-QUOTE-SCHEMA.sql appliqué à Supabase (migration ai_confirmed_quotes_atomic_reservation).
- Tests de calcul réussis : USD/CAD, marge, arrondi, valeurs manquantes, caractères,
  secondes, limites, unités texte, variantes et plans multi-appels.
- Tests SQL réussis dans une transaction annulée : propriétaire, réservation,
  double réservation refusée, solde insuffisant, remboursement unique et rejeu.
  Aucun solde réel modifié.
- Syntaxe vérifiée sur les fichiers modifiés.
- Aucun appel Replicate payant; aucune validation complète navigateur → API →
  média persisté. Build local bloqué par l'environnement Windows.
- Pas de déploiement de ces changements. Ne pas déclarer la fonctionnalité
  opérationnelle avant configuration et validation du parcours complet.
