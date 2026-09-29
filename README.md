# Mercato Multivers

Jeu multijoueur de mercato : 112 combattants de 8 univers, enchères publiques ou secrètes, équipes de 3 ou 5, placements cachés et duels stratégiques.

## Développement

Node.js 24 et pnpm (version déclarée dans package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Tests

```sh
node tests/run-engine-tests.mjs
node --test tests/api.test.mjs
pnpm exec tsc --noEmit
```

## Cloudflare

Voir [le guide de déploiement](docs/CLOUDFLARE.md). Le jeu nécessite Cloudflare Workers et une base D1. Le workflow GitHub Actions applique les migrations et déploie sur main après configuration des trois secrets Cloudflare. Aucun mot de passe ni jeton ne doit être ajouté aux sources.

```sh
pnpm run build:cloudflare
pnpm run check:cloudflare
```

Le dry-run ne publie rien. Le déploiement réel nécessite un compte Cloudflare autorisé.

## Architecture et limites

Voir [l'architecture](docs/ARCHITECTURE.md). Synchronisation HTTP, serveur autoritaire, stockage D1 et entraînement à bots avec connexion internet. Les tests automatisés ne remplacent pas la validation visuelle et les tests de charge.

Les personnages et portraits appartiennent à leurs ayants droit. Leur présence dans ce prototype ne confère aucun droit d'exploitation commerciale. Provenance dans [portrait-sources.json](docs/portrait-sources.json).
