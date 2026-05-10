---
title: JWT claims
description: Every claim the session JWT carries — standard, organization, MFA, phone-MFA.
---

The `__session` JWT minted by `POST /v1/client/sessions/{sid}/tokens` is short-lived (default 60s) and carries the active user / session / org / MFA state for tenant backends to consume. This page is the canonical reference for every claim. For how the JWT is fetched and rotated, see [Sessions and tokens](/concepts/sessions-and-tokens/).

## Standard claims

| Claim | Type | Meaning |
| ----- | ---- | ------- |
| `iss` | string | The FAPI URL (e.g. `https://wise-otter-x4f.authn.sh`). |
| `sub` | string | The user ID (`user_…`). |
| `sid` | string | The session ID (`sess_…`). |
| `azp` | string | The Origin that minted the token, when the request had one. |
| `iat` / `nbf` / `exp` | number | Standard JWT timestamps. Default lifetime: 60s. |
| `v` | number | Token format version. Currently `2`. |

## Session-state claims

| Claim | Type | Meaning |
| ----- | ---- | ------- |
| `sts` | string | `active` or `pending`. `pending` while a step-up flow (device trust, fresh-MFA) is still in progress. |
| `fva` | `[number, number]` | `[seconds_since_first_factor, seconds_since_second_factor]`. The second factor is `-1` when the user has no MFA enrolled. |

`fva` lets backends gate sensitive endpoints on a fresh second-factor proof — e.g. require `fva[1] >= 0 && fva[1] < 300` to demand the user re-MFA'd in the last 5 minutes.

## Organization claim (v0.2)

When the session has an active organization set, the JWT gains an `org` claim:

```json
{
  "org": {
    "id": "org_01K…",
    "slug": "acme",
    "role": "org:admin",
    "permissions": [
      "org:sys_domains:manage",
      "org:sys_memberships:manage"
    ]
  }
}
```

`org` is absent when no organization is active. Backends must treat its absence as "no org context" — never assume a default. See [Organizations](/guides/organizations/) for how the active-org pivot works.

## MFA claims (v0.3)

When the user has at least one second factor enrolled and the session was minted after a successful second-factor proof:

| Claim | Type | Meaning |
| ----- | ---- | ------- |
| `tfe` | boolean | `true` when `User.two_factor_enabled` was `true` at session-creation time. |
| `mfa` | string[] | The second-factor strategies the user has enrolled at session-creation time. v0.3 surface: `["totp"]`, `["backup_code"]`, `["totp", "backup_code"]`. v0.4 adds `"phone_code"`. |

`tfe` is the cheapest gate — backends needing "this user has MFA on" for compliance can read it directly without re-fetching the user.

## Phone-MFA claims (v0.4)

When the user has at least one verified phone and / or has reserved a phone for SMS MFA:

| Claim | Type | Meaning |
| ----- | ---- | ------- |
| `pnv` | boolean | **P**hone-**n**umber-**v**erified. `true` when the user has at least one `PhoneNumber` row with `verified: true`. |
| `dsf` | string \| null | **D**efault **s**econd **f**actor. The strategy the SDK preselects on `needs_second_factor`: one of `"phone_code"`, `"totp"`, or `null` (the user has no preference set or no second factor enrolled). Driven by `PhoneNumber.default_second_factor`. |

The `mfa` claim grows to include `"phone_code"` when the user has any phone with `reserved_for_second_factor: true`:

```json
{
  "tfe": true,
  "mfa": ["totp", "phone_code"],
  "pnv": true,
  "dsf": "phone_code"
}
```

## Consumer-side helpers

### PHP (`authn-sh/sdk-php`)

`VerifiedClaims` exposes typed accessors for every claim:

```php
use AuthnSh\SdkPhp\VerifiedClaims;

$claims = $authn->jwt()->verify($token);

if ($claims->hasVerifiedPhoneNumber()) {
    // pnv: true
}

if ($claims->getDefaultSecondFactor() === 'phone_code') {
    // dsf: "phone_code"
}

if ($claims->hasMfa('phone_code')) {
    // mfa array contains "phone_code"
}
```

Full `VerifiedClaims` accessor list:

| Method | Reads claim |
| ------ | ----------- |
| `getUserId()` | `sub` |
| `getSessionId()` | `sid` |
| `getOrganizationId()` | `org.id` |
| `hasPermission(string)` | `org.permissions[]` |
| `hasMfa(string)` | `mfa[]` |
| `hasVerifiedPhoneNumber()` | `pnv` |
| `getDefaultSecondFactor()` | `dsf` |
| `getFirstFactorAge()` | `fva[0]` |
| `getSecondFactorAge()` | `fva[1]` |

### Laravel (`authn-sh/sdk-php-laravel`)

The Blade directive surfaces the same checks:

```blade
@authnHasVerifiedPhoneNumber
    <p>Your phone is verified.</p>
@endauthnHasVerifiedPhoneNumber

@authnHasConnectedAccount('google')
    <p>You're signed in with Google.</p>
@endauthnHasConnectedAccount
```

`@authnHasConnectedAccount` reads the `User.external_accounts[]` snapshot the SDK caches on session creation; pass the `OauthProvider.provider_key` you want to test for.

The middleware:

```php
Route::get('/dashboard', fn () => view('dashboard'))
    ->middleware('requires.connected_account:google');
```

`RequiresConnectedAccount` rejects with `403` when the user has no matching `ExternalAccount`. Useful for views that depend on a particular provider's data being available (e.g. a "Sync from GitHub" page).

### JS (`@authn-sh/sdk-js`)

`Authn.session.lastActiveToken` carries the decoded claims; the typed shape mirrors the table above:

```ts
import { Authn } from '@authn-sh/sdk-js';

const claims = Authn.session?.lastActiveToken?.claims;

if (claims?.pnv) {
    // phone verified
}

if (claims?.dsf === 'phone_code') {
    // user prefers SMS MFA
}
```

For backend verification (Express, FastAPI, Go, …), use a standards-compliant JWT library against the env's JWKS — see [Verify JWTs in a backend](/guides/verify-jwt/). The claim names above are the contract; nothing magical.

## What's not in the JWT

A few things the SDK reads off `User` directly rather than from the JWT:

- `User.external_accounts[]` — the full `ExternalAccount` list. Available via `useUser().user.externalAccounts` or `GET /v1/me/external-accounts`.
- `User.phone_numbers[]` — full list. Available via `usePhoneNumbers()` or `GET /v1/me/phone-numbers`.
- `User.email_addresses[]` — full list (v0.2).

These would bloat the JWT past comfortable size for long-lived sessions with many connections; the SDK fetches them on demand and caches them on the client snapshot.

## Versioning

The JWT format version is on the `v` claim. v0.1 / v0.2 ship `v: 1`; v0.3 introduced MFA claims and bumped to `v: 2`. v0.4 adds `pnv` / `dsf` without a version bump — adding optional claims is backwards-compatible for backends that ignore unknown keys (the standard JWT-handling library posture).

If a backend rejects unknown claims, pin to `v: 2` consumers; most don't.
