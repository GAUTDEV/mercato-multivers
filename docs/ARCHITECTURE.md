# Architecture du jeu

112 personnages de 8 univers, enchères publiques ou secrètes, équipes de 3 ou 5, compositions cachées et championnat où chaque paire de joueurs s'affronte. Le mode entraînement utilise le même moteur et des bots ; il nécessite une connexion.

`app/api/game/route.ts` reçoit les actions. D1 conserve les salons avec une version monotone. Chaque action valide l'état puis effectue une écriture conditionnelle sur la version, avec relance en cas de concurrence. Les identifiants de requête rendent les relances idempotentes. Une session aléatoire dans un cookie HttpOnly identifie le joueur. Budgets, résultats et échéances sont calculés au serveur ; les données secrètes sont retirées des réponses destinées aux autres joueurs.

Le client interroge le serveur toutes les 800 ms (2,5 s en arrière-plan). Une requête fait progresser les phases expirées. Sans aucun client connecté, les phases intermédiaires attendent la prochaine requête. L'actualisation restaure la partie avec le cookie. Un départ explicite transforme la place en bot.

## Normalisation

Les statistiques sont des choix éditoriaux de gameplay, pas des mesures canoniques. Chaque personnage reçoit un rang relatif D à SS dans son univers, puis un profil de rôle et deux spécialités. Les centres de rang sont 39, 47, 56, 64, 72, 78. Chaque spécialité ajoute 9 points et chaque autre stat retire 3 points, conservant la somme avant plafonnement (18 à 98). Tous les univers utilisent la même échelle. Les passifs, les slots et les contre-matchups peuvent permettre à un A de battre un S.

Le moteur ne dépend pas des noms des licences. Ajouter un univers nécessite une entrée dans UNIVERSES, des données de personnages, leurs portraits et leur provenance.

## Duels

La puissance, la technique et la portée déterminent la pression offensive, opposée à la résistance, l'endurance et l'intelligence. Vitesse, contrôle, contre de rôle et passifs modulent cette pression. Une variabilité déterministe bornée à ±2,5 % par combattant départage les duels serrés. Les animations illustrent le résultat calculé. Tous les slots sont joués pour permettre des départages cohérents en championnat.

## Vérification

`npm test` vérifie le catalogue, les budgets, les règles d'enchères, les données cachées, la reprise par bots et vingt parties complètes. Les tests API utilisent les vrais handlers et SQLite avec un adaptateur D1 ; ils ne constituent pas un test distribué Cloudflare. Le responsive et la charge réseau restent à vérifier avec des joueurs.
