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
- **Authorized apps** — third-party `OauthApplication`s the user has granted access to (revoke / view granted scopes). New in v0.7. See [Authorized apps](#authorized-apps) below.
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

## Authorized apps

The **Authorized apps** section lists every third-party `OauthApplication` the user has granted scopes to via [OAuth provider mode](/concepts/oauth-provider/overview/). Each entry shows:

- The application name and homepage URL (from `OauthApplication.consent_screen`).
- The granted scopes (e.g. `openid`, `profile`, `email`, `offline_access`) with their human-readable descriptions.
- When the grant was first established (`granted_at`) and the last time the app exchanged a refresh token (`last_used_at`).
- A **Revoke access** button that deletes the underlying `AuthorizationGrant` row. The next call from that app to `/oauth/userinfo` or any refresh-token exchange returns `401 invalid_grant`, forcing the third-party app to re-prompt for consent on its next sign-in.

The section auto-hides when:

- The environment has no `OauthApplication` rows configured, **or**
- The signed-in user has zero non-revoked `AuthorizationGrant` rows.

Revocation is hard-delete on the row — there's no "pause" state. To grant access back, the user goes through the third-party app's sign-in flow again and re-consents.

Under the hood this reads `GET /v1/me/oauth-authorization-grants` and writes `DELETE /v1/me/oauth-authorization-grants/{id}`. Wire this up yourself with the `<UserProfile.AuthorizedApps />` subcomponent if you want to relocate it (e.g. surface it on a dedicated `/integrations` page rather than inside the account-settings flow).

## Composition

For finer-grained control, the section-level subcomponents are exposed:

- `<UserProfile.Section />` — slot a custom section between the bundled ones.
- `<UserProfile.Page />` — add a wholly new page (as above).

When you want a completely custom account surface and only need a few of the bundled flows (just MFA enrollment, say), reach for the [security components](/reference/security-components/) — they're the same dialogs `<UserProfile />` uses internally and they work standalone.
