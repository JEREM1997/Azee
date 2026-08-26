# Refonte page par page — Krispy Kreme Operations

Ce document est l'inventaire de référence des écrans accessibles. Les redirections `/` et `/order` ne sont pas des écrans autonomes : elles orientent respectivement selon le rôle et vers `/orders`.

| Route | Objectif métier | Refonte appliquée | Mobile | Desktop | Statut |
|---|---|---|---|---|---|
| `/login` | Accéder à l'espace selon son rôle | Composition immersive, formulaire focalisé, erreurs d'authentification lisibles et attente dédiée | Formulaire monocolonne et visuel simplifié | Composition éditoriale en deux zones | Terminé |
| `/dashboard` | Comprendre l'activité du jour | Accueil opérationnel, KPIs, progression, raccourcis contextuels et état sans plan spécifique | KPIs réordonnés et contenu condensé | Synthèse multi-colonnes plafonnée | Terminé |
| `/production` | Composer et valider un plan | Atelier daté, résumé volumes/magasins/dates, actions IA et validation hiérarchisées | Commandes empilées, saisies tactiles | Barre de pilotage et grille de saisie large | Terminé |
| `/plans` | Retrouver, créer et modifier les plans | En-tête orienté pilotage, période intégrée, création prioritaire, erreur récupérable et état vide actionnable | Filtres et actions empilés | Historique dense et actions groupées | Terminé |
| `/orders` | Saisir puis suivre une commande client | Contexte de validation explicite, résumé du pipeline, formulaire et historique séparés | Formulaire monocolonne | Saisie structurée en deux zones | Terminé |
| `/delivery` | Piloter réceptions, déchets et anomalies | Résumé livré/confirmé/déchets/en attente, statut par magasin, détail contextuel et état vide daté | Liste puis détail, contrôles tactiles | Master/detail 1/3–2/3 | Terminé |
| `/stats` | Analyser production, coûts et déchets | Bandeau exécutif production/réception/déchets/coût, périodes, comparaisons et graphiques existants conservés | KPIs 2 colonnes, graphiques adaptatifs | Vue analytique large plafonnée | Terminé |
| `/admin` | Configurer magasins et catalogue | Résumé des objets configurés, navigation métier par onglets, formulaires contextuels | Onglets défilables et formulaires empilés | Catalogue et édition structurés | Terminé |
| `/users` | Administrer accès et périmètres | Résumé par rôle, création mise en avant, erreur récupérable et édition secondaire | Liste responsive, modales en feuille | Vue de gestion et actions discrètes | Terminé |
| `/users/create` | Créer un compte et ses permissions | Parcours guidé identité → rôle → magasins, retour contextuel, validation et feedback | Sections monocolonnes | Formulaire centré à largeur maîtrisée | Terminé |
| `/audit` | Contrôler les actions sensibles | En-tête de traçabilité, actualisation primaire, filtres dédiés et journal responsive | Lignes converties en résumés | Tableau filtrable | Terminé |
| `*` | Récupérer une navigation invalide | État 404 en français, explication claire et retour unique à l'espace | Panneau compact | Panneau centré | Terminé |

## Règles transversales vérifiées

- Une action dominante est conservée par contexte ; les actions utilitaires restent secondaires.
- Les résumés utilisent les données déjà chargées, sans inventer de tendances.
- Les états vides de production, plans, livraisons et dashboard expliquent le contexte métier.
- Les contrôles ont une cible tactile minimale de 44 px et les tableaux basculent en résumés verticaux sous 768 px.
- Les compositions sont plafonnées à 1320 px pour rester lisibles jusqu'à 1920 px.
- Les largeurs 375, 390, 430, 1024, 1280, 1440 et 1920 px sont couvertes par les règles responsive de l'application.
