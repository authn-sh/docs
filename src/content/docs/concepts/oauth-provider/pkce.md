---
title: PKCE for public clients
description: How authn.sh enforces RFC 7636 Proof Key for Code Exchange for any OauthApplication with is_public — code_challenge_methods, length bounds, error codes.
---

**PKCE** (RFC 7636) is the authorization-code grant variant for clients that can't safely store a `client_secret` — mobile apps, single-page apps, CLI tools. authn.sh implements PKCE per the spec and **requires** it for every `OauthApplication` with `is_public: true`. Available from v0.7.

This page assumes you've read [the authorization-code flow](/concepts/oauth-provider/authorization-code-flow/) — PKCE is the same flow with two extra parameters.

## The protocol in 30 seconds

1. The app generates a high-entropy random string — the **`code_verifier`**.
2. The app hashes it (SHA-256, base64url-no-pad) — the **`code_challenge`**.
3. On `/oauth/authorize`, the app sends `code_challenge` + `code_challenge_method=S256`. The server binds them to the authorization code it issues.
4. On `/oauth/token`, the app sends `code_verifier`. The server hashes it and compares against the stored `code_challenge`.

The verifier never leaves the app's process. An attacker intercepting the authorization code can't redeem it without the verifier, so the redirect-URI hijacking attack PKCE was designed to mitigate is foreclosed.

## Authorize call

```
https://example.authn.sh/oauth/authorize
  ?response_type=code
  &client_id=oac_pub_AbC123
  &redirect_uri=acme-mobile%3A%2F%2Foauth%2Fcallback
  &scope=openid%20profile%20email
  &state=A8z4Q…
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

- **`code_challenge`** — base64url-no-pad SHA-256 of the verifier. 43 chars exactly.
- **`code_challenge_method`** — must be `S256`. `plain` is accepted only for `is_public: false` clients (a non-default escape hatch for legacy confidential clients) and rejected for public clients.

If `code_challenge` is missing on a public client, `/oauth/authorize` rejects:

```
HTTP/1.1 302 Found
Location: acme-mobile://oauth/callback
  ?error=invalid_request
  &error_description=code_challenge%20required%20for%20public%20clients
  &state=A8z4Q…
```

## Token call

```http
POST /oauth/token HTTP/1.1
Host: example.authn.sh
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=oac_pub_AbC123
&code=ac_5Z…
&redirect_uri=acme-mobile%3A%2F%2Foauth%2Fcallback
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Note: **no `Authorization: Basic` header**, and `client_id` is in the body (since there's no secret). The `code_verifier` is the original random string — the server SHA-256s it and compares against the stored `code_challenge`.

Length bounds for the verifier (RFC 7636 §4.1):

- Minimum 43 characters.
- Maximum 128 characters.
- Alphabet: `[A-Z][a-z][0-9]-._~` (unreserved per RFC 3986).

Out-of-range verifiers fail with `invalid_request` before the hash comparison runs.

## Failure modes

| Cause | Response |
| --- | --- |
| Verifier hashes to a different challenge | `400 invalid_grant` |
| Verifier missing on a code that was issued with a challenge | `400 invalid_grant` |
| Verifier provided on a code that was issued without a challenge | `400 invalid_grant` |
| Verifier outside the length / alphabet bounds | `400 invalid_request` |
| `code_challenge_method=plain` on a public client | `302` redirect with `error=invalid_request` |

The server never reveals which of these tripped — every PKCE failure looks like a generic `invalid_grant` from the caller's perspective. Detail lives in the env's audit log (BAPI `/v1/audit-log`) with the real reason.

## Generating verifier + challenge

For reference, this is the standard codepath:

```javascript
// In any Web-Crypto-capable runtime (browser / Node 19+ / Deno / Bun)
const arr = new Uint8Array(32);
crypto.getRandomValues(arr);
const verifier = base64UrlNoPad(arr);                   // ~43 chars
const hashed   = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
const challenge = base64UrlNoPad(new Uint8Array(hashed));
```

```python
# Python 3.x
import secrets, hashlib, base64

verifier = secrets.token_urlsafe(32).rstrip('=')        # ~43 chars
challenge = base64.urlsafe_b64encode(
    hashlib.sha256(verifier.encode()).digest()
).rstrip(b'=').decode()
```

Every OIDC client library worth its salt does this for you — `oidc-client-ts`, `appauth-android` / `-ios`, the `requests-oauthlib` Python lib. If you're rolling your own, the snippets above are correct.

## Why authn.sh enforces this

PKCE without `client_secret` is the modern best practice for any client where a secret can't be hidden:

- Mobile apps — the secret would ship in the binary.
- SPAs — the secret would ship in the JS bundle.
- CLI tools — the secret would ship in the binary, or in a config file the user could read.

For these, the `code_secret` provides no security benefit and creates a false sense of one. PKCE replaces it with a per-flow proof that the same process that started the flow is finishing it.

For confidential server-to-server clients (Rails / Django / Laravel / Node backend doing OIDC sign-in), PKCE is **optional but recommended** — RFC 9700 (OAuth 2.0 Security BCP) recommends it for all clients. authn.sh accepts `code_challenge` + `code_verifier` from confidential clients and validates both when present.
