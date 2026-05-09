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
| `POST` | `/v1/organizations/{id}/domains/{domain_id}/verify` | Submit verification proof. |

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
| `GET` | `/v1/me/organization_memberships` | List the signed-in user's memberships. |
| `GET` | `/v1/me/organization_invitations` | List the user's pending invitations. |
| `POST` | `/v1/me/organization_invitations/{inv_id}/accept` | Accept an invitation. |
| `GET` | `/v1/me/organization_membership_requests` | List the user's membership requests. |
| `GET` | `/v1/organizations/{id}` | Get an org the user is a member of. |
| `GET` | `/v1/organizations/{id}/memberships` | List an org's members (user-scoped). |
| `POST` | `/v1/organizations/{id}/invitations` | Invite a member (requires `org:sys_memberships:manage`). |
| `POST` | `/v1/organizations/{id}/leave` | Leave an organization. |
| `PATCH` | `/v1/client/sessions/{sid}/active_organization` | Set the active organization. |

### Magic-link

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign_ins/{sign_in_id}/prepare_first_factor` | Prepare `email_link` — sends the magic-link email. |
| `POST` | `/v1/client/sign_ins/{sign_in_id}/attempt_first_factor` | Poll / complete on originating device. |
| `GET` | `/v1/client/handshake` | Consume a `__authn_ticket` from the clicked link. |
