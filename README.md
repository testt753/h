# SecureCorp Zero-Trust Monorepo

Architecture cible:

- `Node.js 20`
- `NestJS` pour les services
- `Nx` pour le monorepo
- double profil `secure` et `vulnerable`
- tickets Kerberos-like, authenticators HTTP, RBAC, ABAC et PDP JSON

## Services

- `identity-kdc`
- `policy-pdp`
- `audit-log`
- `resource-hr`
- `resource-finance`
- `resource-it`
- `resource-operations`

## Lancer en local

```bash
npm install
npm run build
```

Stack complete sans Docker:

```bash
npm run start:local:secure
```

ou:

```bash
npm run start:local:vulnerable
```

Un service seul:

```bash
npx nx serve identity-kdc
npx nx serve policy-pdp
npx nx serve audit-log
npx nx serve resource-finance
```

## Docker

Stack sécurisée:

```bash
docker compose -f deployments/docker/compose.secure.yml up --build
```

Stack vulnérable:

```bash
docker compose -f deployments/docker/compose.vulnerable.yml up --build
```

Les deux stacks peuvent tourner en parallèle car les ports exposés diffèrent.

## Flow API minimal

1. login sur `identity-kdc`
2. demande de ticket de service
3. appel ressource avec `X-Service-Ticket` et `X-Authenticator`

### Login

```bash
curl -X POST http://localhost:3001/api/login \
  -H "content-type: application/json" \
  -d '{"username":"alice","password":"Alice123!"}'
```

### Request ticket

```bash
curl -X POST http://localhost:3001/api/request-ticket \
  -H "content-type: application/json" \
  -d '{"tgt":"<TGT>","service":"resource-finance"}'
```

## Données seedées

- `admin / Admin123!`
- `alice / Alice123!`
- `bob / Bob123!!`
- `eve / Eve123!!`

## Principes de sécurité implémentés

- tickets `TGT` et `ST` chiffrés via `AES-256-GCM`
- authenticator signé via `HMAC-SHA256`
- `request_hash` pour lier le ticket à la requête
- anti-replay avec store mémoire ou Redis
- hiérarchie RBAC
- ABAC sur département, clearance, localisation et horaire
- PDP centralisé sur policies JSON
- audit structuré inter-services

## Différence secure vs vulnerable

Le profil `secure` active:

- expiration stricte
- vérification audience
- vérification `request_hash`
- anti-replay
- SoD
- ABAC complet

Le profil `vulnerable` relâche volontairement ces contrôles pour permettre les démonstrations d'attaque.

## Tests

Tests unitaires utiles:

```bash
npm test
```

Smoke tests une fois la stack locale lancee:

```bash
npm run test:smoke:secure
npm run test:smoke:vulnerable
```

Guides manuels:

- `docs/local-testing-guide.md`
- `docs/securecorp-manual-tests.http`