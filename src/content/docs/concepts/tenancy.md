---
title: Workspaces, projects, environments
description: How authn.sh organizes operators, customers, and runtime data.
---

Three layers, top to bottom:

```
Workspace (Organization)
└─ Project
   └─ Environment   (production / staging / development)
```

## Workspace

A **workspace** is the operator's billing + admin scope. It owns one or more projects. The first operator who runs `authn:bootstrap` gets a workspace owner role automatically. Future operators are invited via `/dashboard/workspace-settings`.

In the database this is just an `Organization` row with `environment_id = <_admin env>` and a membership for the operator. v0.1 supports a single workspace per install; multi-workspace ships in v0.2.

## Project

A **project** is a customer-facing tenant — typically one per app / brand / team you're authenticating users for. Each project has:

- A slug you pick (`acme`, `internal-tools`) — unique within the workspace, shown in Dashboard URLs.
- One or more environments.
- API keys + signing keys per environment.

## Environment

An **environment** is the actual runtime where users sign in. It has its own:

- Users, sessions, sign-in / sign-up attempts.
- Allowed origins for the FAPI CORS check.
- Email templates.
- Webhook endpoints.
- A signing key pair (RS256) used for JWT issuance + JWKS publication.
- A `routing_label` — opaque slug like `wise-otter-x4f` used as the FAPI subdomain (subdomain mode) or path prefix (path mode). This is **not** the same as the operator-facing `slug` ("production" / "staging") shown in Dashboard URLs.

The split between `slug` and `routing_label` lets each project have its own `production` env without subdomain collisions, and stops customers from squatting on short readable names.

## The reserved `_admin` env

There's one special environment baked in: `_admin`, owned by the system project. It powers the operator Dashboard and the Account Portal you log into. It's mounted at the bare app host in both routing modes (so `<APP_URL>/sign-in` always works) and never resolves as a tenant slug.

## URLs

In **path mode** (the recommended self-host default):

```
<APP_URL>/sign-in              ← admin sign-in
<APP_URL>/dashboard/...        ← operator Dashboard
<APP_URL>/api/v1/...           ← BAPI
<APP_URL>/<routing_label>/v1/  ← tenant FAPI
<APP_URL>/<routing_label>/sign-in  ← tenant Account Portal
```

In **subdomain mode**:

```
<APP_HOST>                          ← admin Account Portal
dashboard.<APP_HOST>                ← operator Dashboard
api.<APP_HOST>                      ← BAPI
<routing_label>.<APP_HOST>          ← tenant FAPI + Account Portal
```

Switch modes via `AUTHN_ROUTING_MODE=subdomain|path` in `.env`. Subdomain mode requires wildcard DNS + wildcard TLS.
