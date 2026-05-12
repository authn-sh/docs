---
title: Registering an OauthApplication
description: Wizard-driven registration for third-party OAuth clients — scopes, redirect URIs, public vs confidential clients, client-secret rotation.
---

Before a third-party app can call `/oauth/authorize`, an operator registers it as an `OauthApplication` row in the env's dashboard. This is a one-time setup per third-party client. Available from v0.7.

The wizard lives at **Authentication → OAuth applications → New application** in the operator dashboard. The corresponding BAPI is `POST /v1/oauth-applications`.

## Step 1 — Name and homepage

```
Name           Acme Pages
Homepage URL   https://acme.example
```

The **Name** is rendered on the consent screen — pick what end-users should see ("Acme Pages", not "Acme internal SSO bridge"). It's immutable on PATCH only in the sense that changing it shows different text on subsequent consent screens; existing `AuthorizationGrant` rows are unaffected.

The **Homepage URL** is the third-party app's marketing site — surfaced on the consent screen as a link the user can click before granting consent.

## Step 2 — Public or confidential client

```
is_public      [ ] Yes — public client (PKCE-only, no client_secret)
               [x] No  — confidential client (server-side, has a client_secret)
```

- **Confidential clients** (`is_public: false`) have a `client_secret` issued at create time. Used by server-side backends that can store the secret safely. The `POST /oauth/token` call must authenticate with the secret.
- **Public clients** (`is_public: true`) have no `client_secret`. PKCE is **mandatory** — the authorize call without `code_challenge` is rejected. Used by mobile apps, SPAs, and CLI tools where the secret can't be hidden.

The `is_public` field is **immutable** after create — flipping a public client to confidential (or vice versa) means deleting the row and re-registering with a fresh `client_id`, to force the third-party app to re-register on their end.

## Step 3 — Redirect URIs

```
Redirect URIs
  https://acme.example/oauth/callback
  http://localhost:8080/oauth/callback        ← dev-only, see notes
  acme-mobile://oauth/callback                ← mobile deep link
```

Multiple entries allowed. Each is matched **exactly** against the `redirect_uri` parameter on `/oauth/authorize` — no scheme / host / path wildcards, no query-string flexibility (we follow OAuth 2.1 BCP §1.4.2 strict matching).

Three valid scheme classes:

- `https://…` — the production path. Hosts on `localhost` are allowed without TLS (`http://localhost:8080/…`) as an explicit dev-mode escape hatch. Other plain-HTTP hosts are rejected (`422 redirect_uri_insecure`).
- `<custom>://…` — mobile deep links, e.g. `acme-mobile://`. The scheme must contain a hyphen or dot to disambiguate from `http`/`https`.
- The Native loopback pattern `http://127.0.0.1:0/…` is also accepted for CLI tools that open a local listener on an ephemeral port.

## Step 4 — Scopes

```
Scopes available to this app:
  [x] openid                  OIDC sign-in (required to issue an id_token)
  [x] profile                 name, profile_image_url, locale
  [x] email                   email_address, email_verified
  [ ] phone                   phone_number, phone_verified
  [ ] offline_access          issue refresh_token (long-lived sessions)
  [ ] organization:read       memberships + active org snapshot
  [ ] organization:write      modify memberships on behalf of the user
```

Standard OIDC scopes (`openid`, `profile`, `email`, `phone`) plus a few authn.sh-specific ones (`offline_access`, `organization:read`, `organization:write`). The full list is in the **scopes** registry — `GET /v1/oauth-scopes` on the BAPI returns it.

Each scope ticked here is **available** to request — the app can ask for any subset on a given authorization, but never more than what's been ticked. Users still choose to grant or deny on the consent screen.

Custom per-environment scopes (`acme:projects.read`) are configured separately under **Authentication → OAuth scopes** — they live in their own table and can be referenced by name.

## Step 5 — Consent screen config

```
Consent screen:
  Description:  Acme Pages is a static-site generator that publishes from your authn.sh-authenticated content.
  Logo URL:     https://acme.example/logo.png
  Privacy URL:  https://acme.example/privacy
  Terms URL:    https://acme.example/terms
```

All four fields are rendered on the consent screen. The **Description** lets the user understand what the app does without leaving the page; **Privacy** and **Terms** are required for any app that requests `email` or higher-privilege scopes.

## After create

The wizard returns the registration result:

```json
{
  "object": "oauth_application",
  "id": "oac_01J7Z…",
  "client_id": "oac_pub_AbC123_…",
  "client_secret": "oac_sec_xy7…",
  "is_public": false,
  "redirect_uris": ["https://acme.example/oauth/callback"],
  "scopes": ["openid", "profile", "email"],
  "...": "..."
}
```

The `client_secret` is **shown exactly once** on the create response. Subsequent GETs replace it with `null`. Lose it → call `POST /v1/oauth-applications/{id}/rotate-secret` to mint a fresh one (and update the third-party app to match).

The discovery URL the third-party app's developer plugs in is:

```
https://<env_slug>.authn.sh/.well-known/openid-configuration
```

That single URL gets them the issuer, authorize / token / userinfo / JWKS endpoints, the supported scopes / grant types / response types, and the PKCE methods. From there their OIDC library handles the rest.

## Client-secret rotation

```
POST /v1/oauth-applications/{id}/rotate-secret
→ 200 OK
{ "client_secret": "oac_sec_NEW…" }
```

Issues a fresh secret and **immediately** invalidates the old one — there's no overlap window. Plan accordingly: deploy the new secret to the third-party app's server *after* you have it, *before* the next sign-in attempt. For zero-downtime rotation, register a second `OauthApplication` row alongside the first, switch the app over, then delete the old row.

## Editing afterwards

`PATCH /v1/oauth-applications/{id}` accepts updates to `name`, `homepage_url`, `redirect_uris`, `scopes`, and the four consent-screen fields. `is_public` and `client_id` are immutable.

Deleting a row (`DELETE`) revokes every issued `AuthorizationGrant` and refuses subsequent `/oauth/authorize` calls with `401 invalid_client`. Grants are hard-deleted; the audit-trail of who-granted-what is preserved through webhook events (`oauthApplication.deleted`, `authorizationGrant.revoked`).
