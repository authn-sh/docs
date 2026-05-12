---
title: SCIM 2.0 with Rippling
description: Provision and deprovision Rippling employees into an authn.sh organization — endpoint URL, bearer token, Rippling's app-management UI.
---

This walkthrough wires **Rippling**'s SCIM provisioning to an authn.sh organization. Rippling is the most "HR-first" of the IdPs we support — provisioning is driven by employment lifecycle (hire date, termination date, role changes), not by application assignment. Available from v0.6.

Pair with [Per-org SSO setup](/guides/per-org-sso-setup/) if you also want Rippling-driven SSO at sign-in.

## Prereq

- `org:sys_provisioning:manage` on the org admin's membership.
- Rippling admin or **App Owner** access on the customer's Rippling tenant.
- The authn.sh app already added in Rippling's **Apps** marketplace (or created as a custom app). Rippling exposes SCIM under any app — there's no separate provisioning-only entry.

## Step 1 — Get the SCIM endpoint URL

```bash
curl https://<FAPI_URL>/v1/organizations/org_01.../scim/endpoint \
  -H "Authorization: Bearer <secret_key>"
# { "endpoint_url": "https://acme.authn.sh/scim/v2/" }
```

Rippling calls this the **SCIM URL**.

## Step 2 — Issue a SCIM token

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../scim/tokens \
  -d '{ "name": "Rippling — Production" }'
```

Rippling calls this the **Bearer Token**.

## Step 3 — Wire Rippling to authn.sh

In the Rippling Admin Center:

1. **Apps** → click the authn.sh app.
2. **Provisioning** tab → **Set up provisioning**.
3. **SCIM URL** — paste the endpoint from Step 1.
4. **Bearer Token** — paste the plaintext from Step 2.
5. **Authentication method** — **Bearer Token** (the default).
6. Click **Test connection**. Rippling probes `GET /scim/v2/ServiceProviderConfig`; success confirms the wiring.
7. **Save and continue**.

Rippling then asks which **employee groups** should be in scope. This is the lever for "every full-time engineering employee should have an authn.sh account" rules — you set a Rippling group filter (e.g. **Department = Engineering AND Status = Active**) and Rippling pushes the matching employees automatically.

## Step 4 — Map Rippling's profile attributes

Rippling sends a SCIM 2.0 payload with the standard attributes. The platform defaults handle them:

| Rippling source | SCIM path | authn.sh field |
| --- | --- | --- |
| Work email | `userName` | `email_address` |
| Work email | `emails[primary eq true].value` | `email_address` |
| First name | `name.givenName` | `first_name` |
| Last name | `name.familyName` | `last_name` |
| Rippling employee ID | `externalId` | `external_id` |
| Active | `active` | `active` |

Rippling's **employment-status changes** ride on `active`. Terminations flip `active: false`, which soft-deletes in authn.sh.

Rippling's HR data shines through the enterprise extension. Useful overrides:

```bash
curl -X PUT https://<FAPI_URL>/v1/organizations/org_01.../scim/attribute-mappings \
  -d '{
    "mapping": {
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
          "public_metadata.department",
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.manager.value":
          "public_metadata.manager_user_id",
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.employeeNumber":
          "public_metadata.employee_number",
      "title": "public_metadata.job_title"
    }
  }'
```

For role assignment driven by Rippling **department**:

```json
{
  "mapping": {
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
        "{{ value | downcase | replace: \"engineering\", \"org:admin\" | default: \"org:member\" }}.organization_role"
  }
}
```

## Step 5 — Test

Rippling pushes on every employment-data change with near-real-time latency (typically <2 minutes). To test, change a scoped employee's title or department in the Rippling People view; the corresponding `User` row in authn.sh updates almost immediately.

For deprovisioning, the cleanest test is to terminate a test employee in Rippling (set `Termination date` to today). Within a couple of minutes, Rippling fires `PATCH /scim/v2/Users/{id}` with `active: false` and the user is soft-deleted.

## Troubleshooting

| Symptom | Diagnosis |
| --- | --- |
| Rippling `Test connection` fails | Token wrong / revoked. Issue a new one. |
| Provisioned user has no `first_name` / `last_name` | The Rippling employee profile is missing those fields. Common for contractor records. |
| Terminations don't soft-delete | Rippling didn't include the user in the scope filter. The standard SCIM contract requires the user to be **in scope** for the `active: false` update to flow; out-of-scope users go silent. |
| Users provisioned but not signing in via SSO | Rippling SCIM and Rippling SSO are independent surfaces. Confirm the user is also assigned to the SSO half of the app. |

## What's next

- [SCIM attribute mapping](/concepts/scim-attribute-mapping/) — full Liquid expression reference.
- [Webhooks](/concepts/webhooks/) — `scimUser.provisioned` / `scimUser.deprovisioned` event payloads.
- [SCIM 2.0 with Okta](/guides/scim/okta/) / [Azure AD](/guides/scim/azure-ad/) / [Google Workspace](/guides/scim/google-workspace/).
