---
title: Webhooks
description: Endpoint setup, retries, signature scheme.
---

authn.sh emits webhooks for the lifecycle events your backend needs to react to (a user signing up, a session ending, an email being verified). Endpoints are configured per environment from the Dashboard.

## Setup

In the Dashboard, **Webhooks → Add endpoint**. You give:

- The receiving URL (HTTPS in production, HTTP allowed in local).
- The events to subscribe to. The default is `*` (everything).

The Dashboard returns a signing secret once on creation. Store it on your backend; we hash it at rest.

## Delivery

Each event fires a `POST <url>` with a JSON body:

```json
{
  "object": "event",
  "id": "evt_01K…",
  "type": "user.created",
  "occurred_at": 1733428800000,
  "environment_id": "env_01K…",
  "data": {
    "user": { "object": "user", "id": "user_01K…", "first_name": "Jane", ... }
  }
}
```

Headers worth caring about:

| Header | Notes |
| ------ | ----- |
| `Authn-Signature` | One or more `v1,<base64-hmac>` segments separated by `,`. |
| `Authn-Webhook-Id` | The delivery ID. Idempotent retries reuse this. |
| `Authn-Webhook-Timestamp` | Unix-ms timestamp signed into the body. Reject if older than 5 minutes. |
| `Authn-Event-Type` | Convenience copy of `data.type`. |

## Retries

Failed deliveries (anything that doesn't return 2xx within 30s) retry with exponential backoff: 1m, 5m, 30m, 1h, 6h, 12h, then a final attempt at 24h. After the last attempt, the delivery is marked `failed` and visible in the Dashboard's Webhooks → Deliveries table.

## Signature scheme

The signature is `HMAC-SHA256(secret, "<id>.<timestamp>.<body>")`, base64-encoded:

```
signed_payload = $webhook_id . "." . $webhook_timestamp . "." . $raw_body
signature      = base64(hmac_sha256($secret, $signed_payload))
header         = "v1,$signature"
```

During a rotation window, two `v1,...` segments are sent — verify against either. See [verify webhook signatures](/guides/verify-webhooks/) for code.

## Event types (v0.1)

```
user.created
user.updated
user.deleted
email_address.verified
session.created
session.ended
sign_in.failed
sign_up.completed
```

More land per milestone; the live list is published via `GET /v1/event_types` against the BAPI.
