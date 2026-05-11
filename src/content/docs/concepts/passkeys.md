---
title: Passkeys
description: How authn.sh models WebAuthn credentials, the registration and sign-in ceremonies, and what self-hosters need to configure.
---

A **passkey** is a phishing-resistant credential bound to a specific origin — a private key stored on the user's device (a hardware security key, a platform authenticator like Touch ID / Windows Hello, or a cross-device synced passkey from iCloud Keychain / Google Password Manager / 1Password) and a public key registered against the user's authn.sh account. Sign-in is a challenge / response: the server sends a random nonce, the authenticator signs it with the private key, and the server verifies the signature with the public key it stored at registration time.

Passkeys are available from v0.5 of authn.sh.

## The model

A `Passkey` is one registered authenticator. A user with both a YubiKey and a MacBook Touch ID has two `Passkey` rows.

```json
{
  "id": "pkey_01HKX9SY9V7H7TF8C8K7J9X4ZA",
  "object": "passkey",
  "nickname": "YubiKey 5C",
  "transports": ["usb", "nfc"],
  "aaguid": "ee882879-721c-4913-9775-3dfcce97072a",
  "verified": true,
  "last_used_at": 1714896500000,
  "created_at": 1714723000000,
  "updated_at": 1714896500000
}
```

The raw credential ID bytes, the COSE-encoded public key, and the authenticator's signature counter never appear in any payload — those are the secret operational fields the WebAuthn server library reads directly from the database during assertion verification. They're stored encrypted at rest and exposed only inside the server.

What the SDK sees is the human-facing surface:

- `nickname` — the label the user picked. Defaults to a server-generated string at registration time if the SDK doesn't supply one; rendered in `<UserProfile />` so the user can tell their authenticators apart.
- `transports[]` — the transports the authenticator advertised at registration (`usb`, `nfc`, `ble`, `internal`, `hybrid`). Surfaced verbatim to the browser at sign-in time so the WebAuthn UI can hint the right discovery flow.
- `aaguid` — an opaque 128-bit identifier the authenticator chose to disclose, surfacing the authenticator model. `null` when the authenticator returned the zero AAGUID (the common case for platform authenticators that decline to attest a model).
- `verified` — `true` once the registration ceremony's attestation response was accepted. Unverified rows are garbage-collected if the ceremony is never completed.
- `last_used_at` — most recent successful assertion against this credential. `null` until the first successful use after registration.

The user's full passkey list also hangs off the `User` resource as `User.passkeys[]`, with a `User.passkey_count` convenience field for "does this user have *any* passkey".

## Registration (enrollment) ceremony

Registration is a two-step ceremony that mirrors the WebAuthn L3 spec. The SDK wraps both steps; if you're using `<UserProfile />` you don't have to touch any of this. If you're building a custom enrollment surface, the dance is:

### Step 1 — Begin the ceremony

Open a `Challenge` carrying the server-built `PublicKeyCredentialCreationOptions`:

```http
POST /v1/me/passkeys/begin-registration
```

The response is a `Challenge` with `creation_options` set to a `PasskeyCreationOptions` envelope. The SDK passes that envelope verbatim to `navigator.credentials.create({ publicKey })` after URL-safe base64 decoding `challenge`, `user.id`, and every `exclude_credentials[].id`.

Notable defaults:

- `rp.id` is the **effective RP ID** — the apex domain the credential will be scoped to. Matches `Environment.host` minus the `<env_slug>.` subdomain unless the operator overrode it.
- `authenticator_selection.resident_key: "preferred"` — the v0.5 default. Enables username-less sign-in when the authenticator supports a discoverable credential, and falls back gracefully when it doesn't.
- `authenticator_selection.user_verification: "preferred"` — accepts user verification (biometric / PIN) when the authenticator offers it.
- `attestation: "none"` — the server doesn't validate authenticator provenance in v0.5.
- `exclude_credentials[]` — every existing `Passkey` for this user. The authenticator refuses to enroll if any match, so the user doesn't accidentally register the same authenticator twice.

A `Passkey` row is created in the unverified state by this step.

### Step 2 — Complete the ceremony

After the browser returns from `navigator.credentials.create()`, post the attestation back keyed by the `challenge_id` from step 1:

```http
POST /v1/me/passkeys/complete-registration/{challenge_id}
Content-Type: application/json

{
  "attestation": { /* base64url-encoded WebAuthn AuthenticatorAttestationResponse */ },
  "nickname": "YubiKey 5C"        // optional; falls back to a server-generated default
}
```

The server verifies the attestation against the challenge nonce and the RP ID, flips the row to `verified: true`, and returns the full `Passkey`. The pending row is garbage-collected if step 2 never runs.

