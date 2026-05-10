---
title: Security section components
description: Pre-built React components for MFA enrollment, backup code management, and factor removal.
---

The `@authn.sh/sdk-react` package ships three pre-built dialog components for common MFA flows. They're rendered as modal dialogs on top of your existing UI and handle all state transitions internally.

These components require `<AuthnProvider>` in the tree. They are available from v0.3 of `sdk-react`.

## `<TotpEnrollDialog />`

Guides the user through TOTP enrollment in three internal steps: generate secret → scan QR / copy URI → enter first code.

```tsx
import { TotpEnrollDialog } from '@authn.sh/sdk-react';

<TotpEnrollDialog
    open={isOpen}
    onOpenChange={setIsOpen}
    onSuccess={() => console.log('TOTP enrolled')}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `open` | `boolean` | — | Controls whether the dialog is visible. |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the dialog requests a visibility change (close button, backdrop click, Escape). |
| `onSuccess` | `() => void` | — | Called after `POST /v1/me/totp/verify` succeeds and `User.totp_enabled` is `true`. |

### Customization slots

| Slot | Description |
| ---- | ----------- |
| `qrPlaceholder` | Replaces the default QR code `<img>`. Receives `{ qrCodeDataUrl, otpauthUri }`. |
| `codeInput` | Replaces the 6-digit input and its surrounding label. Receives `{ onSubmit, isSubmitting, error }`. |

### State machine

The component advances through `idle → generating → qr_display → verifying → success → done`. Errors at `verifying` display inline and keep the component at `qr_display` so the user can retry. Calling `onOpenChange(false)` while in `qr_display` resets to `idle` — the unverified enrollment row persists server-side and will be overwritten on the next `open`.

## `<BackupCodesDialog />`

Displays a one-time plaintext reveal of newly-generated backup codes. Calls `POST /v1/me/backup-codes` on mount (when `open` first becomes `true`), shows the codes, and waits for the user to confirm they've saved them.

```tsx
import { BackupCodesDialog } from '@authn.sh/sdk-react';

<BackupCodesDialog
    open={isOpen}
    onOpenChange={setIsOpen}
    onSuccess={() => console.log('Backup codes saved')}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `open` | `boolean` | — | Controls whether the dialog is visible. |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the dialog requests a visibility change. Closing before confirmation shows a warning. |
| `onSuccess` | `() => void` | — | Called after the user clicks the "I've saved my codes" confirmation. |

### Customization slots

| Slot | Description |
| ---- | ----------- |
| `codeList` | Replaces the default code grid. Receives `{ codes: string[] }`. |
| `confirmButton` | Replaces the "I've saved my codes" button. |

### State machine

The component advances through `idle → generating → revealed → confirmed`. The dialog blocks closing (calls `onOpenChange(true)`) while in `revealed` unless the user first clicks the confirm button. This prevents accidental dismissal before the codes are stored. Closing in `idle` or after `confirmed` proceeds normally.

> Regenerating codes replaces the entire prior batch. Old codes stop working immediately. The component does not warn about this — add copy in your surrounding UI if users need reminding.

## `<RemoveMfaDialog />`

Confirms and executes full MFA removal for the signed-in user. Calls `DELETE /v1/me/totp` and `DELETE /v1/me/backup-codes` sequentially.

```tsx
import { RemoveMfaDialog } from '@authn.sh/sdk-react';

<RemoveMfaDialog
    open={isOpen}
    onOpenChange={setIsOpen}
    onSuccess={() => console.log('MFA removed')}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `open` | `boolean` | — | Controls whether the dialog is visible. |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the dialog requests a visibility change. |
| `onSuccess` | `() => void` | — | Called after both delete calls succeed and `User.two_factor_enabled` is `false`. |

### Customization slots

| Slot | Description |
| ---- | ----------- |
| `confirmationText` | Replaces the default warning prose. Receives no props. |
| `confirmButton` | Replaces the "Remove MFA" destructive button. |

### State machine

`idle → confirming → removing_totp → removing_backup_codes → success`. If either delete call returns `404` (factor not enrolled), the component skips that step and continues. Errors at the removal steps display inline and leave the component at `confirming`.

## Account Portal integration

The `<UserProfile />` component's **Security** tab renders all three dialogs automatically when MFA is enabled for the environment. You only need the standalone components if you're building a custom account-management surface.

The components read `InstanceSettings.multi_factor` from the environment bootstrap — factors disabled at the instance level are hidden automatically.
