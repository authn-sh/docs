---
title: SCIM 2.0 with Okta
description: Provision and deprovision Okta users into an authn.sh organization via SCIM 2.0 — endpoint URL, token issuance, Okta-side profile mapping.
---

This walkthrough wires Okta's **SCIM 2.0 provisioning** at an authn.sh organization. After setup, assignment / unassignment in Okta drives lifecycle in your product: a user added to the Okta app gets a `User` row + `OrganizationMembership` automatically; a user removed in Okta is deprovisioned (soft-deleted) without anyone signing in. Available from v0.6.

SCIM is complementary to enterprise SSO — not a replacement. SSO handles sign-in; SCIM handles lifecycle. Run both for the full IT-driven story. See [Per-org SSO setup](/guides/per-org-sso-setup/) for the SSO side.

## Prereq

The org admin needs:

- `org:sys_provisioning:manage` on their `OrganizationMembership` (the seeded `org:admin` role includes it).
- Okta admin access on the customer's Okta tenant.
- The Okta app for sign-in (OIDC or SAML enterprise connection) **already set up**. SCIM can technically run without an enterprise connection, but the IT-side workflow is to layer SCIM onto an existing SSO app.

## Step 1 — Get the SCIM endpoint URL

From `<OrganizationProfile />` → **Directory sync**, the wizard surfaces the SCIM base URL. Alternatively the admin can fetch it via the API:

```bash
curl https://<FAPI_URL>/v1/organizations/org_01.../scim/endpoint \
  -H "Authorization: Bearer <secret_key>"
```

```json
{ "endpoint_url": "https://acme.authn.sh/scim/v2/" }
```

The URL is **environment-wide** — the org scoping comes from the SCIM token, not the path. Don't worry that there's no org-id in the URL; that's by design and matches every SCIM-compliant IdP's expectation.

## Step 2 — Issue a SCIM token

From the same wizard, click **Issue new token**, label it (e.g. "Okta — Production"), and copy the plaintext. **This is the only time it's shown** — subsequent reads expose only the `prefix`.

API equivalent:

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../scim/tokens \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Okta — Production" }'
```

```json
{
  "id": "scimt_01...",
  "object": "scim_token",
  "organization_id": "org_01...",
  "name": "Okta — Production",
  "prefix": "scim_01HKX9SY",
  "token": "scim_01HKX9SYABCDEFGHJKMNPQRSTVWXYZ234567",
  "created_at": 1714723000000,
  "revoked_at": null
}
```

## Step 3 — Wire Okta to authn.sh

In Okta, open the SSO app you've already created for this customer, then:

1. **Provisioning → Integration** → **Configure API Integration** → **Enable API integration**.
2. **Base URL** — paste the `endpoint_url` (without the trailing `Users` — Okta appends `/Users` and `/Groups` itself). Example: `https://acme.authn.sh/scim/v2/`.
3. **API Token** — paste the SCIM token plaintext from Step 2.
4. Click **Test API Credentials**. Okta runs a `GET /ServiceProviderConfig` against the endpoint; the wizard responds with the platform's SCIM 2.0 capability descriptor. A green check means the token + URL are wired.
5. **Save**.

Then in **Provisioning → To App**:

- **Create Users** — enable. Okta will `POST /scim/v2/Users` on every newly-assigned user.
- **Update User Attributes** — enable. Okta will `PATCH /scim/v2/Users/{id}` on profile changes.
- **Deactivate Users** — enable. Okta will `PATCH /scim/v2/Users/{id}` with `active: false` on unassignment (this soft-deletes the user in authn.sh).

## Step 4 — Map Okta's profile attributes

Okta sends a standard SCIM payload with the following attributes by default — these all hit authn.sh's built-in mapping with no override needed:

| Okta attribute | SCIM path | authn.sh field |
| --- | --- | --- |
| Username | `userName` | `email_address` |
| First name | `name.givenName` | `first_name` |
| Last name | `name.familyName` | `last_name` |
| Primary email | `emails[primary eq true].value` | `email_address` |
| Okta user ID | `externalId` | `external_id` |
| Status | `active` | `active` (soft-delete on `false`) |

If you want to push **Okta groups → org roles**, configure the override:

```bash
curl -X PUT https://<FAPI_URL>/v1/organizations/org_01.../scim/attribute-mappings \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mapping": {
      "groups[0].value": "{{ value | downcase | replace: \"admins\", \"org:admin\" | default: \"org:member\" }}.organization_role"
    }
  }'
```

The expression looks at the first group Okta sent, lowercases it, replaces `admins` with `org:admin`, and falls back to `org:member` otherwise. The trailing `.organization_role` is the destination authn.sh field — see [SCIM attribute mapping](/concepts/scim-attribute-mapping/) for the full Liquid syntax.

To push **Okta custom attributes** into `User.public_metadata`:

```json
{
  "mapping": {
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
        "public_metadata.department",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.employeeNumber":
        "public_metadata.employee_number"
  }
}
```

## Step 5 — Test

In Okta, **Assignments** → **Assign** → pick a test user. Within a few seconds, the user should appear in `<OrganizationProfile />` → **Members**. Unassign and the membership disappears (soft-delete — re-assign restores).

Each provisioning event fires a webhook:

- `scimUser.provisioned` — Okta created a `User` + `OrganizationMembership`.
- `scimUser.deprovisioned` — Okta unassigned the user (`active: false`).

The payload carries the `User`, the `enterprise_connection_id` that drove provisioning, and the `organization_id`, so your handlers can route without a follow-up lookup.

## Going live

When the customer's IT team is satisfied with the test users, they assign the rest of their employees and Okta back-fills via the standard SCIM bulk operations. Provisioning is rate-limited by authn.sh to 100 ops / second per token; Okta automatically backs off on `429` responses.

## Troubleshooting

| Symptom | Diagnosis |
| --- | --- |
| Okta `Test API Credentials` returns 401 | Wrong token, or the token was revoked. Issue a new one. |
| Okta provisions but users land without `first_name` | Okta's profile editor doesn't have first/last name fields populated for the source profile. Edit the app's profile mapping in Okta. |
| Okta's group push doesn't change roles | The `groups[*]` filter in the override isn't catching the group attribute. Inspect a delivered webhook payload (`scimUser.provisioned.data.user.public_metadata`) to see what Okta actually sent. |
| `429 rate_limited` | Okta is hammering the endpoint past 100 ops/sec. Okta should back off automatically; if not, file a ticket. |

## What's next

- [SCIM attribute mapping](/concepts/scim-attribute-mapping/) — the full mapping model + Liquid filter reference.
- [Webhooks](/concepts/webhooks/) — the `scimUser.*` and `scimToken.*` event catalogue.
- [SCIM 2.0 with Azure AD](/guides/scim/azure-ad/) / [Google Workspace](/guides/scim/google-workspace/) / [Rippling](/guides/scim/rippling/) — same wire model, different IdP-side recipes.
