---
title: X (formerly Twitter)
description: Configure X sign-in as an OAuth 2.0 + PKCE preset.
---

X (formerly Twitter) is an OAuth 2.0 + PKCE preset shipped from v0.5 of authn.sh. X requires PKCE for every authorization code grant — the preset enables it automatically; you don't need to flip anything.

## Default scopes

| Scope | Returns |
| --- | --- |
| `tweet.read` | Required by X's OAuth 2.0 surface even when you don't actually read tweets. |
| `users.read` | The user's profile (`id`, `username`, `name`, `profile_image_url`). |

## Email is not available

X **does not** expose the user's email via its OAuth 2.0 surface. The preset doesn't request `email` because X doesn't have a corresponding scope. This has two practical consequences:

- The userinfo response carries no `email` field. authn.sh creates the `User` with `email_address: null` and treats `provider_user_id` as the primary identifier.
- If your environment requires email on sign-up (the default `attributes.email_address.required: true` setting), X sign-ups will fail with `oauth_no_email_returned`. To allow X sign-ups, either flip `email_address.required` to `false` on the environment, or set `allow_sign_up: false` on the X provider row and use it for **linking** existing accounts (sign-in-only).

If you need email, point users at the standard email-code flow on first visit and let them link X afterwards via `<UserProfile />`.

## Register an application on X

1. Open the [X Developer Portal](https://developer.twitter.com/en/portal/dashboard) and create (or open) a Project.
2. Add an App inside the Project. Under **User authentication settings**:
   - **Type of App**: Web App.
   - **App permissions**: Read.
   - **Callback URI**: paste the `redirect_uri` from your authn.sh `OauthProvider` row — `https://<env_slug>.authn.sh/v1/oauth-callback/x`.
   - **Website URL**: your app's public URL.
   - Save.
3. From **Keys and tokens** → **OAuth 2.0 Client ID and Client Secret**, copy both.

## Configure the provider in authn.sh

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "x",
  "name": "X",
  "client_id": "QzlxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ",
  "client_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## `attribute_mapping`

Preset defaults — no override needed for the common case:

| authn.sh field | X claim |
| --- | --- |
| `provider_user_id` | `data.id` |
| `first_name` | `data.name` |
| `profile_image_url` | `data.profile_image_url` |

`email_address` is intentionally unmapped because X does not surface it.

## Notes

- PKCE is enforced server-side. The preset generates a `code_verifier`, hashes it into `code_challenge: S256`, includes it on the `/authorize` redirect, and posts the verifier back on the token exchange. You don't configure this; it's automatic.
- X's userinfo response is nested under a `data` key. The default `attribute_mapping` paths reflect that.
