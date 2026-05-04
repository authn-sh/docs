---
title: Sessions and tokens
description: How session JWTs are minted, refreshed, and verified.
---

## Sessions

A **Session** is a server-side row created when a user finishes sign-in. It carries:

- `user_id` — who's signed in.
- `client_id` — the browser/device row, identified by the `__client` cookie.
- `status` — `active`, `pending`, `ended`, `removed`.
- `last_active_at`, `expire_at`, `abandon_at`.

Sign-out (or session-end) flips `status` and revokes the cookie. The lifetime is configurable per environment; the default is 7 days inactive / 30 days absolute.

## Session tokens (`__session` JWT)

The SDK and the operator Dashboard authenticate via a short-lived JWT minted from the active Session. The JWT carries:

| Claim | Meaning |
| ----- | ------- |
| `iss` | The FAPI URL (e.g. `https://wise-otter-x4f.authn.sh`). |
| `sub` | The user ID. |
| `sid` | The session ID. |
| `iat` / `nbf` / `exp` | Standard JWT timestamps. Default lifetime: 60s. |
| `azp` | The Origin that minted the token (when the request had one). |
| `v`   | Token format version (currently `2`). |
| `fva` | `[seconds_since_first_factor, seconds_since_second_factor]`. v0.1 always has `-1` for the second factor. |
| `sts` | `active` or `pending`. |

The default lifetime is intentionally short — the SDK auto-refreshes via `POST /v1/client/sessions/{sid}/tokens` before each request that needs auth.

## Where the JWT lives

Two places, depending on the surface:

1. **`Authorization: Bearer <jwt>`** — used by the BAPI gate (`/v1/me`, etc.) and tenant backends. The SDK injects this header on FAPI calls that need it.
2. **`__session` cookie** — set HttpOnly + SameSite=Lax on sign-in / sign-up completion. The operator Dashboard reads this on top-level navigations. Lifetime: 24h (longer than the access JWT, since the browser doesn't see refreshes for full-page nav).

## JWKS

Each environment publishes its public key at:

```
GET <FAPI_URL>/.well-known/jwks.json
GET <FAPI_URL>/.well-known/openid-configuration
```

Backends should cache JWKS with the response's `Cache-Control` header (default 5 minutes) and re-fetch on `kid` mismatch. See [verify JWTs in a backend](/guides/verify-jwt/) for a reference implementation.

## Rotation

Signing keys rotate via the `RotateSigningKey` background job (default: every 90 days). Rotation creates a new active key, leaves the previous key in `retiring` status for a grace window so already-issued tokens stay verifiable, then drops it. JWKS lists both keys during rotation; clients pick the right one by `kid`.
