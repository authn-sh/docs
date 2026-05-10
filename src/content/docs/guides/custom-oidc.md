---
title: Custom OIDC walkthrough
description: Wire a workspace OpenID Connect provider into authn.sh — issuer URL, discovery, test, deploy.
---

The `custom_oidc` provider kind is for any standards-compliant OpenID Connect IdP that publishes a `.well-known/openid-configuration` discovery document. Auth0, Okta, Keycloak, Ping, ForgeRock, your in-house Hydra deployment — all of these go through this path.

You'll spend most of the time bouncing between the IdP's developer console and the authn.sh Dashboard, copying values back and forth. The Dashboard wizard handles the discovery fetch, populates the endpoint fields, and surfaces the redirect URI you need to register on the IdP side.

## Before you start

You need:

- **An IdP-side OAuth application** — most IdPs call this an "Application", "Client", or "Connection". Create one. The redirect URI you'll register is `https://<env_slug>.authn.sh/v1/oauth-callback/<your_provider_key>` — you'll see the exact value in step 4 below.
- **The IdP's issuer URL** — e.g. `https://acme.us.auth0.com`, `https://login.microsoftonline.com/<tenant_id>/v2.0`, `https://accounts.your-internal-idp.example`. Paste this into a browser and append `/.well-known/openid-configuration`; if you see a JSON document with an `authorization_endpoint`, you're good.
- **A `client_id` and `client_secret`** from the IdP application.

## Step 1 — Choose a `provider_key`

Open **Dashboard → Configure → Authentication → Social providers → Add provider → Custom OIDC**. The wizard asks for a slug — this becomes:

- The strategy name (`oauth_<provider_key>`).
- The path component on the redirect URI.
- The label inside `ExternalAccount.provider_key`, frozen on each row at link time.

