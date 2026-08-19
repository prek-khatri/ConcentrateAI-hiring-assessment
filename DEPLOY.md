# Deploying the School Portal

Self-hosted deployment via Docker Compose on any cloud VM (DigitalOcean, EC2,
a Hetzner box — anything that can run Docker), fronted by Nginx and Certbot
for HTTPS.

## What's in the root `Dockerfile`

One multi-stage Dockerfile builds both services:

- `deps` / `build` — installs the monorepo once, compiles the API (`tsc`) and
  builds the web app (`next build`, standalone output).
- `api` target — a small Node image running the compiled Fastify server.
- `web` target — a small Node image running Next's standalone server.

`docker-compose.prod.yml` builds both targets and wires them up with
Postgres and Redis. Postgres/Redis aren't exposed to the host — only `api`
(4000) and `web` (3000) are.

## 1. Provision a VM and install Docker

Any Ubuntu-ish VM works. Install Docker + the Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## 2. Clone the repo and set secrets

```bash
git clone <your-repo-url> school-portal
cd school-portal
```

Create a `.env` next to `docker-compose.prod.yml` (this is read by Compose
for variable substitution, not committed):

```bash
JWT_SECRET=$(openssl rand -hex 32)
WEB_ORIGIN=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# optional — leave blank to skip
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.your-domain.com/auth/oauth/google/callback
GROQ_API_KEY=
```

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 4. Run migrations and seed the first admin

```bash
docker compose -f docker-compose.prod.yml exec api node apps/api/dist/db/migrate.js
docker compose -f docker-compose.prod.yml exec api node apps/api/dist/seed.js
```

`api` is on `:4000`, `web` is on `:3000`. Confirm both are up:

```bash
curl localhost:4000/health   # {"status":"ok"}
curl -I localhost:3000       # 200
```

## 5. Nginx reverse proxy

Point two server blocks at the containers — one for the app, one for the
API (matching `NEXT_PUBLIC_API_URL` above):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name api.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 6. HTTPS with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

Certbot rewrites both server blocks for HTTPS and sets up auto-renewal.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations don't run automatically on deploy — re-run the migrate command
from step 4 if a new one landed.

## Notes

- Named volume `pgdata` persists Postgres data across `up`/`down`. Use
  `down -v` only if you actually want to wipe it.
- `GOOGLE_CLIENT_ID`/`SECRET`/`CALLBACK_URL` and `GROQ_API_KEY` are optional
  — leaving them blank disables Google sign-in and the chatbot respectively,
  everything else works fine without them.
- This whole flow — build, migrate, seed, login, teacher API — was verified
  end-to-end against a fresh database before this file was written.
