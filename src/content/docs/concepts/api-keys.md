---
title: API keys
description: When to use publishable keys vs secret keys, and how rotation works.
---

Each environment has two kinds of API key. They look different on purpose: one is safe to ship in a browser bundle, the other is not.

## Publishable keys (`pk_…`)

```
pk_live_YXV0aG4uc2hAZXhhbXBsZTo4MDgwJA==
pk_test_…
```

The body is a base64-encoded `<fapi_host>$` (or `<host>/<routing_label>$` in path mode). The SDK decodes it client-side to discover where to call the Frontend API — no separate config round-trip on boot.

**Use it for:**

- The browser SDKs (`@authn-sh/sdk-js`, `@authn-sh/sdk-react`).
- The Account Portal `<AuthnProvider publishableKey="pk_live_…">`.
- Anything that ships in client-side JavaScript.

Publishable keys are not credentials in the traditional sense. They identify which environment a Client is talking to. The actual auth happens over the FAPI's per-Client cookie + `__session` JWT.

## Secret keys (`sk_…`)

```
sk_live_8jh3v8…
sk_test_…
```

Random 32-character secret. Used as a Bearer token against the BAPI:

```
Authorization: Bearer sk_live_8jh3v8…
```

**Use it for:**

- Server-to-server BAPI calls (`@authn-sh/sdk-php`, custom Go / Node clients).
- Webhook signature verification when you want to also call back into BAPI.
- Any backend integration. **Never** ship this to a browser.

The plaintext is shown exactly once — on creation in the Dashboard, or on `authn:bootstrap` output. The server stores only the SHA-256 hash.

## `_test_` vs `_live_`

The middle segment matches the environment kind:

- `pk_live_` / `sk_live_` → production env.
- `pk_test_` / `sk_test_` → development / staging.

Test-mode keys against a production env are rejected at request time. The split is enforced by the BAPI's auth middleware so a leaked test key can't accidentally hit live data.

## Rotation

From **API keys** in the Dashboard, hit **Rotate**. The server mints a fresh secret, replaces the row's hash, and shows the new plaintext once. The previous key stops working immediately. If you need a no-downtime rotation, create a second key first, deploy the new one, then revoke the old one.

A v0.2 milestone item is rotation with a grace window (both keys valid for N minutes); for v0.1 it's a hard cutover.
