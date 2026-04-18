# SecureCorp Local Testing Guide

## Etat actuel

L'application est globalement fonctionnelle sur sa base actuelle:

- `identity-kdc` gere `login` et `request-ticket`
- `policy-pdp` prend les decisions RBAC, ABAC et policies JSON
- `resource-*` valident ticket + authenticator puis interrogent le PDP
- `audit-log` stocke les evenements en memoire


## Redis dans l'etat actuel

Redis sert uniquement a la protection anti-replay.

Concretement:

- chaque authenticator transporte un `nonce`
- le couple `ticketId + nonce` est conserve avec TTL
- si la meme preuve revient, le profil `secure` la rejette

Si Redis n'est pas configure, le projet retombe sur un store memoire local.

## PostgreSQL dans l'etat actuel

PostgreSQL n'est pas encore branche dans le flux metier.

Aujourd'hui:

- les utilisateurs viennent du seed in-memory
- les ressources viennent du seed in-memory dans chaque resource service
- les evenements d'audit restent en memoire dans `audit-log`

## Lancer en local sans Docker

### Profil secure

```bash
npm install
npm run start:local:secure
```

### Profil vulnerable

```bash
npm install
npm run start:local:vulnerable
```

Ces scripts demarrent les 7 services NestJS sans Redis ni PostgreSQL.

## Tests disponibles

### Tests unitaires

```bash
npm test
```

Cette commande couvre:

- tickets
- authenticators
- RBAC
- ABAC
- policy engine
- seeded data

### Smoke tests end-to-end

Une fois la stack locale lancee:

```bash
npm run test:smoke:secure
```

ou:

```bash
npm run test:smoke:vulnerable
```

Le smoke test verifie:

- health endpoints
- login
- request-ticket
- lecture autorisee par alice
- replay attack
- acces cross-department par bob
- acces externe secret par eve
- audit trail

## Fichier HTTP manuel

Le fichier de test manuel est:

- `docs/securecorp-manual-tests.http`

Il sert a visualiser le flow exact et a jouer les cas secure et vulnerable a la main.

## Helper pour l'authenticator

Comme la ressource attend une preuve signee, il faut calculer `X-Authenticator` a partir de:

- `sub`
- `service`
- `timestamp`
- `nonce`
- `request_hash`
- `serviceSessionKey`

Helper fourni:

```bash
node scripts/demo/generate-authenticator.mjs --sub user-finance-001 --service resource-finance --method GET --path /api/resource/fin-doc-001 --session-key "SERVICE_SESSION_KEY"
```

Le script retourne le token a copier dans `X-Authenticator`.