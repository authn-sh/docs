---
title: Discovery endpoint + JWKS
description: The /.well-known/openid-configuration document authn.sh serves per env, what's in it, and why standard OIDC client libraries should always read from it rather than hard-coding endpoints.
---

OIDC requires IdPs to publish a **discovery document** so client libraries can resolve every endpoint, supported scope, and capability from a single URL. authn.sh serves the document at `/.well-known/openid-configuration` for every env. Available from v0.7.

The matching **JWKS** (JSON Web Key Set) — the public keys client libraries use to verify `id_token` signatures — lives at `/.well-known/jwks.json`. This isn't new to v0.7; OAuth provider mode reuses the same JWKS the env's regular session tokens are signed with.

## Discovery URL

```
https://<env_slug>.authn.sh/.well-known/openid-configuration
```

The full URL for the example env: `https://example.authn.sh/.well-known/openid-configuration`. For self-hosted envs with a custom domain (via the `<CustomDomain />` reference under the chart / CDK construct), substitute your domain.

The response is **public** — no auth, CORS-open (`Access-Control-Allow-Origin: *`), cached for 5 minutes (`Cache-Control: public, max-age=300, stale-while-revalidate=86400`). The 5-minute window is short enough to absorb scope-registry changes; the stale-while-revalidate window keeps it responsive when something is rolled out at midnight.

## Document shape

```json
{
  "issuer": "https://example.authn.sh",
  "authorization_endpoint": "https://example.authn.sh/oauth/authorize",
  "token_endpoint": "https://example.authn.sh/oauth/token",
  "userinfo_endpoint": "https://example.authn.sh/oauth/userinfo",
  "introspection_endpoint": "https://example.authn.sh/oauth/token_info",
  "jwks_uri": "https://example.authn.sh/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256", "ES256"],
  "scopes_supported": [
    "openid", "profile", "email", "phone", "offline_access",
    "organization:read", "organization:write"
  ],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "claims_supported": [
    "sub", "iss", "aud", "exp", "iat", "nonce",
    "name", "given_name", "family_name", "profile_image_url", "locale",
    "email", "email_verified",
    "phone_number", "phone_number_verified",
    "org_id", "org_role", "org_slug"
  ]
}
```

Two notes:

- **`scopes_supported` is per-env, not per-application.** It lists every scope the environment can issue; an individual `OauthApplication` is restricted to a subset (its registered `scopes[]`).
- **`code_challenge_methods_supported`** lists only `S256`. `plain` is accepted for `is_public: false` clients (legacy) but isn't advertised — advertising it would encourage public clients to pick it, which we don't want.

## JWKS

```
GET https://example.authn.sh/.well-known/jwks.json
```

Returns the env's public signing keys:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "kid_01HKX9Y…",
      "use": "sig",
      "alg": "RS256",
      "n": "1bI6E…",
      "e": "AQAB"
    }
  ]
}
```

The same JWKS verifies:

- Regular FAPI session tokens (existed since v0.1).
- OAuth provider mode `id_token`s.
- OAuth provider mode `access_token`s (when JWT-formatted — the default).

There's one signing key per env at any given time. Rotation cycles a new `kid` into the JWKS, marks it primary for fresh tokens, and keeps the old key in the JWKS for the token-validity window so issued-but-not-expired tokens stay verifiable. The standard JWKS-caching client-library posture handles this automatically.

For a deeper dive on the rotation mechanics, see [JWT claims](/reference/jwt-claims/#key-rotation).

## Using discovery in client libraries

The whole point of discovery is that clients don't hard-code your endpoints. Three concrete examples:

### oidc-client-ts (browser SPA)

```typescript
import { UserManager } from 'oidc-client-ts';

const manager = new UserManager({
  authority: 'https://example.authn.sh',     // discovery URL = authority + /.well-known/openid-configuration
  client_id: 'oac_pub_AbC123',
  redirect_uri: 'https://acme.example/oauth/callback',
  scope: 'openid profile email',
  response_type: 'code',
});
```

`oidc-client-ts` reads `https://example.authn.sh/.well-known/openid-configuration` on init and uses the endpoints it finds. Same library handles PKCE for you.

### NextAuth (Node server + browser SPA)

```javascript
import NextAuth from 'next-auth';

export default NextAuth({
  providers: [
    {
      id: 'authn-sh',
      name: 'Acme Authn',
      type: 'oauth',
      wellKnown: 'https://example.authn.sh/.well-known/openid-configuration',
      clientId: process.env.AUTHN_CLIENT_ID,
      clientSecret: process.env.AUTHN_CLIENT_SECRET,
      authorization: { params: { scope: 'openid profile email' } },
      idToken: true,
      checks: ['pkce', 'state'],
    },
  ],
});
```

The `wellKnown` field makes NextAuth resolve every endpoint from your discovery doc.

### Python requests-oauthlib

```python
import requests
from requests_oauthlib import OAuth2Session

discovery = requests.get('https://example.authn.sh/.well-known/openid-configuration').json()

oauth = OAuth2Session(
    client_id='oac_pub_AbC123',
    redirect_uri='https://acme.example/oauth/callback',
    scope=['openid', 'profile', 'email'],
)
auth_url, state = oauth.authorization_url(discovery['authorization_endpoint'])
```

## Why not hard-code?

Don't pin your client to authentication endpoints by hand. Discovery exists so that:

- The env can add new scopes / claims and clients see them on the next document fetch.
- Key rotation is invisible to clients (they re-fetch JWKS on signature-verification miss).
- A custom-domain swap (`acme-internal.authn.sh` → `id.acme.example`) means flipping the `authority` URL once, not 12 hard-coded endpoints.
- The env can quietly switch from RS256 to ES256 signing without breaking any client.

Hard-coding is a deferred liability. Read the discovery doc.
