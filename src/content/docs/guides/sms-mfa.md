---
title: SMS MFA
description: Use a verified phone number as a second factor — picker semantics, `default_second_factor`, and the `phone_code` Challenge flow.
---

SMS MFA layers on top of the v0.3 second-factor flow ([Second-factor sign-in](/guides/second-factor-sign-in/)) by adding `phone_code` as a strategy. When the resolved user has at least one `PhoneNumber` with `reserved_for_second_factor: true` and the environment has `multi_factor.phone_code.enabled: true`, `phone_code` shows up in `SignIn.supported_strategies` alongside `totp` and `backup_code`.

This guide assumes you've already read [Multi-factor authentication](/guides/multi-factor-authentication/) and [Second-factor sign-in](/guides/second-factor-sign-in/) — those cover the surrounding state machine. Here we focus on the SMS-specific bits: enabling the strategy, the picker semantics when both `totp` and `phone_code` are available, and how `default_second_factor` drives the SDK's preselection.

## Enabling SMS MFA

Two prerequisites:

1. **The environment opts in.** SMS MFA is off by default — operators turn it on explicitly because SMS carries real cost and SIM-swap risk:

   ```http
   PATCH /v1/instance
   Content-Type: application/json

   { "multi_factor": { "phone_code": { "enabled": true } } }
   ```

   Or **Dashboard → Configure → Security → Multi-factor authentication → Phone code**.

2. **The user reserves a phone.** Add and verify a phone number ([Phone numbers](/guides/phone-numbers/)), then flip `reserved_for_second_factor: true`:

   ```http
   PATCH /v1/me/phone-numbers/{id}
   Content-Type: application/json

   { "reserved_for_second_factor": true }
   ```

   Requires the row to already be `verified: true`. The endpoint is refused with `422` if the env has `multi_factor.phone_code.enabled: false` — the toggle protects against orphaning users on a strategy the env doesn't allow.

Once both are true, the user's next sign-in surfaces `phone_code` on `supported_strategies` after the first factor passes.

## The second-factor flow with `phone_code`

The state machine matches the v0.3 dance — `needs_second_factor` → issue Challenge → answer — with `phone_code` as a third strategy alongside `totp` and `backup_code`.

### Issuing a `phone_code` Challenge

```http
POST /v1/client/sign-ins/{sid}/challenges
Content-Type: application/json

{ "strategy": "phone_code" }
```

The server picks which phone to send the SMS to:

1. The user's `default_second_factor` phone, if any.
2. Otherwise `User.primary_phone_number_id`, if `reserved_for_second_factor: true` on that row.
3. Otherwise the lexicographically-first phone with `reserved_for_second_factor: true`.

To target a specific phone explicitly (e.g. when the user has multiple reserved numbers and your UI lets them choose):

```http
POST /v1/client/sign-ins/{sid}/challenges
Content-Type: application/json

{ "strategy": "phone_code", "phone_number_id": "phn_01HKX9SY9V7H7TF8C8K7J9X4ZA" }
```

Server validates that the supplied phone belongs to the resolved user and carries `reserved_for_second_factor: true`. If it doesn't, returns `422 phone_not_reserved_for_second_factor`.

The `Challenge` lands `pending` with `step: "second"` and `current_challenge_id` repointed on the parent `SignIn`. The SMS goes out via `Environment.sms.driver` using the `verification_code` SMS template (see [SMS templates](/reference/sms-templates/)).

### Answering

```http
POST /v1/client/sign-ins/{sid}/challenges/{cid}/answer
Content-Type: application/json

{ "code": "542178" }
```

Same shape as `totp`. On success the Challenge flips to `verified` and the SignIn advances to `complete`. Failures return `422 incorrect_code`; repeated failures flip the Challenge to `failed` — issue a fresh one to retry.

### SDK example

```tsx
import { useSignIn } from '@authn-sh/sdk-react';

function SecondFactor() {
    const { signIn } = useSignIn();
    const [strategy, setStrategy] = React.useState<'totp' | 'phone_code' | 'backup_code'>(() => {
        // Pre-select per the user's preference.
        if (signIn.defaultSecondFactorStrategy === 'phone_code') return 'phone_code';
        if (signIn.supportedStrategies.includes('totp')) return 'totp';
        return signIn.supportedStrategies[0] as never;
    });

    const submit = async (code: string) => {
        const challenge = await signIn.createSecondFactorChallenge({ strategy });
        await challenge.answer({ code });
    };

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget).get('code') as string);
        }}>
            {strategy === 'phone_code' && (
                <p>We sent a code to {signIn.defaultSecondFactorPhoneNumber}.</p>
            )}
            <input
                name="code"
                type="text"
                inputMode={strategy === 'backup_code' ? 'text' : 'numeric'}
                placeholder={strategy === 'backup_code' ? 'xxxx-xxxx' : '6-digit code'}
            />
            <button type="submit">Verify</button>

            <StrategySwitcher
                supported={signIn.supportedStrategies}
                current={strategy}
                onChange={setStrategy}
            />
        </form>
    );
}
```

