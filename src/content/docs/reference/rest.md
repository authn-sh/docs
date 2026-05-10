---
title: REST API reference
description: Full BAPI + FAPI reference, generated from the OpenAPI spec.
---

The REST reference is generated from the [`authn-sh/openapi`](https://github.com/authn-sh/openapi) bundled spec. The build pipeline pulls `openapi.bundled.json` from its tagged release and renders the full reference here.

- **Backend API (BAPI)** — server-to-server, secret-key authenticated. Source: [`routes/bapi.php`](https://github.com/authn-sh/authn/blob/main/authn/routes/bapi.php).
- **Frontend API (FAPI)** — browser-facing, publishable-key + Client-cookie authenticated. Source: [`routes/fapi.php`](https://github.com/authn-sh/authn/blob/main/authn/routes/fapi.php).
- **`/.well-known/jwks.json`** — per-environment JWKS. Source: [`JwksController`](https://github.com/authn-sh/authn/blob/main/authn/app/Http/Controllers/WellKnown/JwksController.php).

## Conventions

- All timestamps are Unix milliseconds (numbers, not strings).
- All IDs are prefixed ULIDs — `user_…`, `sess_…`, `org_…`, `evt_…`. Treat as opaque strings.
- Errors follow the envelope `{ "errors": [{ "code", "message", "long_message", "meta" }], "trace_id" }`.
- Pagination is opaque cursor-based: `?cursor=<token>&limit=<n>`. Responses include `meta.next_cursor` when more rows exist.

## v0.3 endpoints (BAPI)

### MFA admin overrides

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/users/{id}/verify-totp` | Verify a user's TOTP code server-side (returns `{ verified: bool }`). |
| `DELETE` | `/v1/users/{id}/mfa` | Reset all MFA factors for a user — deletes TOTP secret and all backup codes. |

## v0.3 endpoints (FAPI)

### TOTP enrollment

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/me/totp` | Start TOTP enrollment — returns QR code, `otpauth_uri`, and plaintext secret (one-time). |
| `POST` | `/v1/me/totp/verify` | Confirm enrollment by submitting the first generated 6-digit code. |
| `DELETE` | `/v1/me/totp` | Remove the signed-in user's TOTP secret. |

### Backup codes

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/me/backup-codes` | (Re)generate backup codes — plaintext returned exactly once. |
| `DELETE` | `/v1/me/backup-codes` | Delete all unused backup codes for the signed-in user. |

## v0.2 endpoints (BAPI)

### Organizations

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/organizations` | List organizations (cursor-paginated). |
| `POST` | `/v1/organizations` | Create an organization. |
| `GET` | `/v1/organizations/{id}` | Get a single organization. |
| `PATCH` | `/v1/organizations/{id}` | Update name, slug, image, metadata. |
| `DELETE` | `/v1/organizations/{id}` | Delete an organization. |
| `GET` | `/v1/organizations/{id}/memberships` | List members. |
| `POST` | `/v1/organizations/{id}/memberships` | Add a member directly. |
| `PATCH` | `/v1/organizations/{id}/memberships/{membership_id}` | Change a member's role. |
| `DELETE` | `/v1/organizations/{id}/memberships/{membership_id}` | Remove a member. |
| `GET` | `/v1/organizations/{id}/invitations` | List invitations. |
| `POST` | `/v1/organizations/{id}/invitations` | Create an invitation. |
| `POST` | `/v1/organizations/{id}/invitations/bulk` | Bulk-create invitations. |
| `POST` | `/v1/organizations/{id}/invitations/{inv_id}/revoke` | Revoke a pending invitation. |
| `GET` | `/v1/organizations/{id}/domains` | List verified domains. |
| `POST` | `/v1/organizations/{id}/domains` | Add a domain. |
| `PATCH` | `/v1/organizations/{id}/domains/{domain_id}` | Update enrollment mode. |
| `DELETE` | `/v1/organizations/{id}/domains/{domain_id}` | Remove a domain. |
| `POST` | `/v1/organizations/{id}/domains/{domain_id}/challenges` | Create a domain-verification challenge (`dns_txt` or `email_code`). |
| `POST` | `/v1/organizations/{id}/domains/{domain_id}/challenges/{cid}/answer` | Submit the email code to answer a challenge. |
| `GET`  | `/v1/organizations/{id}/domains/{domain_id}/challenges/{cid}` | Poll challenge status (`dns_txt` resolves automatically on poll). |

### Roles & Permissions

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/roles` | List roles. |
| `POST` | `/v1/roles` | Create a custom role. |
| `GET` | `/v1/roles/{id}` | Get a single role. |
| `PATCH` | `/v1/roles/{id}` | Update a role's name / description / flags. |
| `DELETE` | `/v1/roles/{id}` | Delete a custom role. |
| `PUT` | `/v1/roles/{id}/permissions` | Replace a role's permission set. |
| `GET` | `/v1/permissions` | List permissions (system + custom). |

## v0.2 endpoints (FAPI)

### User-scoped organization access

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me/organization-memberships` | List the signed-in user's memberships. |
| `GET` | `/v1/me/organization-invitations` | List the user's pending invitations. |
| `POST` | `/v1/me/organization-invitations/{inv_id}/accept` | Accept an invitation. |
| `GET` | `/v1/me/organization-membership-requests` | List the user's membership requests. |
| `GET` | `/v1/organizations/{id}` | Get an org the user is a member of. |
| `GET` | `/v1/organizations/{id}/memberships` | List an org's members (user-scoped). |
| `POST` | `/v1/organizations/{id}/invitations` | Invite a member (requires `org:sys_memberships:manage`). |
| `POST` | `/v1/organizations/{id}/leave` | Leave an organization. |
| `PATCH` | `/v1/client/sessions/{sid}/active-organization` | Set the active organization. |

### Email address verification

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/me/email-addresses/{id}/challenges` | Issue an `email_code` or `email_link` verification challenge. |
| `POST` | `/v1/me/email-addresses/{id}/challenges/{cid}/answer` | Answer a challenge (code string, or empty body for `email_link`). |
| `GET`  | `/v1/me/email-addresses/{id}/challenges/{cid}` | Poll challenge status. |

### Challenges (sign-in)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ins/{sid}/challenges` | Issue a challenge; server picks `step` from sign-in state. |
| `POST` | `/v1/client/sign-ins/{sid}/challenges/{cid}/answer` | Answer a challenge (password, code, or empty body for `email_link`). |
| `GET`  | `/v1/client/sign-ins/{sid}/challenges/{cid}` | Fetch challenge — used for magic-link cross-device polling. |

### Challenges (sign-up)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ups/{sid}/challenges` | Issue a verification challenge on a sign-up. |
| `POST` | `/v1/client/sign-ups/{sid}/challenges/{cid}/answer` | Answer a sign-up challenge. |
| `GET`  | `/v1/client/sign-ups/{sid}/challenges/{cid}` | Fetch challenge — used for magic-link cross-device polling. |

### Handshake

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/client/handshake` | Consume a `__authn_ticket` from the clicked magic link. |
