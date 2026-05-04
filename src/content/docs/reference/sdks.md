---
title: SDKs
description: Official client and server SDKs for authn.sh.
---

## Browser

| Package | Description | Repo |
| ------- | ----------- | ---- |
| `@authn-sh/sdk-js` | Vanilla TS client + state machines for sign-in / sign-up / sessions. | [authn-sh/javascript](https://github.com/authn-sh/javascript/tree/main/packages/sdk-js) |
| `@authn-sh/sdk-react` | React provider + drop-in components (`<SignIn />`, `<UserButton />`, ...). | [authn-sh/javascript](https://github.com/authn-sh/javascript/tree/main/packages/sdk-react) |
| `@authn-sh/ui` | Design primitives (Button, Input, Avatar, ...) shared between SDK surfaces. | [authn-sh/javascript](https://github.com/authn-sh/javascript/tree/main/packages/ui) |

## Server

| Package | Description | Repo |
| ------- | ----------- | ---- |
| `authn-sh/sdk-php` | PHP backend SDK + Laravel package, BAPI client, JWT + webhook verifiers. | [authn-sh/sdk-php](https://github.com/authn-sh/sdk-php) |

Other languages (Go, Python, Ruby) are on the v0.4+ roadmap. v0.1 ships JS + PHP.

## Custom integrations

The two extension points that don't need an SDK:

- [Verify JWTs in a backend](/guides/verify-jwt/) — JWKS + RS256 with any standard library.
- [Verify webhook signatures](/guides/verify-webhooks/) — HMAC-SHA256 of `id.timestamp.body`.
