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

## v0.4 additions

`@authn-sh/sdk-react` gains:

- `<SocialButtons />`, `<PhoneNumberField />`, `<ConnectedAccountsPanel />` — see [Connected-accounts components](/reference/connected-accounts/).
- `useExternalAccounts()`, `usePhoneNumbers()` hooks.
- `User.createPhoneNumber()`, `User.getExternalAccounts()` helpers.

`@authn-sh/sdk-js` gains:

- `SignIn.authenticateWithRedirect({ strategy, redirectUrl, redirectUrlComplete })` — drives the OAuth first-factor flow.
- `Authn.handleRedirectCallback()` — completes the round-trip after the IdP bounces the browser back.
- `PhoneNumber` and `ExternalAccount` resource classes with the toggle / verify / unlink helpers.

`authn-sh/sdk-php` gains:

- `OauthProvidersManager`, `PhoneNumbersManager`, `ExternalAccountsManager`, `SmsTemplatesManager` BAPI clients.
- `VerifiedClaims->hasVerifiedPhoneNumber()`, `getDefaultSecondFactor()`, `hasMfa()` — see [JWT claims](/reference/jwt-claims/).

`authn-sh/sdk-php-laravel` gains:

- `@authnHasConnectedAccount('google')` Blade directive.
- `RequiresConnectedAccount` middleware.

## Custom integrations

The two extension points that don't need an SDK:

- [Verify JWTs in a backend](/guides/verify-jwt/) — JWKS + RS256 with any standard library.
- [Verify webhook signatures](/guides/verify-webhooks/) — HMAC-SHA256 of `id.timestamp.body`.
