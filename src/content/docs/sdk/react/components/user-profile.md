---
title: <UserProfile />
description: The bundled user-profile component — account settings, email / phone / password / passkey / MFA management, connected accounts, sessions, danger zone.
---

`<UserProfile />` renders the complete account-settings surface for the currently signed-in user. It's the v1 component you drop into a `/account` route to give your users a place to manage their identity without you having to build any of it.

Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { UserProfile } from '@authn.sh/sdk-react';

export default function AccountPage() {
  return <UserProfile />;
}
```

Renders a multi-section panel:

- **Account** — name, profile image, primary email / phone selection.
- **Security** — password management, passkey enrollment list, TOTP enrollment, backup codes, active sessions.
- **Connected accounts** — OAuth provider links (add / remove).
- **Phone numbers** — add / verify / set primary / reserve-for-MFA.
- **Emails** — add / verify / set primary.
- **Organizations** — when the environment has Organizations enabled, the user's memberships list.
- **Danger zone** — delete account (when allowed by environment settings).

The section list adapts to environment configuration — a section disappears if every feature it gates is disabled (no point showing "Passkeys" if the operator disabled passkeys at instance level).

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `routing` | `'path' \| 'hash' \| 'virtual'` | `'path'` | How the component navigates between sections. |
| `path` | `string` | `'/user'` | Base path for `routing: 'path'`. |
| `appearance` | `Appearance` | — | Per-render appearance override. |
| `localization` | `Localization` | — | Per-render localization override. |
| `additionalOAuthScopes` | `Record<string, string[]>` | `{}` | Per-provider extra scopes to request when the user clicks **Connect**. Useful when the operator wants the OAuth connection to carry app-specific scopes (e.g. `slack: ['channels:read']`). |
| `customPages` | `CustomPage[]` | `[]` | Operator-defined extra pages to slot into the section list. See [Custom pages](#custom-pages) below. |

## Custom pages

For app-specific account settings (e.g. "Notifications", "Billing") you want to live next to the bundled sections:

```tsx
<UserProfile>
  <UserProfile.Page
    label="Billing"
    url="billing"
    labelIcon={<CreditCardIcon />}
  >
    <BillingSettings />
  </UserProfile.Page>
</UserProfile>
```

`label`, `url`, `labelIcon` define the sidebar entry. The children render in the right-hand pane when the user navigates to that section. The component handles the routing — your inner component doesn't need to know how it's mounted.

## Composition

For finer-grained control, the section-level subcomponents are exposed:

- `<UserProfile.Section />` — slot a custom section between the bundled ones.
- `<UserProfile.Page />` — add a wholly new page (as above).

When you want a completely custom account surface and only need a few of the bundled flows (just MFA enrollment, say), reach for the [security components](/reference/security-components/) — they're the same dialogs `<UserProfile />` uses internally and they work standalone.
