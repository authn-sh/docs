---
title: Multi-factor authentication
description: Enable TOTP and backup codes for your users — enrollment, management, and operator controls.
---

Multi-factor authentication (MFA) adds a second proof of identity to sign-in. authn.sh supports two second factors: **TOTP** (time-based one-time passwords, via any authenticator app) and **backup codes** (single-use recovery codes).

Both factors are enabled by default. Toggle them per-environment under **Dashboard → Configure → Security → Multi-factor authentication**, or via the BAPI `PATCH /v1/instance` body's `multi_factor` block.

## When to require MFA

MFA makes the most sense for:

- Applications with sensitive data or elevated-privilege accounts.
- B2B products where a customer's security policy mandates it.
- Environments where phishing a password is a realistic threat.

MFA is opt-in per user by default. If your product requires it for all users, gate access in your backend after verifying the JWT — check `two_factor_enabled` on the `User` claim — and redirect users without a second factor to the enrollment surface before letting them in.

## TOTP enrollment

Enrollment is a three-step dance: mint a secret, let the user scan the QR code and add it to their authenticator app, then confirm with the first generated code.

### Step 1 — Start enrollment

```http
POST /v1/me/totp
```

Returns a `TotpSecret` with `secret` (base32), `otpauth_uri`, and `qr_code_data_url`. These fields are only returned here — once verified, the server clears them and they can never be retrieved again.

If the user already has an **unverified** TOTP secret (started enrollment but never confirmed), calling this endpoint again overwrites the row with a fresh secret. If they already have a **verified** TOTP secret, the endpoint returns `409` — they must call `DELETE /v1/me/totp` before re-enrolling.

### Step 2 — User scans the QR code

Show the `qr_code_data_url` as an `<img>` or let the user copy the `otpauth_uri` into their authenticator app. Both are generated server-side so you don't need a QR library.

### Step 3 — Verify with the first code

```http
POST /v1/me/totp/verify
Content-Type: application/json

{ "code": "542178" }
```

The server checks the submitted 6-digit code against the stored secret with a ±1 step (30 s) tolerance. On success:

- `TotpSecret.verified_at` is stamped.
- `User.totp_enabled` flips to `true`.
- If this is the user's first second factor, `User.two_factor_enabled` flips to `true` and `User.mfa_enabled_at` is stamped.

An incorrect code returns `422` with `error_code: incorrect_code`. Repeated failures trigger the standard brute-force lockout.

> **Note** — TOTP enrollment verify is a direct call, not a `Challenge`. The Challenge model is used only for sign-in second-factor proofs (see [Second-factor sign-in](/guides/second-factor-sign-in/)).

### SDK example

```tsx
import { useUser } from '@authn.sh/sdk-react';

function TotpEnroll() {
    const { user } = useUser();
    const [secret, setSecret] = React.useState(null);

    const start = async () => {
        const totp = await user.createTotp();
        setSecret(totp);
    };

    const verify = async (code: string) => {
        await user.verifyTotp({ code });
    };

    if (!secret) {
        return <button onClick={start}>Enable authenticator app</button>;
    }

    return (
        <>
            <img src={secret.qrCodeDataUrl} alt="Scan in your authenticator app" />
            <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                onBlur={(e) => verify(e.target.value)}
            />
        </>
    );
}
```

The SDK also ships a pre-built `<TotpEnrollDialog />` component — see [Security section components](/reference/security-components/).

## Backup codes

Backup codes are single-use recovery codes the user stores somewhere safe. They let users bypass TOTP if they lose access to their authenticator app.

### Generating codes

```http
POST /v1/me/backup-codes
```

Returns a `BackupCodeBatch` with a plaintext `codes[]` array. **This is the only time the codes are returned in plaintext.** The server stores hashes (Argon2id) and discards the plaintext after the response is sent. Instruct users to save the codes now — they cannot be retrieved later.

The default batch size is 10 (configurable in `InstanceSettings.multi_factor.backup_codes.default_count`, range 4–24).

### Regenerating codes

Calling `POST /v1/me/backup-codes` again **replaces** the entire prior batch. Every previously-issued code stops working immediately, even codes that were never consumed. Always regenerate when the user reports their codes are lost, not when individual codes run out.

### Removing backup codes

```http
DELETE /v1/me/backup-codes
```

Deletes every unused backup code and flips `User.backup_code_enabled` to `false`. If no other second factor remains, `User.two_factor_enabled` also flips to `false`. This call is idempotent — it succeeds even if the user had no codes.

## Removing TOTP

```http
DELETE /v1/me/totp
```

Deletes the user's TOTP secret and flips `User.totp_enabled` to `false`. Backup codes are left intact — call `DELETE /v1/me/backup-codes` separately if you want to fully disable MFA. The Account Portal's "fully disable MFA" flow calls both endpoints sequentially.

Returns `404` if the user has no enrolled TOTP secret.

## Operator overrides (BAPI)

### Verify a TOTP code server-side

```http
POST /v1/users/{user_id}/verify-totp
Content-Type: application/json

{ "code": "542178" }
```

Returns `{ "verified": true }` or `{ "verified": false }`. Use this to gate sensitive server-side actions on a fresh second-factor proof without routing the user through the FAPI sign-in flow. Repeated mismatches return `429`.

This endpoint does **not** affect `TotpSecret.verified_at` — it's a verification check, not enrollment confirmation.

### Reset a user's MFA entirely

```http
DELETE /v1/users/{user_id}/mfa
```

Deletes the user's TOTP secret and every unconsumed backup code. Flips all MFA flags to `false` and stamps `User.mfa_disabled_at`. Use this for support recovery when a user has lost both their authenticator and their backup codes.

The call is idempotent — calling it on a user with no MFA enrollment returns the user unchanged.

## Instance settings

| Field | Default | Description |
| ----- | ------- | ----------- |
| `multi_factor.totp.enabled` | `true` | When `false`, new TOTP enrollments are refused and `totp` is excluded from `SignIn.supported_strategies`. |
| `multi_factor.backup_codes.enabled` | `true` | When `false`, backup code generation is refused and `backup_code` is excluded from `supported_strategies`. |
| `multi_factor.backup_codes.default_count` | `10` | Number of codes minted per `POST /v1/me/backup-codes`. Bounds: 4–24. |

Disabling a strategy removes it from future sign-in flows. Stale enrollment rows survive the toggle but cannot be used to complete sign-in while the strategy is off.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/me/totp` | Start TOTP enrollment — returns QR code + secret (one-time). |
| `POST` | `/v1/me/totp/verify` | Confirm enrollment with the first generated code. |
| `DELETE` | `/v1/me/totp` | Remove TOTP from the signed-in user's account. |
| `POST` | `/v1/me/backup-codes` | (Re)generate backup codes — plaintext returned once. |
| `DELETE` | `/v1/me/backup-codes` | Remove all backup codes from the signed-in user's account. |
| `POST` | `/v1/users/{id}/verify-totp` | BAPI: verify a user's TOTP code without a sign-in flow. |
| `DELETE` | `/v1/users/{id}/mfa` | BAPI: reset all MFA factors for a user (operator override). |
