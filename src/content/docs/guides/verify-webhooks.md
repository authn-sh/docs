---
title: Verify webhook signatures
description: Reject forged webhook deliveries with a constant-time HMAC check.
---

Every webhook delivery carries an `Authn-Signature` header. Verify it before trusting the body.

## The formula

```
signed_payload = $webhook_id . "." . $webhook_timestamp . "." . $raw_body
expected       = base64(hmac_sha256($secret, $signed_payload))
```

Compare `expected` to each `v1,...` segment of the header using a constant-time compare. During a rotation window you may receive two segments — accept if either matches.

Reject anything where:

- The header is missing.
- `Authn-Webhook-Timestamp` is older than 5 minutes (replay protection).
- No segment matches the expected.

## PHP

[`@authn-sh/sdk-php`](https://github.com/authn-sh/sdk-php) ships `WebhookSignatureVerifier`:

```php
use Authn\Sdk\Webhooks\WebhookSignatureVerifier;

$verifier = new WebhookSignatureVerifier($endpoint->signingSecret());

if (! $verifier->verify($request)) {
    return response()->noContent(403);
}

$event = json_decode($request->getContent(), true);
// ... handle $event['type']
```

## Node

```ts
import crypto from 'node:crypto'

export function verifyWebhook({
    secret, id, timestamp, body, signatureHeader,
}: {
    secret: string
    id: string
    timestamp: string
    body: string
    signatureHeader: string
}): boolean {
    if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false

    const signed = `${id}.${timestamp}.${body}`
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('base64')

    return signatureHeader.split(',').some((segment) => {
        const [version, sig] = segment.split(',', 2).length === 2
            ? segment.split(',', 2)
            : ['v1', segment.replace(/^v1,?/, '')]
        if (version !== 'v1' || !sig) return false
        const a = Buffer.from(sig)
        const b = Buffer.from(expected)
        return a.length === b.length && crypto.timingSafeEqual(a, b)
    })
}
```

## Go

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "strings"
)

func VerifyWebhook(secret, id, ts, body, header string) bool {
    signed := id + "." + ts + "." + body
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signed))
    expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

    for _, seg := range strings.Split(header, ",") {
        seg = strings.TrimPrefix(strings.TrimSpace(seg), "v1,")
        if hmac.Equal([]byte(seg), []byte(expected)) {
            return true
        }
    }
    return false
}
```

## Buffering the body

Most frameworks parse JSON before your handler sees it; the HMAC needs the *raw* body byte-for-byte. In Laravel, use `$request->getContent()`. In Express, register `express.raw({ type: 'application/json' })` for the webhook route. In Go's `net/http`, read `r.Body` directly before any decoding.
