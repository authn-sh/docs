---
title: Slack
description: Configure "Sign in with Slack" as an OIDC preset.
---

Slack is an OIDC preset shipped from v0.5 of authn.sh. Slack exposes the standard OIDC discovery document under "Sign in with Slack", so the preset is wired as `custom_oidc` under the hood with the issuer auto-resolved to `https://slack.com`.

## Default scopes

| Scope | Returns |
| --- | --- |
| `openid` | Required by OIDC. |
| `profile` | Slack `sub`, `name`, `given_name`, `family_name`, `picture`, `https://slack.com/team_id`, `https://slack.com/team_name`. |
| `email` | Email + `email_verified`. |

## "Sign in with Slack" vs "Add to Slack"

Slack has two OAuth surfaces:

- **Sign in with Slack** — OIDC-shaped, returns user identity claims. This is the one this preset uses.
- **Add to Slack** — installs your app as a Slack workspace integration. Different scopes (`channels:read`, `chat:write`, …), different endpoint. Not relevant to authn.sh.

If you need both (auth + a Slack bot), keep them in separate Slack apps so the scope sets don't entangle.

## Register an application on Slack

1. Open the [Slack API → Your Apps](https://api.slack.com/apps) page and click **Create New App** → **From scratch**.
2. Name the app, pick a development workspace, confirm.
3. In the app settings, open **OAuth & Permissions**.
4. Under **Redirect URLs**, click **Add New Redirect URL**, paste the `redirect_uri` from your authn.sh `OauthProvider` row — `https://<env_slug>.authn.sh/v1/oauth-callback/slack` — and save.
5. Scroll down to **User Token Scopes** and add `openid`, `profile`, `email`.
6. From **Basic Information** → **App Credentials**, copy **Client ID** and **Client Secret**.

## Configure the provider in authn.sh

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "slack",
  "name": "Slack",
  "client_id": "1234567890123.5678901234567",
  "client_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## `attribute_mapping`

Preset defaults — no override needed for the common case:

| authn.sh field | Slack claim |
| --- | --- |
| `email_address` | `email` |
| `first_name` | `given_name` |
| `last_name` | `family_name` |
| `provider_user_id` | `sub` |
| `profile_image_url` | `picture` |

## Workspace metadata

Slack ships the user's workspace as custom claims:

- `https://slack.com/team_id` — the Slack workspace's stable identifier.
- `https://slack.com/team_name` — the workspace's human name.

If you want to pin authn.sh `Organization` membership to the Slack workspace, expose these claims via `attribute_mapping` and use them in your post-callback hook:

```json
{
  "attribute_mapping": {
    "email_address": "email",
    "first_name": "given_name",
    "last_name": "family_name",
    "provider_user_id": "sub",
    "profile_image_url": "picture",
    "public_metadata.slack_team_id": "https://slack.com/team_id",
    "public_metadata.slack_team_name": "https://slack.com/team_name"
  }
}
```

The `public_metadata.*` mapping syntax writes the value onto `User.public_metadata` at sign-up, where your backend can read it from the JWT and slot the user into the right `Organization`.

## Notes

- Slack OIDC returns one identity per (user × workspace). The same human signing in from two workspaces lands as two `ExternalAccount` rows under the same `User` if the email matches, or two `User`s if the emails are different.
- Slack returns `email_verified: true` for every email surfaced — they only release the user's verified primary.
