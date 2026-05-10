---
title: Custom OAuth2 walkthrough
description: Wire a plain OAuth 2.0 provider — no OIDC discovery — into authn.sh.
---

The `custom_oauth2` provider kind is for IdPs that speak plain OAuth 2.0 but don't ship an OIDC discovery document. Legacy in-house IdPs, single-purpose APIs (some workforce-identity providers, some social-graph APIs), or providers behind a corporate firewall that exposes only the bare endpoints — all of these go here.

You'll supply every endpoint manually. There's no `.well-known/openid-configuration` to fetch, no ID token to decode — the resolver fetches the IdP's userinfo URL with the access token and reads the JSON response directly. If you have OIDC discovery, prefer the [Custom OIDC walkthrough](/guides/custom-oidc/) instead.

## Before you start

You need:

- **An IdP-side OAuth application**. The redirect URI you'll register is `https://<env_slug>.authn.sh/v1/oauth-callback/<your_provider_key>`.
- **The IdP's three endpoints**:
  - `authorization_endpoint` — where the user agent goes to start auth.
  - `token_endpoint` — where authn.sh exchanges the code for an access token.
  - `userinfo_endpoint` — where authn.sh fetches the user profile with the access token.
- **The userinfo call's transport details**: HTTP method (`GET` or `POST`) and how the access token is presented (`bearer` header, HTTP `basic`, or query string).
- **A `client_id` and `client_secret`**.
- **The userinfo response shape** — what fields ship `email`, `id`, etc. You'll write `attribute_mapping` against this.

## Step 1 — Choose a `provider_key`

Same rules as the OIDC walkthrough — a stable lowercase slug, immutable once created. The strategy name is `oauth_<provider_key>`; `ExternalAccount.provider_key` is frozen on every row to this value.

```
legacy_idp
acme_internal
workforce_v1
```

## Step 2 — Pick **Custom OAuth2** and fill the wizard

Open **Dashboard → Configure → Authentication → Social providers → Add provider → Custom OAuth2**. The wizard differs from the OIDC variant in that it skips discovery entirely and asks you for every endpoint up front.

| Field | Example | Notes |
| ----- | ------- | ----- |
| `authorization_endpoint` | `https://idp.legacy.example/oauth/authorize` | Where the user agent is sent on click. |
| `token_endpoint` | `https://idp.legacy.example/oauth/token` | Where authn.sh exchanges the code. Always called server-side with `client_id` + `client_secret`. |
| `userinfo_endpoint` | `https://idp.legacy.example/api/me` | Returns the user profile JSON. Required — there's no ID-token fallback like OIDC has. |
| `userinfo_method` | `GET` | Most IdPs use `GET`. A few (Yahoo, some Asian-region IdPs) require `POST` with the access token in the body. |
| `userinfo_auth` | `bearer` | How the access token is presented: `bearer` (`Authorization: Bearer <token>`), `basic` (HTTP Basic with the token as username), or `query` (`?access_token=<token>`). |
| `client_id`, `client_secret` | — | From the IdP application. |
| `scopes` | `["read_profile", "read_email"]` | Whatever scopes your IdP accepts to read profile + email. |

There's no automatic default scope set for `custom_oauth2` — the platform doesn't know what your IdP accepts. Supply explicitly.

## Step 3 — Save and copy the redirect URI

Click **Save**. The response surfaces the computed `redirect_uri` — copy it, switch to the IdP's developer console, and paste it into the application's allowed-redirects list. Save the IdP-side change.

```
https://wise-otter-x4f.authn.sh/v1/oauth-callback/legacy_idp
```

## Step 4 — Write `attribute_mapping`

This is where `custom_oauth2` differs most from OIDC. There's no standard `sub` / `email` / `given_name` claim shape — you have to tell the resolver what your IdP's userinfo response looks like.

Suppose `GET https://idp.legacy.example/api/me` returns:

```json
{
  "id": 42,
  "email": "alice@acme.example",
  "name": "Alice Smith",
  "avatar_url": "https://idp.legacy.example/avatars/42.png"
}
```

The mapping is:

```json
{
  "attribute_mapping": {
    "email_address": "email",
    "provider_user_id": "id",
    "first_name": "name",
    "profile_image_url": "avatar_url"
  }
}
```

Notes:

