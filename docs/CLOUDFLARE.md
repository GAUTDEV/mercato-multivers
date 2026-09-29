# Déploiement GitHub → Cloudflare Workers

Le jeu utilise un Worker et une base D1. Il ne doit pas être déployé comme un simple site statique Pages. Le Worker autonome sert l'interface et `/api/game`, sans le contrôle d'accès ChatGPT de Sites. Les sessions de jeu restent gérées par le cookie HttpOnly `mm_session`. Le site Sites existant continue de fonctionner indépendamment ; les parties de sa base ne sont pas migrées.

## Première installation

1. Créer un dépôt GitHub privé `mercato-multivers` avec un README initial, puis y transférer les sources.
2. Dans Cloudflare, créer une base D1 `mercato-multivers` et relever son identifiant UUID.
3. Dans les secrets GitHub Actions du dépôt, configurer :
   - `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte Cloudflare ;
   - `CLOUDFLARE_D1_DATABASE_ID` : UUID de la base créée ;
   - `CLOUDFLARE_API_TOKEN` : jeton limité au compte cible, avec Account / Workers Scripts / Edit et Account / D1 / Edit, ainsi que Account / Account Settings / Read si requis pour la résolution du compte. Ne jamais coller ce jeton dans le chat ou dans le dépôt.
4. Lancer Actions → Deploy Mercato Multivers → Run workflow.
5. Le workflow vérifie le typage et les tests, construit l'application, applique les migrations D1, puis publie le Worker. L'URL workers.dev est indiquée dans le résultat de Wrangler. Les prochains pushes sur main relancent ce déploiement.

Autre option : importer le dépôt dans Cloudflare Workers Builds, avec commande de build `pnpm run build:cloudflare` et commande de déploiement `pnpm run deploy:cloudflare`. Configurer `CLOUDFLARE_D1_DATABASE_ID` dans cet environnement et un jeton disposant également des droits D1. Choisir une seule des deux méthodes de déploiement automatique.

## Vérification locale

Après installation depuis le lockfile :

```sh
npm run build:cloudflare
npm run check:cloudflare
```

Le dry-run utilise uniquement un UUID factice pour valider le paquet sans déployer. Le script refuse cet UUID en mode production. Pour un déploiement local, se connecter avec Wrangler, définir `CLOUDFLARE_D1_DATABASE_ID`, puis lancer `npm run deploy:cloudflare`.

La configuration autonome est générée à partir de la sortie réelle de compilation dans `dist/server/wrangler.cloudflare.json`. Les chemins des modules ESM et des assets du framework sont conservés. La liaison `DB` pointe vers la base du compte Cloudflare cible. Les migrations versionnées proviennent de `drizzle/`.
