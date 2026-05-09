---
title: Roles & Permissions
description: System permission catalog, default roles, and per-platform helpers for checking org access.
---

Every environment is seeded with two roles and 13 system permissions at bootstrap. Custom roles and permissions can be added via BAPI (custom permissions land in v0.3+).

## Default roles

| `key` | `is_creator_eligible` | `is_default` | Permissions |
| ----- | :-------------------: | :----------: | ----------- |
| `org:admin` | yes | no | All 13 system permissions. |
| `org:member` | no | yes | The `:read` subset — `org:sys_profile:read`, `org:sys_memberships:read`, `org:sys_domains:read`, `org:sys_billing:read`, `org:sys_sso:read`, `org:sys_provisioning:read`. |

`is_creator_eligible` — the organization creator is assigned the first eligible role. `org:admin` is the only eligible role in the default seed.

`is_default` — new members enrolled via `automatic_invitation` or accepted `OrganizationMembershipRequest` receive the default role. `org:member` is the default out of the box.

## System permissions catalog

All 13 system permissions are seeded with `is_system: true`. They cannot be deleted; their `name` field may be localized.

| `key` | Purpose |
| ----- | ------- |
| `org:sys_profile:read` | Read org name, slug, image. |
| `org:sys_profile:manage` | Edit org name, slug, image, and metadata. |
| `org:sys_profile:delete` | Delete the org (subject to `admin_delete_enabled`). |
| `org:sys_memberships:read` | List members and pending requests. |
| `org:sys_memberships:manage` | Invite, remove, change roles, accept membership requests. |
| `org:sys_domains:read` | List verified domains. |
| `org:sys_domains:manage` | Add, verify, change enrollment mode, delete domains. |
| `org:sys_billing:read` | Reserved — billing milestone. |
| `org:sys_billing:manage` | Reserved — billing milestone. |
| `org:sys_sso:read` | Reserved — v0.6 enterprise SSO. |
| `org:sys_sso:manage` | Reserved — v0.6 enterprise SSO. |
| `org:sys_provisioning:read` | Reserved — v0.6 SCIM. |
| `org:sys_provisioning:manage` | Reserved — v0.6 SCIM. |

The billing, SSO, and provisioning permissions are seeded now so that default roles can declare them, enabling downstream milestones to wire up endpoints without a fresh seed.

## Create a custom role

Custom roles are scoped to an environment and shared across all its organizations.

```bash
curl -X POST https://<FAPI_URL>/v1/roles \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "org:billing",
    "name": "Billing manager",
    "permissions": ["org:sys_billing:read", "org:sys_billing:manage"]
  }'
```

```php
use AuthnSh\Sdk\Authn;

Authn::roles()->create([
    'key'         => 'org:billing',
    'name'        => 'Billing manager',
    'permissions' => ['org:sys_billing:read', 'org:sys_billing:manage'],
]);
```

Role keys must match `^org:[a-z][a-z0-9_]*$` and must not collide with `org:admin`, `org:member`, or the `org:sys_*` permission prefix.

To replace a role's permission set wholesale:

```bash
curl -X PUT https://<FAPI_URL>/v1/roles/<role_id>/permissions \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "permissions": ["org:sys_billing:read"] }'
```

Sending `[]` clears all permissions.

## Checking permissions

### PHP backend (`sdk-php`)

```php
use AuthnSh\Sdk\Authn;

$claims = Authn::verifyToken($jwt);

// Check permission from the active-org claim
if ($claims->organization?->hasPermission('org:sys_memberships:manage')) {
    // caller may manage memberships
}

// Or check via the manager (server-to-server)
$membership = Authn::organizationMemberships($orgId)->get($membershipId);
$canManage = in_array('org:sys_memberships:manage', $membership->permissions, true);
```

### Laravel (`sdk-php-laravel`)

```blade
@authnHas('permission:org:sys_memberships:manage')
    <a href="/members/manage">Manage members</a>
@endAuthnHas

@authnHas('role:org:admin')
    <a href="/settings/delete">Delete organization</a>
@endAuthnHas
```

```php
use AuthnSh\Laravel\Facades\Authn;

if (Authn::hasPermission('org:sys_memberships:manage')) {
    // allow
}

if (Authn::hasRole('org:admin')) {
    // allow
}
```

Both helpers read from the active-org claim in the current request's JWT.

### React (`sdk-react`)

```tsx
import { useOrganization } from '@authn.sh/sdk-react';

function ManageMembersButton() {
    const { membership } = useOrganization();

    if (!membership?.hasPermission('org:sys_memberships:manage')) {
        return null;
    }

    return <button>Manage members</button>;
}
```

`membership.hasPermission(key)` checks against the computed `permissions[]` on the membership returned by the SDK — no extra request needed.

### SDK-JS (vanilla)

```ts
import { authn } from '@authn.sh/sdk-js';

const membership = authn.organization?.membership;
const canManage = membership?.hasPermission('org:sys_memberships:manage') ?? false;
```
