---
title: Social sign-in
description: Add Google, GitHub, Apple, or Microsoft sign-in to your app — and any custom OIDC / OAuth2 provider on top.
---

Social sign-in lets users authenticate with an external IdP (Google, GitHub, Apple, Microsoft, or any OIDC / OAuth 2.0 provider you wire up) instead of a password or magic link. authn.sh models each provider as an `OauthProvider` row on the environment; the SDK reads them at boot and renders a `<SocialButtons />` panel automatically.

This guide covers the four shipped presets, the toggles you'll set on each, the `attribute_mapping` trick for non-standard IdPs, and the canonical redirect-URI handoff. For provider kinds that need a wizard, see the [Custom OIDC walkthrough](/guides/custom-oidc/) and the [Custom OAuth2 walkthrough](/guides/custom-oauth2/).

## What an `OauthProvider` is

A row of per-environment social-IdP configuration. Three kinds share a single shape:

| `provider_kind` | When to pick it | What you supply |
| --------------- | --------------- | --------------- |
| `preset` | One of the four bundled IdPs (`google`, `github`, `apple`, `microsoft`). | `client_id`, `client_secret`, optional toggles. The platform fills in OIDC discovery, default scopes, and the standard `attribute_mapping`. |
| `custom_oidc` | Any standards-compliant OpenID Connect provider (Auth0, Okta, Keycloak, your own). | `provider_key` (a slug you choose), `client_id`, `client_secret`, and the `issuer` URL. The server fetches `<issuer>/.well-known/openid-configuration` and populates the endpoint fields. |
| `custom_oauth2` | A plain OAuth 2.0 provider with no OIDC discovery (legacy or quirky IdPs). | `provider_key`, `client_id`, `client_secret`, and the three endpoints (`authorization`, `token`, `userinfo`) plus `userinfo_method` / `userinfo_auth`. |

Once a row exists with `enabled: true` and `allow_sign_in: true`, the FAPI surfaces `oauth_<provider_key>` as a first-factor strategy on `SignIn.supported_strategies`, and the SDK renders the corresponding button.

## The shipped presets

Four IdPs ship with discovery, default scopes, and `attribute_mapping` already filled in — you only supply credentials.

| Preset `provider_key` | Default scopes | Notes |
| --------------------- | -------------- | ----- |
| `google` | `openid email profile` | Add `prompt=select_account` under `additional_authorization_params` if you don't want Google to silently re-use the last signed-in account. Google maps `picture` → `image_url` automatically. |
| `github` | `read:user user:email` | GitHub doesn't ship `email` in the public profile when the user marks it private — the resolver falls back to `GET /user/emails` to pull the verified primary. |
| `apple` | `name email` | Apple only returns `email` and `name` on the **first** consent — returning sign-ins ship a bare `sub` claim. The resolver caches the email on the `ExternalAccount` row so subsequent sign-ins still resolve to the same `User`. |
| `microsoft` | `openid email profile User.Read` | The default `attribute_mapping` works for both personal and work accounts. To restrict to a single tenant, set `additional_authorization_params: { "tenant": "common" }` or a tenant ID; the default `common` allows both. |

