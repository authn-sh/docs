---
title: Discord
description: Configure Discord sign-in as an OAuth preset.
---

Discord is an OAuth 2.0 preset shipped from v0.5 of authn.sh. Discord doesn't expose OIDC discovery, so the preset is wired as plain OAuth 2.0 with hard-coded endpoints.

## Default scopes

| Scope | Returns |
| --- | --- |
| `identify` | Discord `id`, `username`, `discriminator`, `avatar`. |
| `email` | Verified primary email address. |

Add more scopes per row if you need guild membership / friends list / etc. — they go on the `scopes[]` field of the `OauthProvider` row.

## Register an application on Discord

1. Open the [Discord Developer Portal → Applications](https://discord.com/developers/applications) and click **New Application**.
2. Name the app (this is what users see at the consent screen) and confirm.
3. Open **OAuth2 → General**.
4. Under **Redirects**, paste the `redirect_uri` from your authn.sh `OauthProvider` row — the canonical format is `https://<env_slug>.authn.sh/v1/oauth-callback/discord` (or the equivalent under your self-hosted apex). Save.
5. Copy **Client ID** and click **Reset Secret** to generate a fresh **Client Secret**. Copy it.

## Configure the provider in authn.sh

Click through **Dashboard → Configure → Authentication → Social providers → Add provider → Discord** and paste the credentials. Or POST via BAPI:

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "discord",
  "name": "Discord",
  "client_id": "1234567890123456789",
  "client_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## `attribute_mapping`

The preset ships with sensible defaults — no override needed for the common case:

| authn.sh field | Discord claim |
| --- | --- |
| `email_address` | `email` |
| `first_name` | `username` |
| `provider_user_id` | `id` |
| `profile_image_url` | `avatar` (the SDK rewrites it to the full CDN URL) |

If you'd rather use the Discord global display name as `first_name`, override `attribute_mapping`:

```json
{
  "attribute_mapping": {
    "email_address": "email",
    "first_name": "global_name",
    "provider_user_id": "id"
  }
}
```

## Notes

- Discord requires the user's primary email to be **verified** before it surfaces it on the userinfo response. authn.sh trusts this — accounts created via Discord land with `email_address.verified: true`.
- Discord's userinfo response is paginated only for friends / guilds. The basic `identify` + `email` payload comes back in a single call.
