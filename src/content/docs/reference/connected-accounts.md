---
title: Connected-accounts components
description: Pre-built React components for social sign-in buttons, phone numbers, and connected-accounts management.
---

The `@authn-sh/sdk-react` package ships three connected-accounts components in v0.4: `<SocialButtons />`, `<PhoneNumberField />`, and `<ConnectedAccountsPanel />`. They're rendered as inline panels (not modal dialogs like the v0.3 security components) and handle the round-trips to the FAPI internally.

These components require `<AuthnProvider>` in the tree.

## `<SocialButtons />`

Renders a button per enabled `OauthProvider` row. Drives the OAuth first-factor flow on click — top-level browser navigation to the IdP, server-side callback handling at `/v1/oauth-callback/{provider_key}`, then redirect to `redirectUrlComplete`.

```tsx
import { SocialButtons } from '@authn-sh/sdk-react';

<SocialButtons
    redirectUrl={`${window.location.origin}/sso-callback`}
    redirectUrlComplete={`${window.location.origin}/dashboard`}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `redirectUrl` | `string` | — | Where the IdP redirects on completion. Mount `<AuthnRedirectCallback />` (or call `Authn.handleRedirectCallback()`) at this path. Required. |
| `redirectUrlComplete` | `string` | — | Where to land the user once the SignIn / SignUp completes. Defaults to `Environment.display_config.after_sign_in_url`. |
| `mode` | `'sign_in' \| 'sign_up'` | `'sign_in'` | Whether the component drives a SignIn or a SignUp flow. `<SignIn />` and `<SignUp />` set this automatically. |
| `excluded` | `string[]` | `[]` | Provider keys to hide. Useful when you want a custom layout for one provider but the defaults for the others. |
| `appearance` | `Appearance` | — | The standard appearance object. See the appearance docs (link landing in v0.5). |

### Slots

| Slot | Description |
| ---- | ----------- |
| `button` | Replaces the rendered button. Receives `{ provider: { key, name, iconUrl }, isLoading, onClick }`. |
| `divider` | Replaces the "or" divider rendered when `<SocialButtons />` is used inside `<SignIn />` above the email/password form. |

### Events

| Event | Fires when | Payload |
| ----- | ---------- | ------- |
| `onProviderClick` | A button is clicked, before navigation. | `{ providerKey: string }` |
| `onError` | The OAuth flow fails (`oauth_state_invalid`, `oauth_user_cancelled`, network). | `{ providerKey, errorCode, errorMessage }` |

`<SocialButtons />` doesn't fire a success event — completion lands on the page mounting `<AuthnRedirectCallback />`, which advances the parent `SignIn` / `SignUp` automatically.

### Standalone vs embedded

`<SignIn />` and `<SignUp />` render `<SocialButtons />` automatically when the environment has at least one enabled provider. Use the standalone form when you want to surface social sign-in outside the default form layout — e.g. above a custom email/password form, or on a dedicated "Connect with…" screen.

## `<PhoneNumberField />`

Composite input that drives add + verify in a single drop-in. Internally renders the input, the verification-code prompt after a Challenge has been issued, and the success state once `PhoneNumber.verified: true`.

```tsx
import { PhoneNumberField } from '@authn-sh/sdk-react';

<PhoneNumberField
    onVerified={(phone) => console.log('phone verified', phone)}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `defaultPhoneNumber` | `string` | `''` | Pre-fill the input. E.164 or any value the parser normalises. |
| `onVerified` | `(phone: PhoneNumber) => void` | — | Fires after `attemptVerification` succeeds and `PhoneNumber.verified` flips to `true`. |
| `onCancel` | `() => void` | — | Fires when the user dismisses the verification step (e.g. clicks "Use a different number"). |
| `requireVerification` | `boolean` | `true` | When `false`, the component returns the unverified `PhoneNumber` immediately on add. Useful for sign-up where verification is deferred. |
| `appearance` | `Appearance` | — | Standard appearance object. |

### Slots

| Slot | Description |
| ---- | ----------- |
| `phoneInput` | Replaces the phone-number input. Receives `{ value, onChange, onSubmit, isSubmitting, error }`. |
| `codeInput` | Replaces the 6-digit verification-code input. Receives `{ value, onChange, onSubmit, isSubmitting, error, phoneNumber }`. |

### State machine

`idle → adding → awaiting_code → verifying → verified`. Errors at `verifying` keep the component at `awaiting_code` so the user can retype the code. Calling `onCancel` from `awaiting_code` resets to `idle` — the unverified `PhoneNumber` row persists server-side and will be reused on the next add of the same number (the FAPI dedupes).

The component is used internally by `<UserProfile />`'s "Phone numbers" section and by `<SignUp />` when the env has `attribute_settings.phone_number != "off"`.

## `<ConnectedAccountsPanel />`

Lists the user's `ExternalAccount` rows + the configured `OauthProvider` rows that are not yet connected. Shows a "Connect" button per missing provider, an "Unlink" button per existing connection.

