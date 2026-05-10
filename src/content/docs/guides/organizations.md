---
title: Organizations
description: Group users into organizations, manage roles and invitations, and gate access by membership.
---

An **Organization** is a shared tenant within your environment — a named entity that groups users via memberships, carries its own roles and verified domains, and injects an `org` claim into session JWTs when a member makes it their active organization.

Use organizations when your product is multi-tenant and users belong to accounts they didn't personally create (teams, companies, projects, etc.). Single-user products don't need them.

## Create an organization

### Via BAPI (server-side)

```bash
curl -X POST https://<FAPI_URL>/v1/organizations \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Inc.",
    "slug": "acme",
    "created_by": "user_01HKX9SY9V7H7TF8C8K7J9X4ZB"
  }'
```

```php
use AuthnSh\Sdk\Authn;

$org = Authn::organizations()->create([
    'name'       => 'Acme Inc.',
    'slug'       => 'acme',
    'created_by' => $user->authn_id,
]);
```

The `created_by` user is automatically added as a member with the `org:admin` role (`is_creator_eligible: true`).

### Via SDK (client-side, React)

```tsx
import { useOrganizationActions } from '@authn.sh/sdk-react';

function CreateOrgButton() {
    const { createOrganization } = useOrganizationActions();

    return (
        <button
            onClick={() =>
                createOrganization({ name: 'Acme Inc.', slug: 'acme' })
            }
        >
            Create organization
        </button>
    );
}
```

Or drop in the pre-built form:

```tsx
import { CreateOrganization } from '@authn.sh/sdk-react';

<CreateOrganization afterCreateOrganizationUrl="/dashboard" />;
```

### Via Account Portal

Signed-in users can create organizations from their Account Portal at `/user` → **Organizations** — no additional code needed if `<UserProfile />` is mounted.

## Invite members

Members are invited by email. An invitation email is sent; clicking the link takes the recipient through sign-up (or sign-in if they already have an account) and then adds them as a member.

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01K.../invitations \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "kate@acme.com",
    "role": "org:member",
    "redirect_url": "https://app.acme.com/welcome"
  }'
```

```php
Authn::organizationInvitations($orgId)->create([
    'email_address' => 'kate@acme.com',
    'role'          => 'org:member',
    'redirect_url'  => 'https://app.acme.com/welcome',
]);
```

```tsx
import { useOrganizationActions } from '@authn.sh/sdk-react';

const { inviteMember } = useOrganizationActions();

await inviteMember({
    emailAddress: 'kate@acme.com',
    role: 'org:member',
});
```

Invitations expire after 30 days. Revoke early with `DELETE /v1/organizations/{org_id}/invitations/{inv_id}/revoke`.

## Manage roles

Each member holds exactly one role. Change it with a `PATCH` on the membership:

```bash
curl -X PATCH https://<FAPI_URL>/v1/organizations/org_01K.../memberships/orgmem_01K... \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "role": "org:admin" }'
```

```php
Authn::organizationMemberships($orgId)->update($membershipId, [
    'role' => 'org:admin',
]);
```

```tsx
import { useOrganizationActions } from '@authn.sh/sdk-react';

const { updateMemberRole } = useOrganizationActions();

await updateMemberRole(membershipId, 'org:admin');
```

The caller must hold `org:sys_memberships:manage` in the same organization to change another member's role.

## Active organization

A session has at most one **active organization** at a time — the one the user is currently operating as. Setting it embeds an `org` claim in the session JWT:

```json
{
  "sub": "user_01K…",
  "org": {
    "id": "org_01K…",
    "slug": "acme",
    "role": "org:admin",
    "permissions": [
      "org:sys_memberships:manage",
      "org:sys_memberships:read",
      "org:sys_profile:delete",
      "org:sys_profile:manage",
      "org:sys_domains:manage",
      "org:sys_domains:read"
    ]
  }
}
```

The SDK sets the active org automatically when the user switches organizations.

```tsx
import { useActiveOrganization, useOrganizationList } from '@authn.sh/sdk-react';

