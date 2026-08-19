# Concentrate School Portal

See `PLANNING.md` for the team task split and `SPECS.md` for the original brief.

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run migrate --workspace=apps/api
npm run seed --workspace=apps/api
npm run dev --workspace=apps/api
```

API listens on `http://localhost:4000`. Health check: `GET /health`.

Seeded accounts (password `password123` for all): `admin@example.com`,
`teacher@example.com`, `teacher2@example.com`, `student@example.com`,
`student2@example.com`, `student3@example.com`.

## Tests

```bash
npm run migrate --workspace=apps/api   # against a disposable/test DATABASE_URL
npm run seed --workspace=apps/api
npm run test --workspace=apps/api
npm run coverage --workspace=apps/api
```
