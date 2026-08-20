# Concentrate School Portal

See `PLANNING.md` for the team task split and `SPECS.md` for the original brief.

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run migrate --workspace=apps/api
npm run seed --workspace=apps/api
npm run dev
```

`npm run dev` runs both workspaces in parallel: the API on
`http://localhost:4000` (health check: `GET /health`) and the web app on
`http://localhost:3000`. Run `npm run dev --workspace=apps/api` or
`--workspace=apps/web` instead if you only need one of them.

Seeded accounts (password `password123` for all): `admin@example.com`,
`teacher@example.com`, `teacher2@example.com`, `student@example.com`,
`student2@example.com`, `student3@example.com`.

## Tests

```bash
npm run migrate --workspace=apps/api   # against a disposable/test DATABASE_URL
npm run seed --workspace=apps/api
npm run test        # both workspaces
npm run coverage     # both workspaces, fails below 100%
```

## End-to-end tests

```bash
docker compose up -d postgres redis
npx playwright install chromium   # first run only
npm run test:e2e
```

Playwright's `globalSetup` migrates + reseeds the database and boots both
dev servers automatically — no need to start them manually first.
