# Plan d’implémentation — checkout de test Hammey Bijoux

## Périmètre validé

Construire une première version fonctionnelle en environnement de test, sans paiement réel : panier persistant, commande, persistance en base, Stripe Checkout, PayPal Sandbox, webhooks et confirmation.

## Approche technique

- **Frontend** : conserver la maquette HTML/CSS/JavaScript existante et remplacer le paiement simulé par des appels API.
- **Backend** : Node.js 22 + Express, servi par le même processus que la maquette.
- **Base** : base MySQL-compatible Manus via `DATABASE_URL`, avec une migration SQL additive et idempotente.
- **Paiements** : Stripe Checkout côté serveur et webhook Stripe signé ; PayPal Orders API côté serveur avec capture Sandbox.
- **Sécurité** : aucune donnée de carte dans l’application ; validation des champs, calcul serveur des montants, contrôle du stock, signatures webhook, secrets uniquement via l’environnement protégé.
- **Déploiement** : Dockerfile Node de production, endpoint `/api/health`, configuration serveur déjà activée.

## Données persistées

- produits et variantes avec prix et stock ;
- commandes, lignes de commande, client et adresse de livraison ;
- événements de paiement traités pour éviter les doublons ;
- identifiants Stripe et PayPal nécessaires au rapprochement.

## Flux de paiement

1. Le navigateur envoie le panier et les coordonnées au serveur.
2. Le serveur valide les produits, variantes, stocks et prix depuis sa source de vérité.
3. Le serveur crée une commande `pending`.
4. Pour Stripe, il crée une Checkout Session et redirige le navigateur vers Stripe.
5. Pour PayPal, il crée une commande PayPal et redirige vers l’approbation Sandbox.
6. Les webhooks/captures mettent à jour la commande uniquement après preuve du paiement.
7. La page de confirmation interroge la commande et affiche `paid`, `pending` ou `cancelled`.

## Design

- **Mouvement** : luxe éditorial contemporain, inspiré des magazines de mode.
- **Principes** : contraste profond, ornement maîtrisé, volumes généreux, parcours d’achat lisible.
- **Couleurs** : vert profond pour l’écrin, or pour les actions et la valeur, ivoire pour la lisibilité.
- **Typographie** : Bodoni Moda pour les titres et Jost pour l’interface, conformément à la maquette.
- **Voix** : directe, confiante et féminine ; les textes existants sont conservés.

## Étapes

1. Ajouter le serveur Express, le schéma SQL et les produits de référence.
2. Ajouter les endpoints de commande, Stripe et PayPal Sandbox.
3. Connecter le formulaire actuel au nouveau flux et ajouter la page de confirmation réelle.
4. Tester les endpoints, les montants et le flux de retour sans carte réelle.
5. Mettre à jour le Dockerfile, sauvegarder le checkpoint et republier uniquement la version de test.

## Limites de cette étape

L’administration, les e-mails automatiques, les photos réelles, les comptes clients et le passage en clés de production restent des étapes séparées. Aucun champ légal entre crochets ne sera inventé.
