---
title: OAuth provider mode — overview
description: Expose an authn.sh environment as an OAuth 2.0 / OIDC identity provider — let third-party apps sign their users in with your product.
---

In v0.7, an authn.sh environment can act as an **OAuth 2.0 / OIDC identity provider**. Third-party apps redirect their users to your env, the user signs in (or is already signed in), grants consent, and the third-party app receives an authorization code it can exchange for tokens. Standard RFC 6749 §4.1 + OIDC §3.1.2.1 authorization-code grant with PKCE for public clients, plus the matching token / userinfo / introspection / discovery endpoints.

This unlocks two patterns:

- **Sign in with `<your product>`** — your customers' end-users carry their existing identity in your product into third-party tools they integrate with. Same flow as "Sign in with Google".
- **First-party integrations** — your own mobile / desktop / CLI apps treat your env as an IdP instead of bundling a publishable-key SDK. Lets you ship a unified consent surface for which scopes the app is allowed to read.

If you're wiring a third-party IdP **into** authn.sh (so end-users can sign in with Google / Microsoft / a custom OIDC IdP), that's the inverse direction — see [Social sign-in](/guides/social-sign-in/) or the [custom-OIDC walkthrough](/guides/custom-oidc/).

## The two new resources

OAuth provider mode adds two resources to the environment:

- **`OauthApplication`** (`oac_` prefix) — one row per registered third-party app. Carries `client_id`, write-only `client_secret`, `redirect_uris[]`, allowed `scopes[]`, an `is_public` flag for PKCE-only public clients (mobile / SPA), and a `consent_screen` config block.
- **`AuthorizationGrant`** (`authgrant_` prefix) — one row per `(user, oauth_application)` pair, tracking which scopes the user has consented to. Created or updated on every successful authorization. Carries `granted_scopes[]`, `granted_at`, `revoked_at`. Users can revoke grants from the **Authorized apps** panel in `<UserProfile />`.

The two resources fall out of the standard OAuth model: the application is the client registration; the grant is the per-user consent record that survives across sign-ins.

## The five new endpoints

All five live on the FAPI server, since they're browser-facing (or browser-initiated):

| Endpoint | Spec | Purpose |
| --- | --- | --- |
| `GET /oauth/authorize` | RFC 6749 §4.1 + OIDC §3.1.2.1 | Authorization-code grant. Renders the consent screen, then redirects to `redirect_uri` with `code` + `state`. |
| `POST /oauth/token` | RFC 6749 §4.1.3 + §6 | Exchanges `code` for `access_token` + `refresh_token` + `id_token`. Also services `refresh_token` grants. |
| `POST /oauth/token_info` | RFC 7662 | Token introspection. Returns `{ active, sub, scope, exp, client_id, ... }`. |
| `GET /oauth/userinfo` | OIDC §5.3 | Returns OIDC userinfo for the bearer token's user, scope-filtered. |
| `GET /.well-known/openid-configuration` | OIDC Discovery §4 | OIDC discovery document for the environment. Static per-env. |

The matching JWKS lives at the existing `/.well-known/jwks.json` — OAuth provider mode reuses the env's signing keys.

## Browser flow at a glance

```
Third-party app                authn.sh env                       End-user browser
      |                              |                                   |
      |--- redirect ?client_id=oac_… ...---------------------->          |
      |                              |  GET /oauth/authorize              |
      |                              |  -> sign in if needed              |
      |                              |  -> render consent screen          |
      |                              |  <-- POST consent                  |
      |                              |  -> generate authorization_code    |
      |                              |  -> redirect to redirect_uri       |
      |  <--- redirect ?code=… &state=… ---------------------- |          |
      |                              |                                   |
      |  POST /oauth/token (server-to-server)                             |
      |  -> receive access_token + id_token + refresh_token               |
```

The user-facing portion happens entirely in their browser, hosted on your env's FAPI domain. The third-party app never sees the user's password / TOTP / passkey assertion — only the resulting code and tokens.

## When to use it

OAuth provider mode is the right choice when:

- A third-party app wants to read user data on the user's behalf. Their access is bounded by the scopes the user consented to.
- You're shipping a mobile / desktop / CLI app and don't want to bundle the publishable-key SDK (e.g. you want PKCE rather than a long-lived `__authn_client` cookie).
- You're building a marketplace where third-party integrations need a "Sign in with your product" button.

It's the **wrong** choice when:

- You want a service-to-service integration with no user context. Use BAPI keys directly — they don't carry a user `sub`.
- You want to embed your sign-in UI inline in a third-party app. The bundled SDK does that already; reach for OAuth provider mode only when you specifically want the browser-redirect contract.

## What's not in v0.7

A few standard OAuth surfaces ship later:

- **Token revocation endpoint** (RFC 7009 `POST /oauth/revoke`) — not in v0.7. Revoke by deleting the `AuthorizationGrant` row.
- **Device authorization grant** (RFC 8628) — not in v0.7. The codespath is reserved for v0.8.
- **Client-credentials grant** — not in v0.7, and unlikely to ship — BAPI keys cover the equivalent surface without needing an OAuth round-trip.

For the conceptual model of the resources, read on. For step-by-step registration of a third-party app, see [Registering an OAuth application](/concepts/oauth-provider/registering-an-application/).
