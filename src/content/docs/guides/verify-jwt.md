---
title: Verify JWTs in a backend
description: Validate the __session JWT that authn.sh issues, in any language.
---

When a user calls your backend with a `__session` JWT (Bearer or cookie), you verify it locally — no network round-trip to authn.sh per request. JWKS is cached.

## What you need

- The FAPI URL for the environment (decoded from the publishable key, or copied from the Dashboard).
- A JWT-RS256 verifier in your language.

## PHP (Laravel)

The [`@authn-sh/sdk-php`](https://github.com/authn-sh/sdk-php) package ships a `JwtVerifier`:

```php
use Authn\Sdk\Auth\JwtVerifier;

$verifier = new JwtVerifier(fapiUrl: 'https://wise-otter-x4f.authn.sh');
$claims = $verifier->verify($request->bearerToken());

$userId = $claims['sub'];
$sessionId = $claims['sid'];
```

The verifier fetches `<fapiUrl>/.well-known/jwks.json`, caches it for 5 minutes, picks the public key by `kid`, and validates `iss`, `nbf`, `exp`, `iat`.

## Node / Express

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const jwks = createRemoteJWKSet(new URL('https://wise-otter-x4f.authn.sh/.well-known/jwks.json'))

export async function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
        ?? req.cookies['__session']
    if (!token) return res.status(401).json({ error: 'missing token' })

    try {
        const { payload } = await jwtVerify(token, jwks, {
            issuer: 'https://wise-otter-x4f.authn.sh',
        })
        req.userId = payload.sub
        req.sessionId = payload.sid
        next()
    } catch (err) {
        res.status(401).json({ error: 'invalid token', detail: String(err) })
    }
}
```

## Python (FastAPI)

```python
import time
from authlib.jose import jwt, JsonWebKey
import httpx

JWKS_URL = "https://wise-otter-x4f.authn.sh/.well-known/jwks.json"
_jwks_cache = {"fetched_at": 0, "key_set": None}

def _key_set():
    if time.time() - _jwks_cache["fetched_at"] > 300:
        _jwks_cache["key_set"] = JsonWebKey.import_key_set(httpx.get(JWKS_URL).json())
        _jwks_cache["fetched_at"] = time.time()
    return _jwks_cache["key_set"]

def verify_session(token: str) -> dict:
    claims = jwt.decode(token, _key_set())
    claims.validate()
    return claims
```

## What to check beyond the signature

The library does the basics; you still want to:

- Confirm `iss` is the exact FAPI URL you expect — pinning protects against a rogue env tricking your verifier with its own JWKS.
- Reject `sts == "pending"` if your code paths require a fully-completed session.
- Cross-reference `azp` (the Origin) against your allowed origins for state-changing requests if you don't already gate via CORS.
