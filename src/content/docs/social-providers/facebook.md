---
title: Facebook
description: Configure Facebook (Meta) sign-in as an OAuth preset.
---

Facebook is an OAuth 2.0 preset shipped from v0.5 of authn.sh. Facebook ships custom userinfo semantics — the `/me` endpoint requires an explicit `fields` query parameter to surface email + name. authn.sh's preset handles that for you.

## Default scopes

| Scope | Returns |
| --- | --- |
| `public_profile` | Facebook user `id`, `name`, `first_name`, `last_name`, `picture`. |
| `email` | Primary email address (verified). |

## Register an application on Meta

1. Open [Meta for Developers → My Apps](https://developers.facebook.com/apps/) and click **Create App**.
2. Pick **Consumer** as the use case (or **Business** if you need advanced permissions). Name the app and confirm.
3. Inside the app, under **Add products to your app**, add **Facebook Login**.
4. In **Facebook Login → Settings**, paste the `redirect_uri` from your authn.sh `OauthProvider` row — `https://<env_slug>.authn.sh/v1/oauth-callback/facebook` — into **Valid OAuth Redirect URIs**. Save.
5. In **App settings → Basic**, copy **App ID** (this is the `client_id`) and **App Secret** (this is the `client_secret` — click **Show**, you may need to re-enter your Facebook password).

## Configure the provider in authn.sh

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "facebook",
  "name": "Facebook",
  "client_id": "1234567890123456",
  "client_secret": "your-facebook-app-secret-here"
}
```

## `attribute_mapping`

Preset defaults — no override needed for the common case:

| authn.sh field | Facebook claim |
| --- | --- |
| `email_address` | `email` |
| `first_name` | `first_name` |
| `last_name` | `last_name` |
| `provider_user_id` | `id` |
| `profile_image_url` | `picture.data.url` |

Note `picture.data.url` — Facebook returns the avatar as a nested object, not a top-level URL. authn.sh's `attribute_mapping` understands dot-paths so the default works out of the box.

## Notes

- Facebook only surfaces `email` if the user granted the `email` permission **and** their Facebook account has a verified email. If the user has no verified email, `email_address` lands as `null` and the FAPI rejects the sign-up with `oauth_no_email_returned` — you'll want a fallback flow (email-code / password) for those users, or set `allow_sign_up: false` on the Facebook row so they fall back to an existing-account sign-in.
- Facebook's app review process gates `public_profile` past the development phase. While your app is in development mode, only Meta accounts you've added as developers / testers can sign in. Submit for review when you're ready to ship.
- The `picture.data.url` Facebook returns is a short-lived URL pointing at their CDN. authn.sh re-fetches and re-hosts the avatar on first sign-in so the link doesn't decay.
