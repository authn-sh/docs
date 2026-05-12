---
title: SCIM attribute mapping
description: The defaults authn.sh ships, the per-org override layer for IdPs with non-standard attribute names, and Liquid transform expressions for values that need to be reshaped.
---

SCIM 2.0 is intentionally flexible — every IdP picks its own subset of the spec's attribute paths, and roughly half of them ship vendor-specific extensions. authn.sh handles this with a **two-layer mapping** scheme:

1. **Platform defaults.** A built-in map covers `userName`, `name.givenName`, `name.familyName`, `emails[primary eq true].value`, `externalId`, and the standard `active` flag — enough to ingest 90% of vendor SCIM agents without configuration.
2. **Per-org override.** Each `Organization` can ship a `ScimAttributeMapping` row that overrides specific paths. The override is keyed by SCIM attribute path; unspecified paths fall through to defaults.

This concept page documents the model. For IdP-specific recipes (Okta, Azure AD, Google Workspace, Rippling) see the [SCIM walkthroughs](/guides/scim/okta/).

## The wire shape

```json
{
  "organization_id": "org_01HKX9SY9V7H7TF8C8K7J9X4ZB",
  "mapping": {
    "userName": "email_address",
    "name.givenName": "first_name",
    "name.familyName": "last_name",
    "externalId": "external_id",
    "emails[primary eq true].value": "email_address",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
        "public_metadata.department"
  }
}
```

- **Key** — SCIM attribute path. Standard SCIM paths use the `name.givenName` dotted form; SCIM extension attributes use the full URN-prefixed path (e.g. `urn:…:enterprise:2.0:User.department`). Filter expressions (`emails[primary eq true].value`) are supported verbatim — the server parses the SCIM filter at ingest time.
- **Value** — authn.sh field name. Top-level User fields (`email_address`, `first_name`, `last_name`, `external_id`) write directly. The `public_metadata.<key>` prefix routes the value into the user's `public_metadata` JSON blob — useful for IdP extras you want server-side without an extra schema migration.

## Defaults

When no override is configured for a key, the platform falls back to:

| SCIM path | authn.sh field |
| --- | --- |
| `userName` | `email_address` |
| `emails[primary eq true].value` | `email_address` |
| `name.givenName` | `first_name` |
| `name.familyName` | `last_name` |
| `externalId` | `external_id` |
| `active` | `active` (controls deprovisioning — `false` soft-deletes the user) |

The `userName` / `emails[primary eq true].value` overlap is intentional: many IdPs ship one or the other (Okta sends both; Google Workspace sends only `userName`; Rippling sends only the `emails[]` filter). Whichever resolves first wins, with `emails[primary eq true].value` taking precedence when both are present.

## Per-org overrides

Replace the full row via `PUT`:

```bash
curl -X PUT https://<FAPI_URL>/v1/organizations/org_01.../scim/attribute-mappings \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mapping": {
      "userName": "email_address",
      "name.givenName": "first_name",
      "name.familyName": "last_name",
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
          "public_metadata.department"
    }
  }'
```

There's exactly one `ScimAttributeMapping` per organization; the operation is `PUT` (replace), not `PATCH`. To revert to platform defaults, `PUT` with an empty `mapping: {}`.

A common shape — extending the default mapping without removing any of the defaults — is to copy the defaults verbatim and add your new keys:

```json
{
  "mapping": {
    "userName": "email_address",
    "emails[primary eq true].value": "email_address",
    "name.givenName": "first_name",
    "name.familyName": "last_name",
    "externalId": "external_id",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department":
        "public_metadata.department",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.employeeNumber":
        "public_metadata.employee_number"
  }
}
```

## Liquid transform expressions

When a value needs to be reshaped between the IdP and the authn.sh field — case-normalizing an email, splitting a `displayName` into first / last, or picking a SCIM `groups[]` value as the `OrganizationMembership.role` — wrap the value in a Liquid expression:

```json
{
  "mapping": {
    "userName": "{{ value | downcase }}",
    "displayName.firstWord": "{{ value | split: ' ' | first }}.first_name",
    "groups[0].value":
        "{{ value | downcase | replace: 'admins', 'org:admin' | default: 'org:member' }}.organization_role"
  }
}
```

The expression syntax:

- `{{ value | filter | … }}` evaluates to a transformed value. `value` is the raw SCIM attribute.
- The trailing `.field_name` on the expression's right side (after the closing `}}`) is the destination authn.sh field. When the expression takes the whole right side (no trailing field), the destination is the same as the SCIM path's default mapping target.

Supported Liquid filters: `downcase`, `upcase`, `strip`, `split`, `first`, `last`, `replace`, `prepend`, `append`, `default`. The platform deliberately excludes filesystem, network, and template-include filters — the expression is sandbox-evaluated per inbound SCIM request and bounded to 1ms wall time per evaluation.

Liquid is optional — every value in the mapping can stay a plain string. Reach for it only when the IdP's payload shape can't be wired straight through.

## How mappings interact with provisioning

The mapping fires on every inbound `POST /scim/v2/Users`, `PATCH /scim/v2/Users/{id}`, and `PUT /scim/v2/Users/{id}`. The resolver:

1. Walks each SCIM attribute path on the inbound payload.
2. Looks it up in the org's `ScimAttributeMapping.mapping`, falling back to the platform default if absent.
3. Writes the value to the target authn.sh field — or to `public_metadata.<key>` for the `public_metadata.…` prefix.

A few resolver rules worth knowing:

- **`active: false` is special.** It triggers a soft-delete on the linked `User` (or on the `OrganizationMembership` if the IdP only manages the org-scoped surface). The `User` row stays, but every session is revoked and the next sign-in attempt is rejected with `user_locked`. Re-enrolling via `active: true` reactivates without losing audit history.
- **The provisioning side of email writes is verified-true.** Emails written through SCIM are flagged `verified: true` automatically — the IdP is asserting them. This matches the behaviour of `EnterpriseAccount.verified: true` for enterprise-SSO sign-ins.
- **`externalId` is the dedup key.** SCIM agents identify users by `externalId` on subsequent updates. The resolver matches inbound payloads to existing `User` rows by the field mapped from `externalId` (default: `User.external_id`); if that mapping is changed to something else, dedup follows the new target.
- **Per-org token scoping.** A SCIM token is scoped to one org (`ScimToken.organization_id`). Requests authenticated with it can only touch users + groups in the connection-provisioned population for that org. Cross-org provisioning needs one token per org.

## What's next

- [SCIM 2.0 setup — Okta](/guides/scim/okta/) — issuing a token, pasting the endpoint URL, configuring Okta's profile mapping.
- [SCIM 2.0 setup — Azure AD / Entra ID](/guides/scim/azure-ad/)
- [SCIM 2.0 setup — Google Workspace](/guides/scim/google-workspace/)
- [SCIM 2.0 setup — Rippling](/guides/scim/rippling/)
- [Enterprise SSO](/concepts/enterprise-sso/) — the sign-in-time half of the picture; SCIM handles lifecycle automation but isn't sufficient on its own to sign users in.
