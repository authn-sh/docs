---
title: SMS drivers
description: Configure Twilio, Vonage, or the null driver for outbound SMS.
---

`Environment.sms.driver` decides who actually sends SMS messages. authn.sh ships three drivers in v0.4: **Twilio**, **Vonage**, and a **null** driver for development. Drivers are configured at the environment level via `PATCH /v1/instance` (or **Dashboard → Configure → Messaging → SMS**); credentials are write-only — they're accepted on PATCH, encrypted at rest, and never returned by any GET (BAPI or FAPI).

## Driver matrix

| `driver` | When to use it | Required credentials | Optional credentials |
| -------- | --------------- | --------------------- | -------------------- |
| `null` | Dev environments where you don't want real SMS sends. Sends are dropped with a no-op audit-log entry. | — | — |
| `twilio` | Production. Default choice for US + EU coverage. | `twilio.account_sid`, `twilio.auth_token` | `twilio.messaging_service_sid` |
| `vonage` | Production. Often better rates outside US / EU; supports more numbering ranges. | `vonage.api_key`, `vonage.api_secret` | — |

`from_number` is required for `twilio` (unless `messaging_service_sid` is set) and `vonage` — it's the E.164 number / short code messages send from. Per-template overrides via `SmsTemplate.from_number_override` (see [SMS templates](/reference/sms-templates/)) take precedence at send time.

## Configuration via env vars

The dashboard wizard writes to `InstanceSettings.sms.*` directly, so most operators never touch env vars. For self-host deployments that bootstrap state from infrastructure-as-code, the matrix is:

| Setting | Env var bootstrap key | Required for |
| ------- | --------------------- | ------------ |
| `sms.driver` | `AUTHN_SMS_DRIVER` | always (defaults to `null`) |
| `sms.from_number` | `AUTHN_SMS_FROM_NUMBER` | `twilio` (when no MSID), `vonage` |
| `sms.twilio.account_sid` | `AUTHN_SMS_TWILIO_ACCOUNT_SID` | `twilio` |
| `sms.twilio.auth_token` | `AUTHN_SMS_TWILIO_AUTH_TOKEN` | `twilio` |
| `sms.twilio.messaging_service_sid` | `AUTHN_SMS_TWILIO_MESSAGING_SERVICE_SID` | optional |
| `sms.vonage.api_key` | `AUTHN_SMS_VONAGE_API_KEY` | `vonage` |
| `sms.vonage.api_secret` | `AUTHN_SMS_VONAGE_API_SECRET` | `vonage` |

The bootstrap pipeline reads these on first deploy and seeds `InstanceSettings.sms.*`. After bootstrap, all edits go through the BAPI / Dashboard — env-var changes are not re-read.

## Twilio

Set up a Twilio account, provision a number (or a Messaging Service for higher throughput), and copy the credentials into the dashboard.

```http
PATCH /v1/instance
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "sms": {
    "driver": "twilio",
    "from_number": "+15555550100",
    "twilio": {
      "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "auth_token": "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
    }
  }
}
```

`auth_token` is write-only — `GET /v1/instance` returns the `twilio` block with `auth_token` redacted. Send `null` to clear:

```http
PATCH /v1/instance
Content-Type: application/json

{ "sms": { "twilio": { "auth_token": null } } }
```

### Messaging Service vs single from-number

Twilio Messaging Services pool multiple numbers / short codes to handle higher throughput, automatic failover, and country-specific routing. Set `twilio.messaging_service_sid` (`MGxxxx…`); when present, the driver passes it on send and Twilio picks the right number. `from_number` is ignored in this mode (per-template `from_number_override` is also ignored).

```http
PATCH /v1/instance
Content-Type: application/json

{
  "sms": {
    "driver": "twilio",
    "twilio": {
      "messaging_service_sid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

### Carrier-side delivery callbacks

The driver registers a webhook with Twilio for delivery / failure callbacks. authn.sh emits `sms.delivered` / `sms.failed` events when those land — see [Webhooks](/concepts/webhooks/) for the envelope.

## Vonage

```http
PATCH /v1/instance
Content-Type: application/json

{
  "sms": {
    "driver": "vonage",
    "from_number": "+447700900100",
    "vonage": {
      "api_key": "abcd1234",
      "api_secret": "efgh5678"
    }
  }
}
```

Same credential semantics as Twilio: `api_secret` is write-only; send `null` to clear.

Vonage's API rejects sender IDs containing spaces or non-ASCII characters in some regions; if a send fails with a Vonage-side rejection, surface the error from the `sms.failed` webhook.

## The `null` driver

`driver: null` (or omitted) drops every send with a no-op audit-log entry. Useful for:

- **Local dev.** No carrier credentials needed. The `verification_code` SMS body is logged at `info` level and audit-log; combine with `test_mode: enabled` so the `424242` magic code accepts every Challenge against the reserved test-number range.
- **CI.** Tests assert on the audit-log entry without consuming SMS credit.
- **Staging environments where SMS is intentionally off.**

Switching to `null`:

```http
PATCH /v1/instance
Content-Type: application/json

{ "sms": { "driver": null } }
```

The `null` driver still respects `delivered_by_us: false` on a template — the `sms.queued` webhook fires regardless, so operator-handled delivery still works in dev.

## Test-number range

The reserved range `+1 (555) 555-0100` through `+1 (555) 555-0199` is **always** treated as test numbers, regardless of which driver is configured:

- Sends to those numbers are no-op'd at the engine — no real SMS hits the driver, no carrier fees.
- `test_mode: enabled` — the magic code `424242` is always accepted as the verification answer on Challenges issued for those numbers.
- `test_mode: disabled` — sends still no-op, but the magic code isn't accepted (Challenges run normally; users won't receive real codes, so verification fails).
- `test_mode: rejected` — sign-ups using a number from this range are refused outright (production hardening).

The `sms.queued` audit-log entry still fires for the test range so end-to-end tests can assert on the engine path.

## FAPI exposure

The FAPI bootstrap (`GET /v1/environment`) exposes only `driver` + `from_number` from the `sms` block — every credential field is stripped. The SDK uses these to render UI affordances (e.g. show the phone-MFA toggle only when a driver is configured); credentials never leak to a browser.

## Driver health

The [SMS template revert](/reference/sms-templates/) endpoint and `delivered_by_us: false` flow give operators ways to recover from driver issues without flipping the env-wide driver:

- **Driver outage** (Twilio / Vonage degraded): flip `multi_factor.phone_code.enabled: false` in `InstanceSettings.multi_factor` to stop new MFA enrollments while the carrier is down. Existing reservations survive.
- **Carrier rejected the body** (regulatory / regional): `PATCH` the `verification_code` template body to a carrier-compliant variant.
- **Per-region rate-limiting**: switch to `delivered_by_us: false` for the affected slug and route through your own aggregator via the `sms.queued` webhook.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/instance` | Read `InstanceSettings.sms` (credentials redacted). |
| `PATCH` | `/v1/instance` | Update `sms.driver`, `sms.from_number`, `sms.twilio.*`, `sms.vonage.*`. Credentials are write-only. |
| `GET` | `/v1/environment` (FAPI) | Read the public bootstrap — only `driver` + `from_number`, no credentials. |