Add a preset via BAPI:

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "google",
  "name": "Google",
  "client_id": "123456789012-abc.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxx",
  "additional_authorization_params": { "prompt": "select_account" }
}
```

Or click through **Dashboard → Configure → Authentication → Social providers → Add provider → Google** and paste the credentials there.

## The redirect-URI handoff

`OauthProvider.redirect_uri` is server-computed and read-only. After you save the row, the response carries:

```json
{
  "provider_key": "google",
  "redirect_uri": "https://wise-otter-x4f.authn.sh/v1/oauth-callback/google"
}
```

Copy that exact value into the IdP's developer console under "Authorized redirect URIs" (Google), "Callback URL" (GitHub), "Return URL" (Apple), or "Redirect URIs" (Microsoft). The IdP rejects sign-in attempts whose `redirect_uri` query parameter doesn't match its registered list — this is the second most common configuration mistake (after pasting the wrong `client_secret`).

The Dashboard surfaces the URI on the provider's edit screen with a one-click copy button, so operators rarely need to read it from the API directly.

## Toggles you'll actually flip

| Field | When to flip it | Effect |
| ----- | --------------- | ------ |
| `enabled` | Pause a provider without losing existing user links. | Hidden from the SDK; `oauth_<provider_key>` rejected by the FAPI. Existing `ExternalAccount` rows remain valid. |
| `allow_sign_in` | Sign-in-only or sign-up-only configurations. | When `false`, an existing user can't authenticate via this provider. Combine with `allow_sign_up: false` to keep the row but block all use. |
| `allow_sign_up` | Restrict sign-up to specific providers — e.g. enterprise SSO only. | When `false`, a first-time visitor is refused (Challenge lands `failed` with `oauth_account_does_not_exist`). Existing users still sign in. |
| `block_email_subaddresses` | Stop one inbox from creating many accounts. | When `true`, addresses with a `+tag` segment from the IdP are refused at sign-up. Mirrors the instance-level `restrictions.block_email_subaddresses` knob but per-provider. |
| `scopes` | The IdP exposes extra data your app needs. | Replaces the preset-default scope set. Operators can add provider-specific scopes (`groups` on Okta, `read:org` on GitHub) without spec changes. |
| `additional_authorization_params` | IdP-specific quirks. | Free-form `key=value` pairs merged into the `/authorize` query string after the standard params. Common values: Google `prompt=select_account`, Microsoft `tenant=<tenant_id>`. |

## `attribute_mapping` recipes

`attribute_mapping` maps authn.sh field names → IdP claim or userinfo paths. The presets ship sensible defaults; override per row when an IdP uses non-standard claim names or you want to pull data from a non-standard path.

### Google — pull profile picture

The default Google mapping already does this:

```json
{
  "email_address": "email",
  "first_name": "given_name",
  "last_name": "family_name",
  "profile_image_url": "picture",
  "provider_user_id": "sub"
}
```

`picture` is a Google-specific claim returning a CDN URL. The resolver copies it onto `User.image_url` on first sign-in; subsequent sign-ins refresh the URL.

### Apple — handle the missing-email case

Apple only ships `email` and `name` on the first consent — returning sign-ins carry only `sub`. The default mapping captures the email on the first sign-in:

```json
{
  "email_address": "email",
  "first_name": "name.firstName",
  "last_name": "name.lastName",
  "provider_user_id": "sub"
}
```

The resolver writes `email_address` onto the `ExternalAccount` row, so subsequent sign-ins still resolve to the same `User` even though Apple's userinfo claim is empty. You don't need to do anything special — just leave the mapping at its default and don't expect Apple's userinfo to populate `User.email_addresses[]` on every sign-in.

### Microsoft — surface tenant ID

Microsoft work accounts ship the tenant ID on the `tid` claim. Capture it as public metadata so your app can route by tenant:

```json
{
  "email_address": "email",
  "first_name": "given_name",
  "last_name": "family_name",
  "provider_user_id": "sub"
}
```

The resolver also drops every claim that **isn't** mapped onto `ExternalAccount.public_metadata`. So `tid` lands there automatically, with no extra mapping required:

```json
{
  "id": "ext_…",
  "provider_key": "microsoft",
  "public_metadata": {
    "tid": "72f988bf-86f1-41af-91ab-2d7cd011db47"
  }
}
```

Read it via `useExternalAccounts()` in React or `User->getExternalAccounts()` in PHP.

### Custom IdPs — workforce groups

If your custom OIDC IdP ships group membership on a `groups[]` claim and you want it on the `ExternalAccount` row but not on the `User`:

```json
{
  "email_address": "email",
  "first_name": "given_name",
  "last_name": "family_name",
  "provider_user_id": "sub"
}
```

Don't map `groups` explicitly — anything not in `attribute_mapping` lands on `public_metadata`, which is exactly what you want for "carry it but don't promote it to the canonical user shape."

## SDK rendering

The browser SDK reads the environment's enabled providers at boot and renders them as a `<SocialButtons />` panel inside `<SignIn />` and `<SignUp />`:

```tsx
import { AuthnProvider, SignIn } from '@authn-sh/sdk-react';

