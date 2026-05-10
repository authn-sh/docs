---
title: Phone numbers
description: Add, verify, primary-elect, and reserve-for-MFA phone numbers on a User.
---

A `PhoneNumber` is a phone identifier owned by a `User`. Users can have many phone numbers; exactly one is the primary (referenced by `User.primary_phone_number_id`). Numbers are stored in **E.164** form — leading `+`, country-code digits, subscriber digits, no separators.

This guide covers the user-facing operations: add, verify, promote-to-primary, and reserve-for-MFA. For the second-factor sign-in flow that **uses** a reserved number, see [SMS MFA](/guides/sms-mfa/).

## Enabling phone numbers on the environment

Phone numbers are off by default. Flip them on at the environment level:

| `attribute_settings.phone_number` | Effect |
| --------------------------------- | ------ |
| `off` (default) | Phone field hidden everywhere — sign-up, `<UserProfile />`, the SDK. `phone_code` strategy rejected. |
| `optional` | Field rendered but skippable on sign-up; users can add a phone after the fact via `<UserProfile />`. |
| `required` | Sign-up cannot complete without a verified phone. |

Toggle via **Dashboard → Configure → Authentication → User attributes → Phone number** or via BAPI:

```http
PATCH /v1/instance
Content-Type: application/json

{
  "attribute_settings": {
    "phone_number": { "enabled": true, "required": false, "verify": true }
  }
}
```

The SDK reads this from `Environment.auth_config.identifier_requirements.phone_number` and conditionally renders the phone-number field in `<SignUp />`, `<UserProfile />`, and `<PhoneNumberField />`.

## Adding a phone number programmatically

```tsx
import { useUser } from '@authn-sh/sdk-react';

function AddPhone() {
    const { user } = useUser();

    const add = async (input: string) => {
        const phone = await user.createPhoneNumber({ phoneNumber: input });
        await phone.prepareVerification();
    };

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            add(new FormData(e.currentTarget).get('phone') as string);
        }}>
            <input name="phone" type="tel" placeholder="+1 (555) 555-0100" />
            <button type="submit">Add</button>
        </form>
    );
}
```

`createPhoneNumber` POSTs to `/v1/me/phone-numbers` and returns the new row in `verified: false` state. The submitted value is normalised server-side — accept any input the underlying parser handles (`(555) 555-0100`, `+55 11 99999-0100`, …); the stored `phone_number` is always E.164.

`prepareVerification` issues a `phone_code` `Challenge` against `/v1/me/phone-numbers/{id}/challenges`, which sends an SMS via the env's configured driver (see [SMS drivers](/reference/sms-drivers/)).

## Verifying a phone number

