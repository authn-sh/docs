---
title: Authorization-code grant flow
description: Step-by-step trace of /oauth/authorize → consent → /oauth/token — the canonical RFC 6749 §4.1 + OIDC §3.1.2.1 flow as authn.sh implements it.
---

The authorization-code grant is the flow third-party apps use to obtain tokens on behalf of a user. authn.sh implements RFC 6749 §4.1 + OIDC §3.1.2.1 exactly — no proprietary deviations. Available from v0.7.

This page traces one canonical flow end-to-end. For PKCE specifics (mandatory for public clients), see [PKCE for public clients](/concepts/oauth-provider/pkce/).

## Cast

- **Acme** — a third-party app. Has registered an `OauthApplication` with `client_id: oac_pub_AbC123`, `client_secret: oac_sec_xy7…`, `redirect_uris: ["https://acme.example/oauth/callback"]`, scopes `["openid", "profile", "email"]`.
- **Brian** — an end-user, signed in (or not) to the example env `https://example.authn.sh`.
- **example.authn.sh** — the authn.sh env acting as the IdP.

## Step 1 — Acme redirects Brian to /oauth/authorize

Acme's frontend builds the URL:

```
https://example.authn.sh/oauth/authorize
  ?response_type=code
  &client_id=oac_pub_AbC123
  &redirect_uri=https%3A%2F%2Facme.example%2Foauth%2Fcallback
  &scope=openid%20profile%20email
  &state=A8z4Q…
  &nonce=R1k…
```

Required parameters:

- `response_type=code` — the only response type authn.sh supports.
- `client_id` — Acme's `OauthApplication.client_id`.
- `redirect_uri` — must **exactly match** one of the registered URIs. Strict matching per OAuth 2.1 BCP §1.4.2.
- `scope` — space-separated. Each scope must be in the app's registered `scopes[]`.
- `state` — CSRF token. Echoed back unchanged on the redirect. Acme generates and verifies.

Optional parameters:

- `nonce` — recommended for OIDC. Echoed into the `id_token` so Acme can detect replay.
- `prompt` — `none` / `login` / `consent` / `select_account`. Controls re-auth and consent behaviour.
- `code_challenge` + `code_challenge_method=S256` — required for `is_public: true` clients (PKCE).
- `max_age` — request a re-auth if the user's session is older than this in seconds.

Brian's browser follows the redirect.

## Step 2 — authn.sh signs Brian in (or short-circuits)

`/oauth/authorize` first checks: does Brian have an active session on `example.authn.sh`?

- **No session, or `prompt=login` was passed.** authn.sh renders the regular `<SignIn />` UI. After successful sign-in, it falls through to step 3.
- **Active session, no `prompt`.** Short-circuit to step 3.
- **Active session, `prompt=none`.** Short-circuit to step 3. If the consent screen would normally render (see below), instead redirect back to `redirect_uri` with `error=consent_required` — `prompt=none` means "fail rather than show UI".

