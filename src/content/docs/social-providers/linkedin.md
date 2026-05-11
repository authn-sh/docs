---
title: LinkedIn
description: Configure LinkedIn sign-in as an OIDC preset.
---

LinkedIn is an OIDC preset shipped from v0.5 of authn.sh. LinkedIn exposes the standard OIDC discovery document, so the preset is wired as `custom_oidc` under the hood with the issuer auto-resolved.

## Default scopes

| Scope | Returns |
| --- | --- |
| `openid` | Required by OIDC. |
| `profile` | LinkedIn `sub` (user id), `name`, `given_name`, `family_name`, `picture`. |
| `email` | Email + `email_verified`. |

## Register an application on LinkedIn

1. Open [LinkedIn Developers → My Apps](https://www.linkedin.com/developers/apps) and click **Create app**.
2. Fill out the form (app name, associated company page, app logo). Confirm.
3. Open **Products** and add **Sign In with LinkedIn using OpenID Connect**. Approval is usually immediate.
4. Open **Auth** → **OAuth 2.0 settings**. Paste the `redirect_uri` from your authn.sh `OauthProvider` row — `https://<env_slug>.authn.sh/v1/oauth-callback/linkedin` — into **Authorized redirect URLs for your app**. Save.
5. Copy **Client ID** and **Client Secret** from the same screen.

## Configure the provider in authn.sh

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "linkedin",
  "name": "LinkedIn",
  "client_id": "861234567890ab",
  "client_secret": "your-linkedin-client-secret-here"
}
```

## `attribute_mapping`

Preset defaults — no override needed for the common case:

| authn.sh field | LinkedIn claim |
| --- | --- |
| `email_address` | `email` |
| `first_name` | `given_name` |
| `last_name` | `family_name` |
| `provider_user_id` | `sub` |
| `profile_image_url` | `picture` |

## Notes

- LinkedIn returns `email_verified: true` for every email surfaced via the OIDC userinfo endpoint — they only return the user's primary, verified address.
- The legacy "Sign In with LinkedIn v1" product (non-OIDC) is **not** what this preset uses; make sure the **OpenID Connect** variant is added to your LinkedIn app, otherwise the discovery document won't resolve and the test button returns `oauth_discovery_failed`.