The Challenge dance is the same as for email codes — see [Verifying additional emails](/guides/magic-link/#verifying-additional-emails) for the parent shape. For phone-code:

```http
POST /v1/me/phone-numbers/{id}/challenges
Content-Type: application/json

{ "strategy": "phone_code" }
```

Returns a `Challenge` in `pending` status. Answer it with the 6-digit code from the SMS:

```http
POST /v1/me/phone-numbers/{id}/challenges/{cid}/answer
Content-Type: application/json

{ "code": "542178" }
```

On success the `Challenge` flips to `verified`, `PhoneNumber.verified` flips to `true`, and `current_challenge_id` clears. Failures return `422 incorrect_code`; repeated failures trigger the standard brute-force lockout.

In the SDK:

```tsx
import { useUser } from '@authn-sh/sdk-react';

function VerifyPhone({ phoneNumberId }: { phoneNumberId: string }) {
    const { user } = useUser();
    const phone = user.phoneNumbers.find((p) => p.id === phoneNumberId);

    const verify = async (code: string) => {
        await phone!.attemptVerification({ code });
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            onBlur={(e) => verify(e.target.value)}
        />
    );
}
```

The pre-built [`<PhoneNumberField />`](/reference/connected-accounts/#phonenumberfield) component handles add + verify in a single drop-in.

## Promoting to primary

`User.primary_phone_number_id` points to the user's primary phone — the one your app should display, the one the resolver targets first for SMS MFA when no other override exists.

```http
PATCH /v1/me/phone-numbers/{id}
Content-Type: application/json

{ "is_primary": true }
```

Requires the row to be `verified: true`. Flipping `is_primary: true` on one row automatically flips every other row's `is_primary` to `false` — exactly one row per user can hold the flag.

```tsx
await phone.makePrimary();
```

## Reserving a phone for MFA

`reserved_for_second_factor: true` commits the phone to second-factor SMS MFA. Once reserved:

- `DELETE /v1/me/phone-numbers/{id}` is refused with `409 phone_reserved_for_second_factor` until you flip the flag back.
- `phone_code` becomes available as a second-factor strategy on the user's `SignIn.supported_strategies` (assuming the env has `multi_factor.phone_code.enabled: true`).

```http
PATCH /v1/me/phone-numbers/{id}
Content-Type: application/json

{ "reserved_for_second_factor": true }
```

Requires `verified: true` **and** `multi_factor.phone_code.enabled` on the environment. The SDK exposes:

```tsx
await phone.togglePhoneNumberReservedForSecondFactor();
```

Toggling reserves the row when `false`, releases it when `true`.

To **release** the reservation (so the user can delete the row), patch:

```http
PATCH /v1/me/phone-numbers/{id}
Content-Type: application/json

{ "reserved_for_second_factor": false, "default_second_factor": false }
```

Or use the operator-driven `DELETE /v1/users/{id}/mfa` BAPI route to nuke MFA wholesale (see [Multi-factor authentication](/guides/multi-factor-authentication/#operator-overrides-bapi)).

## Default-second-factor handling

When the user has both `phone_code` and `totp` enrolled, the SDK needs to pick which one to surface first on `needs_second_factor`. The pivot is `PhoneNumber.default_second_factor`:

| `default_second_factor` | SDK behavior on `needs_second_factor` |
| ----------------------- | ------------------------------------- |
| `true` on a phone | SDK pre-selects `phone_code` against this phone, falls back to `totp`. |
| `false` on every phone | SDK pre-selects `totp` (the v0.3 default), with `phone_code` as an alternative if any phone is reserved. |

At most one phone per user can carry `default_second_factor: true`. The server enforces uniqueness — flipping it on one row automatically clears it on every other row of that user.

```http
PATCH /v1/me/phone-numbers/{id}
Content-Type: application/json

{ "reserved_for_second_factor": true, "default_second_factor": true }
```

`default_second_factor: true` requires `reserved_for_second_factor: true` (either already set or flipping in the same patch). Setting both in one request is the normal "make this my default MFA channel" path.

## Removing a phone number

```http
DELETE /v1/me/phone-numbers/{id}
```

Detaches the row. The user must keep at least one identifier (email or phone); deleting the last identifier returns `422`. Refused with `409 phone_reserved_for_second_factor` while `reserved_for_second_factor: true` — release the reservation first.

In the SDK:

```tsx
await phone.destroy();
```

## Test phone numbers

The reserved range `+1 (555) 555-0100` through `+1 (555) 555-0199` is **always** test numbers. When `InstanceSettings.test_mode: enabled`:

- SMS sends to numbers in this range are no-op'd (no real SMS goes out).
- The magic verification code `424242` is always accepted on those numbers.

This makes seed scripts and end-to-end tests run cleanly without consuming SMS credit. With `test_mode: disabled`, the range still no-ops sends but doesn't accept the magic code — and with `test_mode: rejected`, sign-ups against the range are refused outright (production hardening).

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me/phone-numbers` | List the signed-in user's phone numbers. |
| `POST` | `/v1/me/phone-numbers` | Add a new phone number (always created unverified). |
| `GET` | `/v1/me/phone-numbers/{id}` | Fetch one phone number. |
| `PATCH` | `/v1/me/phone-numbers/{id}` | Toggle `is_primary`, `reserved_for_second_factor`, `default_second_factor`. |
| `DELETE` | `/v1/me/phone-numbers/{id}` | Remove a phone number. |
| `POST` | `/v1/me/phone-numbers/{id}/challenges` | Issue a `phone_code` verification Challenge. |
| `POST` | `/v1/me/phone-numbers/{id}/challenges/{cid}/answer` | Answer with the 6-digit code. |
| `GET` | `/v1/me/phone-numbers/{id}/challenges/{cid}` | Poll Challenge status. |

## Next steps

- [SMS MFA](/guides/sms-mfa/) — second-factor sign-in flow that consumes a `reserved_for_second_factor` phone.
- [Connected-accounts components](/reference/connected-accounts/) — the `<PhoneNumberField />` drop-in.
- [SMS templates](/reference/sms-templates/) — customize the `verification_code` SMS body.