function OrgSwitcher() {
    const { organization } = useActiveOrganization();
    const { setActive, organizationList } = useOrganizationList();

    return (
        <select
            value={organization?.id ?? ''}
            onChange={(e) => setActive({ organization: e.target.value })}
        >
            {organizationList.map((org) => (
                <option key={org.id} value={org.id}>
                    {org.name}
                </option>
            ))}
        </select>
    );
}
```

Or use the pre-built component:

```tsx
import { OrganizationSwitcher } from '@authn.sh/sdk-react';

<OrganizationSwitcher />;
```

On the backend, read the active org from the verified JWT. See [Verify JWTs in a backend](/guides/verify-jwt/) for setup, then:

```php
use AuthnSh\Sdk\Authn;

$claims = Authn::verifyToken($jwt);

// $claims->organization is populated only when a member is active in an org
if ($claims->organization?->hasPermission('org:sys_memberships:manage')) {
    // allow
}
```

See [Roles & Permissions](/reference/roles-and-permissions/) for the full permission catalog.

## Domain enrollment

Verified domains let you automate membership based on a user's email domain. Once a domain is verified, one of three enrollment modes applies to new sign-ups:

| Mode | Effect |
| ---- | ------ |
| `manual_invitation` | No automatic action — members must be invited explicitly (the default). |
| `automatic_invitation` | Sign-ups whose email matches the domain skip the invitation step and join immediately as the `default_role`. |
| `automatic_suggestion` | Sign-ups with a matching email receive an `OrganizationMembershipRequest` that an admin must approve. |

### Add a domain

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01K.../domains \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme.com",
    "enrollment_mode": "automatic_invitation"
  }'
```

```php
Authn::organizationDomains($orgId)->create([
    'name'            => 'acme.com',
    'enrollment_mode' => 'automatic_invitation',
]);
```

### Verify the domain

Verification proves domain ownership via a `Challenge` resource. Two strategies are supported:

**DNS TXT** — the server creates a challenge and returns a `nonce` — the TXT value you must publish in your DNS zone. Your operator publishes the record, then polls `GET /v1/organizations/{org_id}/domains/{domain_id}/challenges/{cid}` until `status: verified`. There is no separate verify call; authn.sh resolves the record on the next poll and flips the status automatically.

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01K.../domains/orgdom_01K.../challenges \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "strategy": "dns_txt" }'
```

The response includes:

```json
{
  "id": "cha_01K...",
  "strategy": "dns_txt",
  "nonce": "_authn-domain-verify.acme.com TXT \"authn_<nonce>\"",
  "status": "pending"
}
```

Publish the TXT record, then poll:

```bash
curl https://<FAPI_URL>/v1/organizations/org_01K.../domains/orgdom_01K.../challenges/cha_01K... \
  -H "Authorization: Bearer <secret_key>"
```

When the record resolves, `status` flips to `verified` and `OrganizationDomain.verified` becomes `true`. The polling approach is an improvement over a one-shot verify call — your operator can publish the record asynchronously and let the API confirm ownership without a synchronous HTTP round-trip.

**Email code** — an affiliation address at the domain (`admin@acme.com`) receives a 6-digit code. Create a challenge with `strategy: email_code`, then answer it with the code:

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01K.../domains/orgdom_01K.../challenges \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "strategy": "email_code" }'

curl -X POST https://<FAPI_URL>/v1/organizations/org_01K.../domains/orgdom_01K.../challenges/cha_01K.../answer \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "code": "123456" }'
```

```php
$challenge = Authn::organizationDomainChallenges($orgId, $domainId)->create([
    'strategy' => 'email_code',
]);

$challenge->answer(['code' => $request->input('code')]);
```

Once `verified: true`, the enrollment mode takes effect for future sign-ups.