### React

```tsx
import { useUser } from '@authn.sh/sdk-react';

const { user } = useUser();

await user.createPasskey({ nickname: 'YubiKey 5C' });
```

`createPasskey()` runs both steps and either resolves with the new `Passkey` or throws with one of the `passkey_*` error codes (see below).

## Sign-in (authentication) ceremony

Sign-in reuses the standard `Challenge` envelope; passkeys are just another first-factor strategy.

```http
POST /v1/sign-ins/{sid}/challenges
Content-Type: application/json

{ "strategy": "passkey" }
```

The response carries a `Challenge` with `request_options` set to a `PasskeyRequestOptions` envelope — the spec-shaped `PublicKeyCredentialRequestOptions`. The SDK passes it to `navigator.credentials.get({ publicKey })`, then posts the assertion back:

```http
POST /v1/sign-ins/{sid}/challenges/{cid}/answer
Content-Type: application/json

{
  "assertion": { /* base64url-encoded WebAuthn AuthenticatorAssertionResponse */ }
}
```

On success the parent `SignIn` advances to `status: complete` and the session is minted. On failure the answer endpoint returns a `Challenge` with `status: failed` and an `error_code` from the catalogue below.

### React

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

const { signIn } = useSignIn();

await signIn.authenticateWithPasskey();
```

`authenticateWithPasskey()` calls `POST /sign-ins`, requests the passkey challenge, runs `navigator.credentials.get()`, posts the assertion, and resolves with the completed `SignIn` — or throws with one of the `passkey_*` errors.

## Error codes

The passkey assertion endpoint surfaces four distinct failures so the SDK can pick the right user-facing message:

| Code | When it fires |
| --- | --- |
| `passkey_no_credentials` | The user has no `Passkey` row that the requested RP ID can challenge. UI should redirect to a fallback strategy (password / email code). |
| `passkey_assertion_invalid` | Signature verification failed against the stored public key. Almost always means the user picked the wrong authenticator (or someone is trying to forge an assertion). |
| `passkey_origin_mismatch` | The assertion was created against a different origin than the one the server expects. See "RP ID + origin allowlist" below. |
| `passkey_user_handle_mismatch` | The `user.id` returned by the authenticator doesn't match any `User` in this environment. Indicates a credential from a different deployment or a stale roaming key. |

## RP ID + origin allowlist (self-hosters, read this)

WebAuthn binds every credential to a specific **RP ID** — usually the apex domain serving the FAPI. authn.sh derives RP ID from each environment's FAPI host at request time: if your FAPI lives at `acme.authn.example.com`, the RP ID defaults to `authn.example.com` and the server accepts assertions with origins matching `*.authn.example.com`.

If you self-host with a non-default DNS layout (e.g. FAPI at `auth.acme.com` but the Account Portal at `accounts.acme.com`), you need to configure the FAPI host correctly so the derived RP ID covers both origins. The chart's [`AUTHN_APP_URL`](https://github.com/authn-sh/helm) (helm) and the CDK construct's `appUrl` (cdk) drive this — set them to the **registrable apex** you want the RP ID scoped to, not the FAPI subdomain.

The `passkey_origin_mismatch` error is what you'll see at sign-in time if the derived RP ID is wrong. The fix is the FAPI host configuration; never change it on a live deployment with already-enrolled passkeys, because every existing credential will be silently locked out.

## Recovery flows

A passkey-bound user who loses every authenticator they've enrolled can't sign in with that strategy. authn.sh's recovery story:

1. **The user still has a second authenticator.** Sign in with the surviving one, delete the lost passkey from `<UserProfile />`, and enroll a fresh one. This is the encouraged path — `<UserProfile />` nudges users to enroll at least two passkeys.
2. **The user still has another first-factor strategy enabled** (password / email code / OAuth). Sign in with the fallback, then delete the lost passkey and enroll a fresh one.
3. **The user has no first-factor fallback and only one passkey.** They're locked out at the FAPI level. An operator can either re-enable a password / email-code strategy on the instance (which lets the user reset via the standard email flow) or delete the orphan `Passkey` rows via BAPI and walk the user through re-enrollment from a trusted device. For B2B deployments, lean on backup codes (the same `BackupCodeBatch` surface MFA uses) or invite-driven recovery rather than expecting the user to remember a password.

Backup codes are not currently a passkey recovery factor — they're scoped to second-factor recovery only. If you want a single-string recovery escape hatch for passkey users, enable email codes alongside the passkey strategy so a `signIn.start.email_code` flow can mint a fresh session for re-enrollment.
