---
title: <OrganizationSwitcher />
description: A standalone organization picker — switch active org, create new org, accept invitations.
---

`<OrganizationSwitcher />` renders an inline button + popover that lets the user switch their active `Organization`, create a new one, or accept pending invitations. It's the standalone variant of the org-switcher embedded in [`<UserButton />`](/sdk/react/components/user-button/), suitable for app chrome where the org context is more prominent than the user identity (e.g. a left-rail header in a B2B dashboard).

Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { OrganizationSwitcher } from '@authn.sh/sdk-react';

export default function Sidebar() {
  return (
    <aside>
      <OrganizationSwitcher />
      <nav>{/* … */}</nav>
    </aside>
  );
}
```

When the user belongs to no organizations, the component renders only the "Create organization" action. When the environment has Organizations disabled, the component renders nothing.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `hidePersonal` | `boolean` | `false` | When `true`, hides the "Personal account" option — useful for B2B products where users must operate within an organization at all times. |
| `createOrganizationMode` | `'navigation' \| 'modal'` | `'modal'` | `modal` opens an in-place "Create organization" dialog. `navigation` sends the user to `createOrganizationUrl`. |
| `createOrganizationUrl` | `string` | — | Required when `createOrganizationMode: 'navigation'`. |
| `afterCreateOrganizationUrl` | `string` | environment `home_url` | Where to send the user after they create a new organization. |
| `afterSelectOrganizationUrl` | `string` | environment `home_url` | Where to send the user after they switch organizations. |
| `afterSelectPersonalUrl` | `string` | environment `home_url` | Where to send the user after they switch back to their personal account. |
| `organizationProfileMode` | `'navigation' \| 'modal'` | `'navigation'` | `navigation` opens `organizationProfileUrl` in the current tab. `modal` opens `<OrganizationProfile />` in an in-place modal. |
| `organizationProfileUrl` | `string` | `/organization` | Where the **Manage organization** action sends the user. |
| `appearance` | `Appearance` | — | Per-render appearance override. |
| `localization` | `Localization` | — | Per-render localization override. |

## Pending invitations

The switcher includes an "Invitations" affordance when the user has unaccepted `OrganizationInvitation` rows. Accepting an invitation from the popover adds the user to the inviting organization and sets it as `active_organization` — no separate accept page required.

## Composition

For finer-grained control, the popover sub-elements are exposed:

- `<OrganizationSwitcher.OrganizationProfilePage />` — slot a custom page into the inline org-profile modal (same surface as `<OrganizationProfile.Page />`).
- `<OrganizationSwitcher.OrganizationProfileLink />` — slot an inline link into the popover.

When you want the picker logic without the popover chrome, reach for `useOrganizationList()` directly.