The pre-built `<SignIn />` component handles all of this automatically — including the strategy switcher and the phone preview. You only need a custom form if you're rolling your own auth UI on top of `sdk-js`.

## Picker semantics — both `totp` and `phone_code` enabled

When the user has enrolled both, the SDK picks one to render first based on `User.default_second_factor` plus phone presence. The rule:

| User has `phone_code` reserved? | A phone has `default_second_factor: true`? | SDK preselects |
| ------------------------------- | ------------------------------------------ | -------------- |
| No | — | `totp` |
| Yes | No | `totp` (the v0.3 default still wins when no explicit pivot is set) |
| Yes | Yes | `phone_code` against that phone |

The user can always switch via the strategy picker (the `<SignIn />` component renders one as a "Try another way" link). The server doesn't gate the order — it just narrows `supported_strategies` to whatever's enrolled + enabled.

## Setting `default_second_factor`

Make a verified, reserved-for-MFA phone the default second factor:

```http
PATCH /v1/me/phone-numbers/{id}
Content-Type: application/json

{ "reserved_for_second_factor": true, "default_second_factor": true }
```

Patching `default_second_factor: true` requires `reserved_for_second_factor: true` (already set or flipping in the same patch). At most one phone per user carries the flag — the server enforces uniqueness, so flipping it on one phone clears it on every other.

The SDK exposes:

```tsx
await user.phoneNumbers
    .find((p) => p.phoneNumber === '+15555550100')
    .togglePhoneNumberReservedForSecondFactor();
```

That toggles `reserved_for_second_factor`. To also set `default_second_factor`, drive `update`:

```tsx
await phone.update({ defaultSecondFactor: true });
```

`update` rejects if the row isn't already reserved — the SDK validates before posting.

To clear the default (e.g. user removes the phone), patch `default_second_factor: false`. The user can still use `phone_code` as a second factor; the SDK will just preselect `totp` again.

## Why `phone_code` is off by default

SMS MFA carries two real costs the operator opts into:

1. **Carrier fees.** Every challenge consumes one SMS via Twilio / Vonage / your driver of choice. At scale this adds up — sign-in retry storms can run into the thousands of dollars.
2. **SIM-swap risk.** Phone numbers are easier to take over than authenticator-app secrets. Banks pulled SMS-MFA from their high-value flows for exactly this reason. Surface `phone_code` in environments where users explicitly want it (consumer apps, low-stakes services); prefer `totp` + backup codes for sensitive workloads.

Operators turn `multi_factor.phone_code.enabled: true` only after weighing both.

## Test mode

With `test_mode: enabled`, the magic code `424242` is always accepted on Challenges sent to numbers in the `+1 (555) 555-0100` – `+1 (555) 555-0199` range. SMS sends to those numbers are dropped with a no-op audit-log entry — no real SMS goes out, no driver fees. Use this for end-to-end tests of the second-factor flow.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ins/{sid}/challenges` | Issue a second-factor challenge — body: `{ strategy: "phone_code", phone_number_id?: "..." }`. |
| `POST` | `/v1/client/sign-ins/{sid}/challenges/{cid}/answer` | Answer with the 6-digit code. |
| `PATCH` | `/v1/me/phone-numbers/{id}` | Toggle `reserved_for_second_factor` / `default_second_factor`. |
| `PATCH` | `/v1/instance` | Operator: flip `multi_factor.phone_code.enabled`. |

## Next steps

- [Phone numbers](/guides/phone-numbers/) — adding, verifying, and primary-electing phone numbers.
- [JWT claims](/reference/jwt-claims/) — the `pnv` (phone-number-verified) and `dsf` (default-second-factor) claims a backend can consume.
- [Multi-factor authentication](/guides/multi-factor-authentication/) — the broader MFA shape, TOTP enrollment, backup codes.
