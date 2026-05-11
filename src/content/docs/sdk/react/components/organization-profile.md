---
title: <OrganizationProfile />
description: The bundled organization-settings component — members, invitations, domain enrollment, roles, danger zone.
---

`<OrganizationProfile />` renders the complete admin surface for the user's currently active organization. Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { OrganizationProfile } from '@authn.sh/sdk-react';

export default function OrgSettingsPage() {
  return <OrganizationProfile />;
}
```

The component reads the user's current `Organization` from the JWT's `org` claim and renders a multi-section panel:

- **General** — organization name, slug, logo.
- **Members** — current memberships with roles; admin actions (change role, remove member).
- **Invitations** — pending invitations; create / revoke.
- **Domains** — verified domain list, enrollment mode (manual / auto-invitation / auto-suggestion), DNS verification flows.
- **Membership requests** — pending sign-up requests when auto-suggestion is enabled.
- **Roles** — system + custom roles, permission matrix.
- **Danger zone** — leave organization, delete organization (when allowed by environment settings).

Sections are gated on the user's permissions — a member with only `org:read` sees the members list but not the admin actions; a non-admin doesn't see the danger zone at all.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `routing` | `'path' \| 'hash' \| 'virtual'` | `'path'` | How the component navigates between sections. |
| `path` | `string` | `'/organization'` | Base path for `routing: 'path'`. |
| `afterLeaveOrganizationUrl` | `string` | environment `home_url` | Where to send the user after they leave the organization. |
| `appearance` | `Appearance` | — | Per-render appearance override. |
| `localization` | `Localization` | — | Per-render localization override. |
| `customPages` | `CustomPage[]` | `[]` | Operator-defined extra pages to slot into the section list. |

## Custom pages

Same pattern as `<UserProfile />`:

```tsx
<OrganizationProfile>
  <OrganizationProfile.Page
    label="Billing"
    url="billing"
    labelIcon={<CreditCardIcon />}
  >
    <OrgBillingSettings />
  </OrganizationProfile.Page>
</OrganizationProfile>
```

## Composition

When you want only a few of the bundled flows (just the members list, say) without the full profile shell, use the underlying hooks:

- `useOrganization()` — current `Organization`, membership list, invitation list.
- `useOrganizationList()` — every organization the user belongs to.
- `useOrganizationMembership()` — the current user's `OrganizationMembership` row (with `hasPermission(...)`).

The hooks expose the same surfaces `<OrganizationProfile />` uses internally.