```tsx
import { ConnectedAccountsPanel } from '@authn-sh/sdk-react';

<ConnectedAccountsPanel
    redirectUrl={`${window.location.origin}/sso-callback`}
    redirectUrlComplete={`${window.location.origin}/account`}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `redirectUrl` | `string` | — | Where the IdP redirects on completion. Mount `<AuthnRedirectCallback />` at this path. Required. |
| `redirectUrlComplete` | `string` | — | Where to land the user once the connect flow completes. |
| `excluded` | `string[]` | `[]` | Provider keys to hide. Useful for env-specific layouts. |
| `onConnect` | `(account: ExternalAccount) => void` | — | Fires when a new `ExternalAccount` row is created (after the redirect bounce returns). |
| `onUnlink` | `(account: ExternalAccount) => void` | — | Fires after `DELETE /v1/me/external-accounts/{id}` succeeds. |
| `appearance` | `Appearance` | — | Standard appearance object. |

### Slots

| Slot | Description |
| ---- | ----------- |
| `connectedRow` | Replaces the row for an already-connected provider. Receives `{ account: ExternalAccount, onUnlink, isUnlinking }`. |
| `availableRow` | Replaces the row for an available-but-not-connected provider. Receives `{ provider: OauthProvider, onConnect, isConnecting }`. |
| `emptyState` | Renders when no providers are configured on the env. |

### Connect flow

Clicking **Connect Google** drives a "transfer" flow against the user's existing session — the SDK posts an `oauth_<provider_key>` Challenge against a fresh `SignIn` with `transfer: true`. The IdP redirect lands at `/v1/oauth-callback/<provider_key>` exactly like a fresh sign-in; the resolver finds the existing `User` and creates a new `ExternalAccount` row pointing at it. No new session is created — the existing one is preserved.

### Unlink flow

Clicking **Unlink GitHub** calls `DELETE /v1/me/external-accounts/{id}`. The server makes a best-effort revocation against the IdP's `revocation_endpoint` (per OIDC discovery, when present); failure to revoke does not block deletion. The user must keep at least one identifier or another sign-in method — the FAPI returns `422` if unlinking would leave them with no way to sign in.

The component is rendered inside `<UserProfile />`'s "Connected accounts" tab automatically when the environment has at least one enabled provider.

## Hooks

The SDK exposes typed hooks for each resource:

### `useExternalAccounts()`

```tsx
import { useExternalAccounts } from '@authn-sh/sdk-react';

const { accounts, isLoading, isLoaded } = useExternalAccounts();
```

Returns the live list of `ExternalAccount` rows for the signed-in user. Re-fetches on session change. Use this when you want to render a custom layout that `<ConnectedAccountsPanel />` doesn't cover.

### `usePhoneNumbers()`

```tsx
import { usePhoneNumbers } from '@authn-sh/sdk-react';

const { phoneNumbers, primary, isLoading, isLoaded } = usePhoneNumbers();
```

Returns the user's `PhoneNumber` rows. `primary` is the row whose ID matches `User.primary_phone_number_id` (`null` if none).

Per-row helpers exposed on the resource:

- `phone.makePrimary()` — `PATCH { is_primary: true }`.
- `phone.togglePhoneNumberReservedForSecondFactor()` — flip `reserved_for_second_factor`.
- `phone.update({ defaultSecondFactor: true })` — set `default_second_factor` (requires `reserved_for_second_factor: true`).
- `phone.prepareVerification()` — issue a `phone_code` Challenge against the row.
- `phone.attemptVerification({ code })` — answer the live Challenge.
- `phone.destroy()` — `DELETE`.

### `useUser()`

The v0.3 `useUser()` hook gains v0.4 helpers:

- `user.createPhoneNumber({ phoneNumber })` — create + return the new row.
- `user.getExternalAccounts()` — alias for `useExternalAccounts()`'s result.

## Account Portal integration

`<UserProfile />` mounts both panels in v0.4:

- **Phone numbers** tab — driven by `<PhoneNumberField />` and `usePhoneNumbers()`.
- **Connected accounts** tab — driven by `<ConnectedAccountsPanel />`.

You only need the standalone components if you're building a custom account-management surface. The default `<UserProfile />` layout reads `Environment.auth_config.identifier_requirements.phone_number` and `Environment.oauth_providers[]` to decide which tabs to render, so disabling phone numbers env-wide automatically hides the tab.

## See also

- [Social sign-in guide](/guides/social-sign-in/) — overview of `OauthProvider` rows and the toggle matrix.
- [Phone numbers guide](/guides/phone-numbers/) — verify, primary-elect, reserve-for-MFA.
- [SMS MFA guide](/guides/sms-mfa/) — second-factor flow that consumes a reserved phone.
- [Security section components](/reference/security-components/) — v0.3 dialogs (`<TotpEnrollDialog />`, `<BackupCodesDialog />`, `<RemoveMfaDialog />`).
