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
| `org` | Active-organization claim — present only when the session has an active org set (v0.2+). See below. |
| `tfe` | `true` when the user has at least one second factor enrolled (v0.3+). |
| `mfa` | Array of enrolled second-factor strategies — `["totp"]`, `["backup_code"]`, `["phone_code"]`, or any combination (v0.3+; `phone_code` lands in v0.4). |
| `pnv` | `true` when the user has at least one verified phone number (v0.4+). |
| `dsf` | The user's preferred second-factor strategy: `"phone_code"`, `"totp"`, or `null` (v0.4+). |

The default lifetime is intentionally short — the SDK auto-refreshes via `POST /v1/client/sessions/{sid}/tokens` before each request that needs auth.

## Active-organization claim (`org`)

When a member sets an active organization, the session JWT gains an `org` claim:

```json
{
  "sub": "user_01K…",
  "org": {
    "id": "org_01K…",
    "slug": "acme",
    "role": "org:admin",
    "permissions": [
      "org:sys_domains:manage",
      "org:sys_domains:read",
      "org:sys_memberships:manage",
      "org:sys_memberships:read",
      "org:sys_profile:delete",
      "org:sys_profile:manage"
    ]
  }
}
```

`org` is absent when no organization is active. Backends must treat its absence as "no org context" — never assume a default. See [Organizations](/guides/organizations/) for how to set the active org, and [Roles & Permissions](/reference/roles-and-permissions/) for the permission catalog.

For the full claim catalogue including `pnv`, `dsf`, and the consumer-side helpers (`VerifiedClaims->hasVerifiedPhoneNumber()`, `getDefaultSecondFactor()`, etc.), see [JWT claims](/reference/jwt-claims/).

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
