---
title: JWT templates
description: Substitute a custom JWT shape for the default authn.sh session token — claims, lifetime, allowed clock skew, custom signing keys, Liquid placeholder reference.
---

A **`JwtTemplate`** lets an operator define a custom JWT shape that the SDK issues in place of the default session token. Custom claims, custom lifetime, custom signing key. Available from v0.7.

You reach for a template when an upstream service expects a specific token shape — a feature-flagging service wanting a `tier` claim, a billing service wanting `customer_id`, a legacy backend wanting its old `sub: <int>` schema rather than `user_…` ULIDs. Instead of rewriting that upstream service, you mint a JWT-template that produces a token it already knows how to verify.

For the default session-token claims (what you get without a template), see [JWT claims](/reference/jwt-claims/).

## The resource

```json
{
  "id": "jtmpl_01J8Z…",
  "object": "jwt_template",
  "name": "feature-flag",
  "claims": {
    "sub": "{{user.id}}",
    "email": "{{user.primary_email_address.email_address}}",
    "tier": "{{user.public_metadata.tier | default: 'free'}}",
    "org_id": "{{session.active_organization.id}}",
    "org_role": "{{session.active_organization_role.key}}"
  },
  "lifetime_seconds": 600,
  "allowed_clock_skew_seconds": 5,
  "signing_algorithm": "RS256",
  "custom_signing_key": null,
  "created_at": 1715140000000,
  "updated_at": 1715140000000
}
```

The fields:

- **`name`** — the identifier the SDK passes to `getToken({ template: 'feature-flag' })`. Unique per environment.
- **`claims`** — a JSON object of claim names mapped to **Liquid template** expressions. The server resolves the Liquid against the current snapshot of the User / Session / Organization on each `getToken` call.
- **`lifetime_seconds`** — how long the issued token is valid. Bounded by `60 <= n <= 86400` (1 minute to 1 day).
- **`allowed_clock_skew_seconds`** — how much skew the receiving service is expected to tolerate. Surfaced into the `nbf` claim (`iat - allowed_clock_skew_seconds`). Bounded by `0 <= n <= 60`.
- **`signing_algorithm`** — `RS256`, `ES256`, or `HS256`. `RS256` / `ES256` (asymmetric) use the env's JWKS unless `custom_signing_key` is set. `HS256` requires a `custom_signing_key`.
- **`custom_signing_key`** — write-only PEM string. Optional. When set, the template is signed with this key instead of the env's primary signing key. Useful for upstream services that want a shared secret rather than verifying against your JWKS.

## Liquid placeholder reference

Template claims are evaluated by a sandboxed Liquid engine — no I/O, no untrusted code execution, no eval. The objects you can reach from inside a `{{ … }}` expression:

### `user`

The signed-in user — same shape as the `User` REST resource.