The session is the **environment's existing FAPI session** — there's no separate "OAuth session". A user signed into `https://example.authn.sh` for any reason (your own product's sign-in, an earlier `/oauth/authorize`) is signed in for the OAuth flow too.

## Step 3 — Consent

authn.sh renders the consent screen with the data from `OauthApplication.consent_screen`:

```
+----------------------------------------+
| Acme Pages wants to access your        |
| account on example.authn.sh            |
|                                        |
| It will be able to:                    |
| ✓ Sign you in                          |
| ✓ See your name and profile image      |
| ✓ See your email address               |
|                                        |
| [Privacy] [Terms]                      |
|                                        |
| [Cancel]               [Allow]         |
+----------------------------------------+
```

The "It will be able to" list is generated from the requested `scope` against the scope registry's human-readable descriptions.

**Consent is skipped** if a non-revoked `AuthorizationGrant` row already exists for `(Brian, oac_pub_AbC123)` covering **a superset** of the requested scopes. This is the "I already trust this app" path — the second sign-in skips the screen and goes straight to a fresh code. If new scopes are requested, the screen renders with a "Plus, new permissions:" diff section showing only the additions.

If `prompt=consent` is passed, the screen always renders, even with an existing grant. Used for re-confirmation flows.

Brian clicks **Allow**. authn.sh:

- Upserts the `AuthorizationGrant` row — creates if new, expands `granted_scopes[]` if existing.
- Generates a single-use `authorization_code` — opaque string, 10-minute TTL, bound to `(client_id, redirect_uri, code_challenge?)`.

## Step 4 — authn.sh redirects back

```
302 Found
Location: https://acme.example/oauth/callback
  ?code=ac_5Z…
  &state=A8z4Q…
```

Brian's browser follows the redirect to Acme's callback endpoint. Acme verifies that `state` matches what it issued — if not, abort.

## Step 5 — Acme exchanges the code (server-to-server)

```http
POST /oauth/token HTTP/1.1
Host: example.authn.sh
Content-Type: application/x-www-form-urlencoded
Authorization: Basic b2FjX3B1Yl9BYkMxMjM6b2FjX3NlY194eTcuLi4=

grant_type=authorization_code
&code=ac_5Z…
&redirect_uri=https%3A%2F%2Facme.example%2Foauth%2Fcallback
```

The `Authorization: Basic` header carries `client_id:client_secret` (RFC 6749 §2.3.1). Public clients omit the `Authorization` header and pass `code_verifier` instead.

authn.sh validates:

- The `code` is unconsumed and not expired.
- The `client_id` matches the code's binding.
- The `redirect_uri` matches the code's binding (defense-in-depth — already validated on the authorize call).
- The `code_verifier` hashes to the `code_challenge` if PKCE was used.

On success:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "at_eyJ…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_eyJ…",
  "scope": "openid profile email",
  "id_token": "eyJraWQiOi…"
}
```

- `access_token` — bearer token for `/oauth/userinfo` and any custom resource servers. JWT, signed by the env's JWKS.
- `refresh_token` — present iff `offline_access` was in the granted scopes. Long-lived; redeems for a fresh access token at `/oauth/token` with `grant_type=refresh_token`.
- `id_token` — JWT. OIDC standard claims (`iss`, `sub`, `aud`, `exp`, `iat`, `nonce`) plus scope-filtered profile claims.

## Step 6 — Acme calls /oauth/userinfo (optional)

```http
GET /oauth/userinfo HTTP/1.1
Host: example.authn.sh
Authorization: Bearer at_eyJ…
```

Response is the OIDC userinfo payload, scope-filtered:

```json
{
  "sub": "user_01HKX9…",
  "name": "Brian Adams",
  "given_name": "Brian",
  "family_name": "Adams",
  "profile_image_url": "https://…",
  "email": "brian@example.com",
  "email_verified": true
}
```

`phone` / `phone_verified` appear only if the `phone` scope was granted. The custom `organization:*` scopes attach `org_id`, `org_role`, `org_slug` claims on the same payload.

## Refresh-token rotation

Refresh tokens are **single-use** — every successful `refresh_token` grant rotates the refresh token and invalidates the old one. The response always includes a fresh `refresh_token`. If Acme attempts to redeem the same refresh token twice, the second call returns `400 invalid_grant` *and* revokes the `AuthorizationGrant` entirely (RFC 6749 §10.4-ish — refresh-token reuse is treated as a stolen-token signal).

## Error responses

The flow returns standard OAuth errors per RFC 6749 §4.1.2.1 — they come back as redirect-URI fragments / query strings on `/oauth/authorize` and as JSON bodies on `/oauth/token`.

| Code | Cause |
| --- | --- |
| `invalid_request` | Missing required parameter. |
| `invalid_client` | Unknown `client_id` or wrong `client_secret`. |
| `invalid_grant` | Authorization code expired / consumed / mismatched binding. |
| `invalid_scope` | Requested scope not in the app's registered `scopes[]`. |
| `access_denied` | User clicked **Cancel** on the consent screen. |
| `unsupported_response_type` | Anything other than `code`. |
| `server_error` | Surprise. Includes a `trace_id` in the body for support escalation. |

## Next

- [PKCE for public clients](/concepts/oauth-provider/pkce/) — the variant for mobile / SPA / CLI apps.
- [Discovery + JWKS](/concepts/oauth-provider/discovery/) — what's in `/.well-known/openid-configuration`.
- [JWT templates](/concepts/jwt-templates/) — substitute a custom token shape for the default issued at `/oauth/token`.