<AuthnProvider publishableKey={import.meta.env.VITE_AUTHN_PUBLISHABLE_KEY}>
    <SignIn routing="virtual" />
</AuthnProvider>
```

If you want to render the buttons standalone (e.g. above your custom email/password form), use `<SocialButtons />` directly:

```tsx
import { SocialButtons } from '@authn-sh/sdk-react';

<SocialButtons
    redirectUrl={`${window.location.origin}/sso-callback`}
    redirectUrlComplete="/dashboard"
/>
```

Mount `<AuthnRedirectCallback />` (or `Authn.handleRedirectCallback()` in vanilla JS) at the `redirectUrl` path so the SDK can finish the flow when the IdP bounces the user back. See the [Connected-accounts components reference](/reference/connected-accounts/) for full props.

## What happens on callback

1. User clicks a `<SocialButtons />` button. The SDK calls `POST /v1/client/sign-ins/{sid}/challenges { strategy: "oauth_<provider_key>", redirect_url, redirect_url_complete }`.
2. Server mints a Challenge and returns `external_verification_redirect_url` — the IdP's `/authorize` URL with a server-signed `state` (60s TTL) bound to this `Client` + `SignIn` + `Challenge`.
3. SDK performs a top-level browser navigation to that URL.
4. User authenticates at the IdP. IdP redirects to `https://<env_slug>.authn.sh/v1/oauth-callback/<provider_key>?code=…&state=…`.
5. authn.sh exchanges the `code` for tokens, fetches userinfo (or reads ID-token claims), and runs the find-or-create-by-`provider_user_id` resolver. On success the Challenge flips to `verified` and the parent SignIn advances to `complete` — see [SignIn schema](/reference/rest/) for the full state machine.
6. Server 302s the browser to `redirect_url_complete`. The SDK reads the parent SignIn from the URL and either completes or follows the cross-flow bounce on `transferable` (a sign-in for an unknown user is bounced to a `transfer: true` SignUp).

The `state` parameter is signed by the env's session key with a 60-second TTL and binds `client_id` + `sign_in_id` + `challenge_id`, so a leaked authorize URL cannot be replayed against a different flow.

## Adding a connection from `<UserProfile />`

Already-signed-in users add a connection by driving a `SignIn`-like flow with `transfer: true`. The pre-built `<ConnectedAccountsPanel />` (see the [reference](/reference/connected-accounts/)) ships a "Connect Google" button that handles the round-trip; under the hood it issues an `oauth_<provider_key>` Challenge against the user's session and lands a fresh `ExternalAccount` row.

## Removing a connection

`DELETE /v1/me/external-accounts/{id}` drops the local `ExternalAccount` row. The server makes a best-effort revocation against the IdP's `revocation_endpoint` (per OIDC discovery, when present); failure to revoke does not block deletion. Future sign-ins via the same provider create a fresh row from scratch — unlinking is safe.

The user must keep at least one identifier or another sign-in method; deleting the last way to sign in returns `422`.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/oauth-providers` | List every provider configured on the environment. |
| `POST` | `/v1/oauth-providers` | Create a `preset`, `custom_oidc`, or `custom_oauth2` row. |
| `GET` | `/v1/oauth-providers/{id}` | Fetch a single provider. `client_secret` is never included. |
| `PATCH` | `/v1/oauth-providers/{id}` | Update toggles, `client_secret`, scopes, or attribute mapping. `provider_kind` and `provider_key` are immutable. |
| `DELETE` | `/v1/oauth-providers/{id}` | Soft-delete. Refused while `ExternalAccount` rows still link to this provider. |
| `POST` | `/v1/oauth-providers/{id}/test` | Dry-run probe — surfaces broken endpoints up front. |
| `GET` | `/v1/me/external-accounts` | List the signed-in user's connected accounts. |
| `GET` | `/v1/me/external-accounts/{id}` | Fetch one connected account. |
| `DELETE` | `/v1/me/external-accounts/{id}` | Unlink a connected account. |
| `GET` | `/v1/oauth-callback/{provider_key}` | IdP redirect target — browsers only, never called by the SDK. |
