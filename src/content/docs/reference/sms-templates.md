---
title: SMS templates
description: Edit the body, sender number, and delivery mode of authn.sh's outbound SMS messages.
---

Each environment is seeded with one `SmsTemplate` row per slug on creation. There are exactly three slugs — operators don't add their own. Edit the `body`, flip `delivered_by_us`, or set a per-template `from_number_override` via `PATCH /v1/sms-templates/{slug}`. Revert to the platform default with `POST /v1/sms-templates/{slug}/revert`.

For driver and credential configuration, see [SMS drivers](/reference/sms-drivers/).

## The three slugs

| Slug | Used by | Default `delivered_by_us` |
| ---- | ------- | ------------------------- |
| `verification_code` | First-factor sign-up phone verification, standalone `PhoneNumber` verification, second-factor SMS MFA. The `phone_code` strategy renders this template. | `true` |
| `reset_password_code` | SMS variant of the password-reset flow (when the env's `reset_password` strategy is configured to use SMS rather than email). Reserved for v0.5; the row exists in v0.4 so operators can prep their copy. | `true` |
| `invitation` | Operator-driven invitation SMS. Mirrors `Invitation` (v0.1) but for phone-based invites. Reserved for v0.5. | `true` |

`slug` is immutable — to change copy, `PATCH` the body in place. To restore the seeded default, call the revert endpoint.

## Editing the body

The `body` is a Liquid-style template with `{{placeholder}}` interpolation:

```http
PATCH /v1/sms-templates/verification_code
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "body": "Your {{app.name}} login code is {{otp_code}}. Valid for {{ttl_minutes}} minutes."
}
```

Standard placeholders:

| Placeholder | Available on | Resolves to |
| ----------- | ------------ | ----------- |
| `{{otp_code}}` | `verification_code`, `reset_password_code` | The 6-digit numeric code. |
| `{{app.name}}` | every slug | `Environment.display_config.application_name`. |
| `{{app.url}}` | every slug | `Environment.display_config.home_url`. |
| `{{user.first_name}}` / `{{user.last_name}}` | every slug | When the message has a known recipient. |
| `{{ttl_minutes}}` | `verification_code`, `reset_password_code` | How long the code remains valid. Currently fixed at 10 minutes for `verification_code`. |

Unknown placeholders render as the empty string — no errors, no partial sends.

### Body length

`body` accepts up to 1600 characters — the multi-segment SMS upper bound. Messages over 160 chars auto-split into multiple segments at the carrier; you'll see one billing event per segment. Keep `verification_code` bodies short for cost reasons; verbose bodies are fine for `invitation` where users are reading once and not under time pressure.

### Defaults

The platform-shipped defaults:

| Slug | Default body |
| ---- | ------------ |
| `verification_code` | `Your {{app.name}} verification code is {{otp_code}}. It expires in {{ttl_minutes}} minutes.` |
| `reset_password_code` | `Your {{app.name}} password reset code is {{otp_code}}. It expires in {{ttl_minutes}} minutes. If you didn't request this, ignore this message.` |
| `invitation` | `{{user.first_name}}, you've been invited to {{app.name}}. Tap to join: {{app.url}}/accept-invite` |

Call `POST /v1/sms-templates/{slug}/revert` to reset `body`, `delivered_by_us`, and `from_number_override` to these defaults.

## `delivered_by_us`

When `true` (the default), authn.sh's SMS engine sends the message via `Environment.sms.driver`. When `false`, the engine emits an `sms.queued` audit-log entry and a webhook event but **does not call any driver** — the operator's webhook handler is expected to take over and send the SMS through their own carrier relationship.

This is the escape hatch for operators who:

- Already have a carrier contract with better rates than Twilio / Vonage.
- Need to send through a region-specific aggregator (LATAM, APAC operators) that authn.sh doesn't ship a driver for.
- Want full control over the rendered body — e.g. injecting carrier-specific encoding hints or sender-ID metadata.

Flip it via PATCH:

```http
PATCH /v1/sms-templates/verification_code
Content-Type: application/json

{ "delivered_by_us": false }
```

The webhook payload your handler receives:

```json
{
  "type": "sms.queued",
  "data": {
    "template_slug": "verification_code",
    "to": "+15555550100",
    "body": "Your Acme verification code is 542178. It expires in 10 minutes.",
    "from_number_override": null,
    "metadata": { "user_id": "user_…", "challenge_id": "chal_…" }
  }
}
```

Your handler must send the SMS within the Challenge's TTL (10 minutes for `verification_code`); otherwise the user retries and the Challenge is reissued.

## `from_number_override`

Per-template override of `Environment.sms.from_number`. Useful when:

- `verification_code` should send from a branded short code (`+1 88 555 0100`) while `invitation` uses a long-form number to avoid the short-code-restrictions some carriers apply to non-OTP traffic.
- You're testing a new sender number before promoting it to env-wide default.

```http
PATCH /v1/sms-templates/verification_code
Content-Type: application/json

{ "from_number_override": "+15555550100" }
```

Send `null` to clear the override and fall through to `Environment.sms.from_number`. Must be E.164; the regex is enforced server-side.

## Reverting

```http
POST /v1/sms-templates/verification_code/revert
Authorization: Bearer sk_live_…
```

Resets `body`, `delivered_by_us`, and `from_number_override` to the platform defaults. Useful when an operator has experimented with custom copy and wants to undo without retyping the original.

The slug itself doesn't change. The row keeps its `id` and `created_at`; only `updated_at` advances.

## Test-mode behavior

With `InstanceSettings.test_mode: enabled`, SMS sends to numbers in the reserved `+1 (555) 555-0100` – `+1 (555) 555-0199` range are no-op'd at the engine. The `sms.queued` audit-log entry still fires (so end-to-end tests can assert on it), but no real SMS hits a driver — perfect for CI.

The magic code `424242` is always accepted as the answer on Challenges issued for those numbers, regardless of the `verification_code` template's body.

## Webhook events

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `sms.queued` | `{ template_slug, to, body, from_number_override, metadata }` | Every send, regardless of `delivered_by_us`. Operators consuming `delivered_by_us: false` listen for this to take over delivery. |
| `sms.delivered` | `{ message_sid, delivered_at }` | Driver reports successful carrier acceptance. Twilio + Vonage drivers register webhook callbacks with the carrier to surface this. |
| `sms.failed` | `{ message_sid, error_code, error_message, failed_at }` | Driver reports carrier-side failure (invalid number, blocked region, etc.). |

`message_sid` is the carrier-supplied identifier when `delivered_by_us: true`; null when the operator handled delivery (the operator owns their own send-id space).

See [Webhooks](/concepts/webhooks/) for the envelope shape and verification.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/sms-templates` | List all three rows for the environment, in slug order. |
| `GET` | `/v1/sms-templates/{slug}` | Fetch one row. |
| `PATCH` | `/v1/sms-templates/{slug}` | Patch any of `body`, `delivered_by_us`, `from_number_override`. |
| `POST` | `/v1/sms-templates/{slug}/revert` | Reset to platform defaults. |