- `provider_user_id` is **required**. It's the IdP's stable identifier for the user (the equivalent of OIDC's `sub`). Pick the field that's unique and immutable per IdP user; numeric IDs are fine — the resolver stores them as strings.
- Nested paths use dot syntax: `"first_name": "name.first"` works for `{ "name": { "first": "Alice" } }`.
- Unknown fields don't error — they map to the empty string. So you can leave `last_name` out of the mapping when the IdP only returns a single `name` field.
- Anything you **don't** map is dropped onto `ExternalAccount.public_metadata` automatically. So extra IdP-specific fields (`group_ids`, `team_slug`, …) end up there with no extra config.

## Step 5 — Hit the test button

`POST /v1/oauth-providers/{id}/test` is the same probe as for OIDC, with two differences for `custom_oauth2`:

- No discovery refresh — the row has no `discovery_endpoint`.
- The HEAD probe targets the manually-supplied `userinfo_endpoint`. A `401` / `403` is a healthy response (the IdP is reachable and rejected the no-token request as it should). A `5xx`, `404`, or DNS failure surfaces an error.

The test button also previews the `authorize_url` — eyeball it and confirm `client_id`, `redirect_uri`, and `scope` look right.

## Step 6 — Map the email-verified signal (optional)

OIDC ships `email_verified: true|false` on the standard claim. Plain OAuth 2.0 IdPs don't — they may use `verified_email`, `email_verified_at`, or simply not surface verification at all.

If your IdP **does** ship a verification field, mention it to the resolver via the special `_verified` mapping (this is one of the few non-canonical keys `attribute_mapping` accepts):

```json
{
  "attribute_mapping": {
    "email_address": "email",
    "_verified": "email_confirmed_at",
    "provider_user_id": "id"
  }
}
```

The resolver evaluates `email_confirmed_at` as truthy / falsy — non-empty string, non-zero number, or boolean `true` flips `ExternalAccount.verified` to `true` and lets the resolver attach the email to the parent `User.email_addresses[]` automatically.

If the IdP **doesn't** surface verification, leave `_verified` unmapped. `ExternalAccount.verified` stays `false` and the resolver won't auto-merge the email — users still sign in fine, but their email lands as unverified on the `ExternalAccount` row only.

## Step 7 — Tighten and enable

Same toggles as the OIDC walkthrough — `allow_sign_in`, `allow_sign_up`, `block_email_subaddresses`. Flip `enabled: true` once you're happy.

## When the IdP needs `POST` userinfo with the token in the body

Some legacy IdPs reject `Authorization: Bearer …` and require:

```http
POST /api/me HTTP/1.1
Host: idp.legacy.example
Content-Type: application/x-www-form-urlencoded

access_token=<token>
```

Set `userinfo_method: POST` and `userinfo_auth: query`. authn.sh's resolver builds that exact request shape.

For HTTP Basic (the access token is the username, password empty):

```
userinfo_method: GET
userinfo_auth: basic
```

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| **Sign-in completes, but `provider_user_id` is `""`** | `attribute_mapping.provider_user_id` references a claim path the userinfo response doesn't carry. Check `ExternalAccount.public_metadata` to see what the IdP actually returned, then re-key the mapping. |
| **The same user keeps creating new `ExternalAccount` rows** | `provider_user_id` resolved to an empty string on every sign-in (see above), so the find-or-create-by-`provider_user_id` matcher never matches. Once `attribute_mapping.provider_user_id` is fixed, existing duplicate rows stay; new sign-ins resolve correctly. |
| **`token_endpoint` returns `400 invalid_grant`** | Usually a redirect-URI mismatch — IdPs verify the `redirect_uri` parameter on the token exchange must match the one used at `/authorize`. Check the IdP-side allowed-redirects list. |
| **Userinfo returns a paginated wrapper** (`{ "data": [{ "email": "…" }], "pagination": …}`) | The resolver expects the userinfo body to be the user object directly. Most plain-OAuth IdPs honor this. If yours wraps the user in a `data` array, fix the IdP-side endpoint or, for read-only IdPs you can't change, pre-process via a webhook hop (out of scope here). |

## Next steps

- [Custom OIDC walkthrough](/guides/custom-oidc/) — for OIDC providers (much less wiring).
- [Social sign-in guide](/guides/social-sign-in/) — overview of all provider kinds.
