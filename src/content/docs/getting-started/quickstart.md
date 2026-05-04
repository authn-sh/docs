---
title: Self-host quickstart
description: Clone the repo, boot the stack, sign in as the first operator.
---

You'll have a working authn.sh instance on your laptop in under five minutes.

## Prerequisites

- Docker 25+ with Compose v2.
- A free port `8080` (the bundled stack publishes the app there) and `8025` for the Mailpit UI.

## 1. Clone and configure

```bash
git clone https://github.com/authn-sh/authn.git
cd authn
cp .env.example .env
```

The defaults in `.env.example` are sized for a local install: path-mode routing on `http://localhost:8080`, Postgres + Redis from the bundled images, and SMTP pointing at the dev Mailpit.

## 2. Boot the dev stack

```bash
make dev
```

That starts the app (nginx + php-fpm), a worker, the scheduler, Vite for HMR, Mailpit, Postgres, and Redis. The first run pulls images and builds the `dev` Dockerfile target — give it a couple of minutes.

## 3. Bootstrap the first operator

Set the credentials in your shell, then run the bootstrap inside the app container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec \
  -e AUTHN_BOOTSTRAP_ADMIN_EMAIL=you@example.com \
  -e AUTHN_BOOTSTRAP_ADMIN_PASSWORD='change-me-please' \
  app php artisan authn:bootstrap
```

The command is idempotent — re-running it on an already-bootstrapped instance is a no-op. The output prints your `pk_live_…` and `sk_live_…` keys; copy them out, they're shown once.

## 4. Sign in

Open <http://localhost:8080/sign-in> in a browser, type the credentials you just set, and you'll land on `/dashboard/create-project` — your operator account has no projects yet.

That's it. From here you can:

- [Walk through your first sign-in flow](/getting-started/first-sign-in/) using the SDK.
- [Read about projects + environments](/concepts/tenancy/) to plan how you'll organize your tenants.
- [Configure email delivery](/concepts/webhooks/) (production runs against Resend / SES / SMTP, not Mailpit).

## What's running

| Service | URL | Notes |
| ------- | --- | ----- |
| App | http://localhost:8080 | Account Portal + FAPI + Dashboard |
| Mailpit UI | http://localhost:8025 | Inspects every outgoing email in dev |
| Vite | http://localhost:5173 | HMR for the React surfaces |

Stop everything with `make down`. Drop volumes too with `make down V=1`.
