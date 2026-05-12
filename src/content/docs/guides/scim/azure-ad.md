---
title: SCIM 2.0 with Azure AD / Entra ID
description: Provision and deprovision Microsoft Entra ID users into an authn.sh organization via SCIM 2.0 — endpoint URL, secret token, Microsoft-side attribute mapping.
---

This walkthrough wires Microsoft **Entra ID** (the rebrand of Azure Active Directory) SCIM provisioning to an authn.sh organization. After setup, group assignment in Entra drives lifecycle in your product — users assigned to the Entra enterprise app are provisioned within a few minutes; users unassigned are deprovisioned. Available from v0.6.

Pair with [Per-org SSO setup](/guides/per-org-sso-setup/) for full sign-in + lifecycle automation.

## Prereq

- `org:sys_provisioning:manage` on the org admin's membership.
- An Entra-side **Enterprise application** for sign-in already created (the same one you used for OIDC / SAML SSO). Entra calls SCIM **Automatic provisioning** under the **Provisioning** blade of that app.
- An Entra tenant admin or an account with the **Application Administrator** + **Cloud Application Administrator** roles.

## Step 1 — Get the SCIM endpoint URL

From `<OrganizationProfile />` → **Directory sync**, copy the **SCIM base URL**.

```bash
curl https://<FAPI_URL>/v1/organizations/org_01.../scim/endpoint \
  -H "Authorization: Bearer <secret_key>"
# { "endpoint_url": "https://acme.authn.sh/scim/v2/" }
```

Entra calls this the **Tenant URL** in its UI.

## Step 2 — Issue a SCIM token

Same wizard, **Issue new token** → label it "Entra ID — Production". Copy the plaintext from the response — it's only shown once.

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../scim/tokens \
  -d '{ "name": "Entra ID — Production" }'
```

Entra calls this the **Secret Token**.

## Step 3 — Wire Entra to authn.sh

In the Entra portal, open the enterprise application for this customer:

1. **Provisioning** blade → **Get started** → **Provisioning Mode** = **Automatic**.
2. **Admin Credentials**:
   - **Tenant URL** — paste the SCIM endpoint from Step 1, with `?aadOptscim062020` appended. The query string puts Entra into the SCIM 2.0 + AAD-compat mode authn.sh expects. Final shape: `https://acme.authn.sh/scim/v2/?aadOptscim062020`.
   - **Secret Token** — paste the token plaintext from Step 2.
3. Click **Test Connection**. Entra fires a probe against `/scim/v2/ServiceProviderConfig` — a green tick means the URL + token + AAD-compat flag are wired.
4. **Save**.
5. **Mappings** → leave Entra's default **Provision Microsoft Entra ID Users** mapping in place. The defaults map to standard SCIM paths.
6. **Settings** → **Provisioning Status** → **On**. Entra starts a cycle within a few minutes (Entra's cycles run on a ~40-minute schedule by default).

## Step 4 — Map Entra's profile attributes

Entra's default attribute set hits all of authn.sh's built-in defaults — no override needed for the standard fields:

| Entra source | SCIM path | authn.sh field |
| --- | --- | --- |
| `userPrincipalName` | `userName` | `email_address` |
| `givenName` | `name.givenName` | `first_name` |
| `surname` | `name.familyName` | `last_name` |
| `mail` | `emails[primary eq true].value` | `email_address` |
| `objectId` | `externalId` | `external_id` |
| Soft delete | `active` | `active` |

For role assignment based on Entra group membership, the cleanest path is to **use one Entra group per role**. Entra ships group assignments separately from user provisioning, so the override is:

```bash
curl -X PUT https://<FAPI_URL>/v1/organizations/org_01.../scim/attribute-mappings \
  -d '{
    "mapping": {
      "groups[0].displayName":
          "{{ value | downcase | replace: \"acme-admins\", \"org:admin\" | replace: \"acme-employees\", \"org:member\" }}.organization_role"
    }
  }'
```

For Entra **employeeHireDate / department / employeeId**, the SCIM extension paths are the standard ones:

```json
{
  "mapping": {
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
        "public_metadata.department",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.employeeNumber":
        "public_metadata.employee_id"
  }
}
```

## Step 5 — Test

In Entra, **Users and groups** → **Add user/group** → assign a test user. Entra's next provisioning cycle (or **Provision on demand** for one-off pushes) creates the `User` + `OrganizationMembership`. Expect a 1–3 minute delay on demand pushes, longer on the scheduled cycle.

The provisioning logs in Entra (**Provisioning logs** under the app) show every inbound request's status — useful for debugging which user got created / skipped / failed.

## Troubleshooting

| Symptom | Diagnosis |
| --- | --- |
| Entra `Test Connection` returns 401 | Wrong token, or revoked. Issue a new one. |
| Entra shows `Service unavailable` | The `?aadOptscim062020` query string is missing. Re-paste the Tenant URL with it. |
| Users with `mail = null` get skipped | Entra emits `emails[].value: null` for users without a primary email. The mapping's email field is required — set a primary email on the user in Entra. |
| Group memberships don't propagate | Confirm **Provision Microsoft Entra ID Groups** mapping is enabled in the **Mappings** blade. Group sync runs separately from user sync. |
| `429 rate_limited` during a back-fill | Entra hammers SCIM on first activation. authn.sh's 100 ops/sec ceiling kicks in; Entra retries with backoff automatically. |

## What's next

- [SCIM attribute mapping](/concepts/scim-attribute-mapping/) — the override layer + Liquid expressions.
- [Webhooks](/concepts/webhooks/) — `scimUser.provisioned` / `scimUser.deprovisioned` event payload shape.
- [SCIM 2.0 with Okta](/guides/scim/okta/) / [Google Workspace](/guides/scim/google-workspace/) / [Rippling](/guides/scim/rippling/) — sibling walkthroughs.
