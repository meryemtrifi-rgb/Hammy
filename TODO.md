# Objectifs — checkout de test Hammey Bijoux

- Le serveur Node/Express sert la maquette actuelle et expose `GET /api/health` avec une réponse 2xx.
- Le serveur expose `GET /api/produits` et `GET /api/produits/:id` avec les produits, variantes, prix et stocks issus de la source serveur.
- Le serveur valide l’e-mail, le prénom, le nom, l’adresse, le code postal à cinq chiffres, la ville, le pays et le mode de livraison avant de créer une commande.
- Le serveur recalcule le sous-total, la livraison standard à 4,90 €, la livraison express à 9,90 € et la gratuité à partir de 80 € ; il ne fait pas confiance aux prix envoyés par le navigateur.
- Le serveur refuse une variante inconnue, une quantité invalide ou un stock insuffisant.
- Le serveur persiste les commandes, les lignes, le montant et l’état de paiement dans la base MySQL-compatible Manus.
- Le paiement Stripe passe par une Checkout Session créée côté serveur et le webhook `/api/stripe/webhook` vérifie la signature sur le corps brut.
- Le paiement PayPal passe par l’API Orders Sandbox et une capture serveur après approbation.
- La commande n’est marquée payée qu’après webhook Stripe ou capture PayPal réussie ; un retour navigateur seul ne confirme pas le paiement.
- Le formulaire de commande ouvre le prestataire choisi et conserve la commande en attente jusqu’à confirmation.
- La page de confirmation affiche le numéro de commande, le montant et l’état réel de la commande.
- Aucun numéro de carte, cryptogramme, date d’expiration, clé secrète ou payload brut de webhook n’est enregistré.
- Le Dockerfile de production installe les dépendances, démarre le serveur sur `PORT` et sert `/api/health`.

- Le site propose « Créer un compte / Se connecter » via Manus OAuth et ne stocke aucun mot de passe Hammey.
- Le serveur valide la session `webdev_app_session` avec le JWT Manus, protège le flux OAuth par state/nonce et utilise un cookie HTTPS compatible Preview.
- Un compte créé affiche une proposition d’offre de bienvenue sans inventer de montant ni de code promotionnel.
- La newsletter possède un formulaire public et une inscription depuis l’espace client avec consentement explicite non précoché.
- Les inscriptions newsletter et les consentements sont persistés avec e-mail, statut, date et source ; une inscription sans consentement est refusée.

- La démonstration affiche clairement son statut TEST et n’utilise pas de données présentées comme réelles.
- Le code promotionnel de test HAMMEYTEST10 applique 10 % à partir de 30 € et le montant transmis au paiement est recalculé.
- L’espace client affiche l’historique des commandes liées au compte authentifié.
- La désinscription newsletter est disponible par adresse e-mail.