Pick something stable. `acme_corp_sso` is good; `prod_v2` is bad (you'll be stuck with it). The slug must match `^[a-z][a-z0-9_]*$` and is unique per environment.

## Step 2 — Enter the issuer URL

The wizard asks for the issuer:

```
https://acme.us.auth0.com
```

Click **Discover endpoints**. The server fetches `<issuer>/.well-known/openid-configuration` server-side, parses the document, and previews the resolved endpoints back to you:

```
authorization_endpoint   https://acme.us.auth0.com/authorize
token_endpoint           https://acme.us.auth0.com/oauth/token
userinfo_endpoint        https://acme.us.auth0.com/userinfo
jwks_uri                 https://acme.us.auth0.com/.well-known/jwks.json
id_token_signing_algs    [RS256]
```

If discovery fails — bad issuer URL, IdP not reachable, weird `Content-Type` on the response — the wizard surfaces the error and lets you fall back to manual endpoint entry. (Self-host edge cases sometimes need this.)

You can also do this via BAPI directly — the server runs discovery on `POST /v1/oauth-providers` whenever `provider_kind: custom_oidc` and an `issuer` is supplied, then returns the resolved endpoints in the response body.

## Step 3 — Fill `client_id` and `client_secret`

Paste the values from your IdP application. `client_secret` is encrypted at rest and never returned by any GET — the Dashboard shows a masked input on subsequent edits. Patching with an empty body or omitting `client_secret` on `PATCH` leaves the stored value alone; sending `null` clears it (rare; PKCE-only flows).

## Step 4 — Save and copy the redirect URI

Click **Save**. The provider row is created and the response carries the server-computed `redirect_uri`:

```
https://wise-otter-x4f.authn.sh/v1/oauth-callback/acme_corp_sso
```

The Dashboard surfaces this with a one-click copy button. Switch back to the IdP's developer console and paste it into the application's "Allowed Callback URLs" / "Authorized redirect URIs" / "Sign-in redirect URIs" list. Save the IdP-side change.

If you skip this step, every sign-in attempt fails with the IdP's "redirect_uri_mismatch" error before it ever hits authn.sh.

## Step 5 — Hit the test button

Back on the provider's edit screen, click **Test connection**. This calls `POST /v1/oauth-providers/{id}/test`, which:

1. Builds the `/authorize` URL the SDK would redirect to (using a synthetic `state` and the computed `redirect_uri`) and returns it on `authorize_url`. Useful for visually confirming the URL looks right.
2. Refreshes the OIDC discovery document and reports any failures (timeouts, bad TLS, parsing errors).
3. HEAD-probes `userinfo_endpoint` (without an access token, expecting `401` / `403` — that's a healthy response). The HTTP status is returned on `userinfo_status`.

A healthy result looks like:

```json
{
  "authorize_url": "https://acme.us.auth0.com/authorize?response_type=code&client_id=acme-authn-prod&redirect_uri=https%3A%2F%2Fwise-otter-x4f.authn.sh%2Fv1%2Foauth-callback%2Facme_corp_sso&scope=openid+email+profile&state=test_01HKX9SY9V7H7TF8C8K7J9X4ZA",
  "userinfo_status": 401,
  "errors": []
}
```

A `userinfo_status` of `5xx` or a non-empty `errors` array surfaces a red dot on the provider in the Dashboard. Fix it before deploying — it's the difference between catching a misconfiguration here vs. at sign-in time.

## Step 6 — Tighten policy, then enable

Before flipping `enabled: true`, decide:

- Do you want sign-up via this provider, or sign-in only? Set `allow_sign_up: false` for enterprise SSO scenarios where every user is provisioned out-of-band.
- Do you need extra scopes? The default OIDC scope set is `openid email profile`. Add `groups` (or whatever your IdP calls it) if your app reads group membership off `ExternalAccount.public_metadata`.
- Do you want to refuse `+tag` email subaddresses? Flip `block_email_subaddresses: true` per-provider for IdPs serving consumer email domains.

Now flip `enabled: true` and save. The SDK will pick up the new provider on the next environment bootstrap (within the bootstrap cache TTL — typically a few seconds).

## Custom `attribute_mapping`

Most OIDC IdPs match the default mapping out of the box. Override per row when:

- The IdP uses a non-standard claim name (e.g. `preferred_username` instead of `email`).
- You want to pull a custom field — e.g. `groups` mapped to `User.public_metadata` (no — `attribute_mapping` only writes to canonical fields; unmapped claims auto-land on `ExternalAccount.public_metadata`).

Example: an IdP that ships only `email` and `name`, no separate first/last:

```json
{
  "attribute_mapping": {
    "email_address": "email",
    "first_name": "name",
    "provider_user_id": "sub"
  }
}
```

The resolver fetches userinfo (or reads ID-token claims), looks up each mapped key, and writes onto the `User` / `ExternalAccount` row. Unknown keys map to the empty string.

## Patching after deploy

Common edits:

```http
PATCH /v1/oauth-providers/{id}
Content-Type: application/json

{ "client_secret": "GOCSPX-yyyyyyyyyyyyyyyyyyyyyyyyy" }
```

Rotate the IdP secret without losing any `ExternalAccount` rows.

```http
PATCH /v1/oauth-providers/{id}
Content-Type: application/json

{ "scopes": ["openid", "email", "profile", "groups"] }
```

Add a scope (the next sign-in via this provider sees the new consent screen and updated `ExternalAccount.scopes`).

```http
PATCH /v1/oauth-providers/{id}
Content-Type: application/json

{ "enabled": false }
```

Pause the provider. Existing user links survive; the SDK hides the button on its next bootstrap.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| **"redirect_uri_mismatch" at the IdP** | The IdP's allowed-redirects list doesn't contain the exact `redirect_uri` from the authn.sh row. Re-copy from the Dashboard — note that the env_slug is part of the URL, so dev / staging / prod environments need separate IdP-side entries. |
| **`oauth_discovery_refresh_failed` on the test** | Cached OIDC discovery is older than 24h and the refresh attempt timed out. Verify the issuer URL and that the discovery endpoint is reachable from authn.sh. |
| **`oauth_userinfo_unreachable` on the test** | The userinfo URL returns 5xx. Check the IdP's status page or your firewall rules. |
| **Callback redirects to the SDK with `__authn_error=oauth_state_invalid`** | The `state` parameter has been replayed (60s TTL) or the parent flow has been abandoned. Restart the sign-in. |
| **Sign-in completes, but `User.first_name` is empty** | The IdP didn't ship `given_name` in this user's profile. Either the user has no first name set on the IdP side, or your `attribute_mapping` references a claim path the IdP doesn't populate. Check `ExternalAccount.public_metadata` to see what the IdP actually returned. |

## Next steps

- [Custom OAuth2 walkthrough](/guides/custom-oauth2/) — for plain OAuth 2.0 IdPs without OIDC discovery.
- [Connected-accounts components](/reference/connected-accounts/) — `<SocialButtons />`, `<ConnectedAccountsPanel />` props.
- [Social sign-in guide](/guides/social-sign-in/) — overview of the four shipped presets and the toggle matrix.
