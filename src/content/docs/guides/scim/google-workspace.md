---
title: SCIM 2.0 with Google Workspace
description: Provision and deprovision Google Workspace users into an authn.sh organization via the Google-side automated user provisioning surface.
---

This walkthrough wires **Google Workspace** automated user provisioning to an authn.sh organization. Google calls this **Automated user provisioning** in the Admin console; it speaks SCIM 2.0 under the hood. Available from v0.6.

Pair with [Per-org SSO setup](/guides/per-org-sso-setup/) for sign-in routing on top of provisioning.

## Prereq

- `org:sys_provisioning:manage` on the org admin's membership.
- Google Workspace **Super admin** role on the customer's Workspace tenant.
- A **Custom SAML app** for authn.sh already configured in the Workspace Admin console. Google's SCIM surface lives under the SAML app's settings — there's no separate SCIM-only entry point.

## Step 1 — Get the SCIM endpoint URL

```bash
curl https://<FAPI_URL>/v1/organizations/org_01.../scim/endpoint \
  -H "Authorization: Bearer <secret_key>"
# { "endpoint_url": "https://acme.authn.sh/scim/v2/" }
```

Google calls this the **Endpoint URL**.

## Step 2 — Issue a SCIM token

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../scim/tokens \
  -d '{ "name": "Google Workspace — Production" }'
```

Copy the plaintext from the response.

## Step 3 — Wire Google Workspace to authn.sh

In the Google Workspace Admin console:

1. **Apps** → **Web and mobile apps** → click your SAML app.
2. **Auto-provisioning** → **Turn on auto-provisioning**.
3. **Endpoint URL** — paste the SCIM endpoint from Step 1.
4. **Access token** — paste the SCIM token plaintext from Step 2.
5. Click **Continue**. Google fires a probe against `/scim/v2/Users?count=1`; success means the URL + token are wired.
6. **Attribute mapping** — review (see Step 4) and click **Continue**.
7. **Scope** — pick the organizational units or groups whose members should be provisioned. Anyone outside the scope is **not** sent to authn.sh.
8. **Deprovisioning** — pick what happens when a user is removed from scope (suspended in Workspace, leaves the company, …). For a clean lifecycle, set **all three** triggers to **Delete the user**, which translates to SCIM `active: false` on the authn.sh side (soft-delete).
9. **Save**.

## Step 4 — Map Google's profile attributes

Google ships with a defaulted mapping that matches authn.sh's built-ins. Worth tweaking:

| Google source | SCIM path | authn.sh field | Note |
| --- | --- | --- | --- |
| Primary email | `userName` | `email_address` | Google sends this **only as** `userName` — not `emails[]`. |
| First name | `name.givenName` | `first_name` | |
| Last name | `name.familyName` | `last_name` | |
| Google user ID | `externalId` | `external_id` | Google's internal ID, stable across email changes. |
| Suspended | `active` | `active` | |

Google **doesn't** send `emails[primary eq true].value` — only `userName`. The built-in default still resolves to `email_address` because `userName` → `email_address` is in the defaults table.

For **department / job title**, Google does send the standard SCIM enterprise extension attributes. Override:

```bash
curl -X PUT https://<FAPI_URL>/v1/organizations/org_01.../scim/attribute-mappings \
  -d '{
    "mapping": {
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
          "public_metadata.department",
      "title": "public_metadata.title"
    }
  }'
```

Google **does not** push group memberships through SCIM. If you need role assignment driven by Google group, you have two options:

- **Mirror groups as OUs** — Google's automated provisioning supports OU-based scoping but not OU-as-role propagation. You'd need a thin Cloud Functions glue that converts OU → SCIM `groups[]` patches.
- **Push role via custom user attribute** — Google supports custom user fields. Set one (e.g. `authnRole`) per user and map it:

```json
{
  "mapping": {
    "urn:ietf:params:scim:schemas:gsuite:1.0:User.authnRole": "organization_role"
  }
}
```

Either way, role assignment is more work on Workspace than it is on Okta or Entra; the SSO path drives it cleaner via group → `default_role` on the enterprise connection.

## Step 5 — Test

Google's auto-provisioning runs on a **15-minute cycle**, with no on-demand push button in the Admin console. To test, change a scoped user's profile (or add a new test user to the scoped OU) and check `<OrganizationProfile />` → **Members** about 20 minutes later.

For faster iteration, the **Provisioning logs** under the SAML app surface every inbound request — including which users got `Created` / `Updated` / `Skipped` and why.

## Troubleshooting

| Symptom | Diagnosis |
| --- | --- |
| Google reports `Endpoint check failed: 401` | Token is wrong or revoked. Issue a new one. |
| Users provision but `last_name` is missing | Workspace profile lacks a family name. Common for accounts created from a single display-name input. Edit the user. |
| Users in scope don't appear after 20 minutes | Confirm **Auto-provisioning** is **On** (not just configured) and the user is actually in the scoped OU/group. |
| Suspended user not soft-deleted in authn.sh | The **Deprovisioning** trigger for **Suspended** isn't set to **Delete the user**. Edit the trigger. |

## What's next

- [SCIM attribute mapping](/concepts/scim-attribute-mapping/) — full Liquid expression reference.
- [Webhooks](/concepts/webhooks/) — `scimUser.provisioned` / `scimUser.deprovisioned` payloads.
- [SCIM 2.0 with Okta](/guides/scim/okta/) / [Azure AD](/guides/scim/azure-ad/) / [Rippling](/guides/scim/rippling/).
