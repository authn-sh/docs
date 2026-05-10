---
title: Second-factor sign-in
description: Handle the needs_second_factor step in your sign-in flow — TOTP and backup code challenges.
---

When a user with MFA enrolled completes their first factor, authn.sh advances the `SignIn` to `needs_second_factor` instead of completing the session. Your UI must issue a second-factor `Challenge` and answer it before the session activates.

## What `needs_second_factor` looks like

A `SignIn` in this state has:

- `status: "needs_second_factor"` — the session is not yet active.
- `supported_strategies[]` — the strategies the user can use for this sign-in, narrowed to factors they have enrolled **and** that are enabled on the environment. Possible values: `"totp"`, `"backup_code"`.

```json
{
  "object": "sign_in",
  "status": "needs_second_factor",
  "supported_strategies": ["totp", "backup_code"],
  "current_challenge_id": null
}
```

The user sees this state after a successful password entry, email code, or magic-link click — whichever first factor they used.

## Issuing a second-factor Challenge

Call `POST /v1/client/sign-ins/{sid}/challenges` with the strategy the user chose. The server sets `step: "second"` on the resulting `Challenge`.

```http
POST /v1/client/sign-ins/{sid}/challenges
Content-Type: application/json

{ "strategy": "totp" }
```

Or for backup codes:

```http
POST /v1/client/sign-ins/{sid}/challenges
Content-Type: application/json

{ "strategy": "backup_code" }
```

The server validates that the chosen strategy appears in `SignIn.supported_strategies`. If it doesn't — for example because the user hasn't enrolled TOTP — the response is `422`.

## Answering the Challenge

For both `totp` and `backup_code`, submit `{ "code": "…" }` to the answer endpoint:

```http
POST /v1/client/sign-ins/{sid}/challenges/{cid}/answer
Content-Type: application/json

{ "code": "542178" }
```

For backup codes, use the `xxxx-xxxx` format (8 lowercase [Crockford base32](https://www.crockford.com/base32.html) characters, hyphen at midpoint):

```http
POST /v1/client/sign-ins/{sid}/challenges/{cid}/answer
Content-Type: application/json

{ "code": "abcd-efgh" }
```

On success the `SignIn` advances to `complete` and the `Client` has an active session. On a wrong code, the challenge returns `422` with `error_code: incorrect_code`. Excessive incorrect attempts flip the challenge to `status: failed` — issue a new challenge to retry.

## SDK example

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

function SecondFactor() {
    const { signIn } = useSignIn();
    const [strategy, setStrategy] = React.useState<'totp' | 'backup_code'>('totp');

    const submit = async (code: string) => {
        const challenge = await signIn.createSecondFactorChallenge({ strategy });
        await challenge.answer({ code });
    };

    const canUseBackupCode = signIn.supportedStrategies.includes('backup_code');

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget).get('code') as string);
        }}>
            {strategy === 'totp' ? (
                <input name="code" type="text" inputMode="numeric" placeholder="6-digit code" />
            ) : (
                <input name="code" type="text" placeholder="xxxx-xxxx" />
            )}
            <button type="submit">Verify</button>
            {canUseBackupCode && strategy === 'totp' && (
                <button type="button" onClick={() => setStrategy('backup_code')}>
                    Use a backup code instead
                </button>
            )}
        </form>
    );
}
```

The `<SignIn />` component handles this step automatically — no custom code needed if you're using the built-in form.

## `supported_strategies` narrowing

`SignIn.supported_strategies` reflects the intersection of:

1. **What the user has enrolled** — `totp` appears only if `User.totp_enabled` is `true`; `backup_code` appears only if `User.backup_code_enabled` is `true`.
2. **What the environment permits** — strategies disabled via `InstanceSettings.multi_factor` are excluded even if the user has stale enrollment rows for them.

Always read `supported_strategies` from the live `SignIn` rather than assuming which factors are available. A user who enrolled TOTP before an operator toggled it off will see `supported_strategies: ["backup_code"]` if backup codes are still on.

## Backup code format

Backup codes are 8 Crockford base32 characters, lowercase, with a hyphen at the midpoint: `xxxx-xxxx`. The code field accepts the hyphenated form — strip whitespace on the client before submitting.

Each code is single-use. Once consumed, it's marked spent and will return `incorrect_code` on subsequent attempts. When the user runs low (or has lost them), direct them to the [backup codes regeneration flow](/guides/multi-factor-authentication/#backup-codes).

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ins/{sid}/challenges` | Issue a second-factor challenge — body: `{ strategy: "totp" \| "backup_code" }`. |
| `POST` | `/v1/client/sign-ins/{sid}/challenges/{cid}/answer` | Answer the challenge — body: `{ code: "…" }`. |
| `GET` | `/v1/client/sign-ins/{sid}/challenges/{cid}` | Fetch the current challenge status. |