| Path | Value |
| --- | --- |
| `user.id` | `user_01HKX9…` |
| `user.first_name` | string or empty |
| `user.last_name` | string or empty |
| `user.username` | string or empty (env config-dependent) |
| `user.profile_image_url` | string |
| `user.primary_email_address.email_address` | string — already-verified email if available |
| `user.primary_email_address.verified` | boolean |
| `user.primary_phone_number.phone_number` | E.164 |
| `user.public_metadata.<key>` | any JSON value the operator wrote |
| `user.unsafe_metadata.<key>` | any JSON value the user wrote (don't trust on the receiving side) |
| `user.external_accounts[]` | array — `provider`, `provider_key`, `provider_user_id`, `email_address` |
| `user.created_at` | ms-epoch |

`user.private_metadata` is **deliberately not exposed** — JWT templates run on the FAPI server, and `private_metadata` is BAPI-only by design.

### `session`

The current session.

| Path | Value |
| --- | --- |
| `session.id` | `sess_01HKX9…` |
| `session.created_at` | ms-epoch |
| `session.last_active_at` | ms-epoch |
| `session.expire_at` | ms-epoch — the absolute session expiry, not the token expiry |
| `session.active_organization.id` | `org_…` or empty |
| `session.active_organization.slug` | string |
| `session.active_organization.name` | string |
| `session.active_organization_role.key` | `org:admin`, `org:member`, … |
| `session.active_organization_role.permissions[]` | list of permission keys |

### `org_memberships`

When the env has Organizations enabled, the full membership list — useful when you want the receiving service to see every org the user is in, not just the active one.

```liquid
{
  "orgs": [
    {%- for m in org_memberships -%}
      { "id": "{{m.organization.id}}", "role": "{{m.role.key}}" }{% unless forloop.last %},{% endunless %}
    {%- endfor -%}
  ]
}
```

### Built-in filters

The standard Liquid filters apply: `default`, `downcase`, `upcase`, `replace`, `split`, `truncate`, `size`, `first`, `last`, `json`, plus the OAuth-spec-shaped helpers `date_unix` (for ms-epoch → seconds conversion) and `urlencode`.

A worked example:

```liquid
{
  "sub":           "{{user.id}}",
  "iss":           "https://example.authn.sh",
  "iat":           "{{session.last_active_at | date_unix}}",
  "email":         "{{user.primary_email_address.email_address | downcase}}",
  "tier":          "{{user.public_metadata.tier | default: 'free'}}",
  "is_admin":      "{{session.active_organization_role.key == 'org:admin'}}",
  "feature_flags": "{{user.public_metadata.flags | default: '[]' | json}}"
}
```

## Standard claims authn.sh always sets

Whatever you write in `claims`, the server stamps these on top:

- `iss` — the env's issuer URL (`https://<env_slug>.authn.sh`). If you set `iss` in `claims`, your value wins.
- `iat` — issued-at (token mint time, not session activity time). Always set by the server. Setting it in `claims` is a no-op.
- `exp` — `iat + lifetime_seconds`. Always set.
- `nbf` — `iat - allowed_clock_skew_seconds`. Always set.
- `aud` — defaults to the env's issuer URL. Override by setting `aud` in `claims`.
- `jti` — random ULID, always set, prevents replay.

## Using a template from the SDK

```typescript
import { useAuth } from '@authn-sh/sdk-react';

function Component() {
  const { getToken } = useAuth();

  const callBilling = async () => {
    const token = await getToken({ template: 'billing-service' });
    await fetch('https://billing.acme.example/charge', {
      headers: { Authorization: `Bearer ${token}` },
    });
  };
  // ...
}
```

The SDK caches the issued token for the template's `lifetime_seconds` minus a 10% safety margin, then re-mints on demand. Multiple calls in quick succession get the same cached token; calls after expiry mint fresh.

For backend issuance (no browser session — server-to-server, you have a `user_id` but no session ticket), use the BAPI `POST /v1/users/{user_id}/jwt-templates/{name}/tokens` endpoint. Same template, no session-scoped claims (`session.*` resolve to null).

## Lifetime + clock-skew considerations

Three knobs worth thinking about together:

- **`lifetime_seconds`** — shorter tokens are safer if they leak, but they require more `getToken` round-trips. The SDK absorbs that for in-browser code; backends should cache.
- **`allowed_clock_skew_seconds`** — receivers usually tolerate 30-60s of clock drift. Setting `nbf` slightly in the past avoids "token not yet valid" errors when the issuing FAPI server and the receiving service disagree on the current second.
- **The combination** — for a service that's strict about `nbf`, set `allowed_clock_skew_seconds: 30`; for a service that strictly enforces `exp` with no leeway, give yourself extra `lifetime_seconds` so the SDK has time to re-mint.

## Custom signing keys

By default, the template uses the env's primary signing key — the same one verifying the env's session tokens. Receiving services verify against `https://<env_slug>.authn.sh/.well-known/jwks.json`.

For an upstream service that wants a **shared secret** (HS256) rather than dealing with JWKS rotation, set `custom_signing_key` to the secret string. The template is then signed with that key, and the upstream service verifies with the same key it has locally. This is useful for legacy backends but counts against rotation hygiene — rotating the shared secret means coordinating with every receiver. Prefer RS256 + JWKS when you can.

For an asymmetric custom signing key (you want this template to sign with a key separate from the env's main JWKS), set `custom_signing_key` to a PEM-encoded private key. The matching public-key JWKS for the template is surfaced at `GET /.well-known/jwt-template-jwks/<template-name>.json` so receivers can fetch and cache it independently.

## Webhook events

JWT-template lifecycle fires the standard webhook trio: `jwtTemplate.created`, `jwtTemplate.updated`, `jwtTemplate.deleted`. The `custom_signing_key` is **stripped** from all three event payloads — the same write-only contract that applies to GETs.

## Reference

REST CRUD lives at `BAPI /v1/jwt-templates`. See the [REST API reference](/reference/rest/#jwt-templates-bapi) for the full endpoint table.
