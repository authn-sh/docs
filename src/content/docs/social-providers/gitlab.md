---
title: GitLab
description: Configure GitLab sign-in as an OIDC preset.
---

GitLab is an OIDC preset shipped from v0.5 of authn.sh. GitLab.com exposes OIDC discovery; the preset points at `https://gitlab.com/.well-known/openid-configuration` by default, but self-managed GitLab instances are supported via the `custom_oidc` kind (see below).

## Default scopes

| Scope | Returns |
| --- | --- |
| `openid` | Required by OIDC. |
| `profile` | GitLab `sub`, `name`, `nickname`, `preferred_username`, `picture`. |
| `email` | Email + `email_verified`. |

## Register an application on GitLab

1. Open [GitLab → User Settings → Applications](https://gitlab.com/-/profile/applications) (for personal apps) or your group's **Settings → Applications** for a group-owned app.
2. Click **Add new application**.
3. Fill in:
   - **Name**: anything (this is what users see at consent).
   - **Redirect URI**: paste the `redirect_uri` from your authn.sh `OauthProvider` row — `https://<env_slug>.authn.sh/v1/oauth-callback/gitlab`.
   - **Confidential**: yes (GitLab calls a server-side app "confidential").
   - **Scopes**: tick `openid`, `profile`, `email`.
4. Click **Save application**. Copy the **Application ID** (this is the `client_id`) and the **Secret** (this is the `client_secret`).

## Configure the provider in authn.sh

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "preset",
  "provider_key": "gitlab",
  "name": "GitLab",
  "client_id": "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
  "client_secret": "your-gitlab-application-secret-here"
}
```

## `attribute_mapping`

Preset defaults — no override needed for the common case:

| authn.sh field | GitLab claim |
| --- | --- |
| `email_address` | `email` |
| `first_name` | `given_name` (falls back to `name` if absent) |
| `last_name` | `family_name` |
| `provider_user_id` | `sub` |
| `profile_image_url` | `picture` |

## Self-managed GitLab

If you're pointing at a self-managed GitLab (`gitlab.acme.com`) instead of GitLab.com, register the provider as `custom_oidc` rather than `preset` and set the issuer to your instance's base URL:

```http
POST /v1/oauth-providers
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "provider_kind": "custom_oidc",
  "provider_key": "gitlab_acme",
  "name": "Acme GitLab",
  "client_id": "...",
  "client_secret": "...",
  "issuer": "https://gitlab.acme.com"
}
```

The server fetches `https://gitlab.acme.com/.well-known/openid-configuration` and populates the OIDC endpoints automatically. See the [Custom OIDC walkthrough](/guides/custom-oidc/) for the full flow.

## Notes

- GitLab returns `email_verified: true` for every email surfaced via the userinfo endpoint — they only release verified addresses.
- If your users sign in with both GitLab.com and a self-managed instance, they're two separate `OauthProvider` rows with two separate `ExternalAccount` links per user. There's no shared identity between them.
