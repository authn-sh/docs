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

## v0.7 endpoints (BAPI)

### JWT templates {#jwt-templates-bapi}

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/jwt-templates` | List every `JwtTemplate` on the environment. |
| `POST` | `/v1/jwt-templates` | Create. `name` must be unique per env. `custom_signing_key` is write-only. |
| `GET` | `/v1/jwt-templates/{id}` | Fetch one. `custom_signing_key` is never returned. |
| `PATCH` | `/v1/jwt-templates/{id}` | Update name, claims, lifetime, allowed_clock_skew, signing_algorithm. Send `null` on `custom_signing_key` to clear. |
| `DELETE` | `/v1/jwt-templates/{id}` | Hard-delete. SDK calls to `getToken({ template: <name> })` thereafter fail with `404`. |
| `POST` | `/v1/users/{user_id}/jwt-templates/{name}/tokens` | Mint a token for a specific user — backend-issuance path with no browser session. |

### OAuth applications

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/oauth-applications` | List every `OauthApplication` on the environment. |
| `POST` | `/v1/oauth-applications` | Register a third-party app. **`client_secret` is returned exactly once on this response.** `is_public` is immutable. |
| `GET` | `/v1/oauth-applications/{id}` | Fetch one. `client_secret` is never included. |
| `PATCH` | `/v1/oauth-applications/{id}` | Update name, homepage_url, redirect_uris, scopes, consent_screen. `is_public` and `client_id` are immutable. |
| `DELETE` | `/v1/oauth-applications/{id}` | Hard-delete. Revokes every linked `AuthorizationGrant`. |
| `POST` | `/v1/oauth-applications/{id}/rotate-secret` | Mint a fresh `client_secret`. **No overlap window — old secret is invalidated immediately.** |
| `GET` | `/v1/oauth-applications/{id}/authorization-grants` | List every `AuthorizationGrant` for this app (operator view across all users). |
| `DELETE` | `/v1/oauth-applications/{id}/authorization-grants/{grant_id}` | Revoke a specific grant (operator unlink). |

### BAPI SCIM admin

The v0.6 deferral — operator-side mirror of the per-org FAPI SCIM surface.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/organizations/{org_id}/scim/endpoint` | Read the SCIM endpoint URL for the org. |
| `GET` | `/v1/organizations/{org_id}/scim/tokens` | List active + revoked `ScimToken` rows. Plaintext never returned. |
| `POST` | `/v1/organizations/{org_id}/scim/tokens` | Issue a SCIM token. **Plaintext returned exactly once.** |
| `POST` | `/v1/organizations/{org_id}/scim/tokens/{id}/revoke` | Revoke. |
| `GET` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Read the per-org override (or defaults when no override is set). |
| `PUT` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Replace the override. Empty `mapping: {}` reverts to defaults. |

### Enterprise accounts (admin)

Spec backfill — `EnterpriseAccount` listing / get / delete were live since v0.6 but not in the OpenAPI bundle.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/enterprise-accounts` | List every `EnterpriseAccount` on the env (filter by `user_id` / `enterprise_connection_id`). |
| `GET` | `/v1/enterprise-accounts/{id}` | Fetch one. |
| `DELETE` | `/v1/enterprise-accounts/{id}` | Admin unlink — preserves the underlying `User`. |

## v0.7 endpoints (FAPI)

### OAuth provider mode

All five are hosted on the FAPI server (the env's customer-facing origin). None of them live under `/v1/client/...` — they're top-level OAuth-spec endpoints.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/oauth/authorize` | Authorization-code grant entry point. Renders sign-in + consent, then `302` to `redirect_uri`. RFC 6749 §4.1 + OIDC §3.1.2.1. |
| `POST` | `/oauth/token` | Exchange `authorization_code` for tokens, or refresh-token grant. `client_secret_basic` / `client_secret_post` / `none` auth (per `is_public`). |
| `POST` | `/oauth/token_info` | Token introspection per RFC 7662. |
| `GET` | `/oauth/userinfo` | OIDC userinfo. Scope-filtered claims. Bearer-token auth. |
| `GET` | `/.well-known/openid-configuration` | OIDC discovery document. Public, CORS-open, cached 5 minutes. |

### User-scoped authorization grants

The signed-in user's view of their granted apps — backs `<UserProfile />`'s **Authorized apps** section.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me/oauth-authorization-grants` | List the user's active `AuthorizationGrant` rows. |
| `GET` | `/v1/me/oauth-authorization-grants/{id}` | Fetch one. |
| `DELETE` | `/v1/me/oauth-authorization-grants/{id}` | Revoke — hard-deletes the row. Subsequent third-party-app refresh calls return `401 invalid_grant`. |

## v0.6 endpoints (BAPI)

### Enterprise SSO (instance-wide)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/enterprise-connections` | List every `EnterpriseConnection` on the environment (instance-wide + org-scoped). |
| `POST` | `/v1/enterprise-connections` | Create a SAML or OIDC connection. `organization_id: null` for instance-wide; set to an `Organization.id` for org-scoped. Both `protocol` and `organization_id` are immutable after create. |
| `GET` | `/v1/enterprise-connections/{id}` | Fetch one. `oidc_client_secret` + `saml_signing_key` are never included — write-only. |
| `PATCH` | `/v1/enterprise-connections/{id}` | Update non-immutable fields. Send `null` on `oidc_client_secret` / `saml_signing_key` to clear. |
| `DELETE` | `/v1/enterprise-connections/{id}` | Soft-delete. Linked `EnterpriseAccount` rows survive for audit. |
| `POST` | `/v1/enterprise-connections/{id}/test` | Dry-run probe — discovery / JWKS / certificate / redirect-URI checks. Returns `EnterpriseConnectionTestResult`. Never redirects a real user. |
| `GET` | `/v1/enterprise-accounts` | List every `EnterpriseAccount` on the environment. |
| `GET` | `/v1/enterprise-accounts/{id}` | Fetch one. |
| `DELETE` | `/v1/enterprise-accounts/{id}` | Unlink — orphans the row from sign-in but preserves the audit trail. |

## v0.6 endpoints (FAPI)

### Org-scoped enterprise SSO

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/organizations/{org_id}/enterprise-connections` | List the org's connections. |
| `POST` | `/v1/organizations/{org_id}/enterprise-connections` | Create. `organization_id` on the body must match (or be omitted). Requires `org:sys_enterprise_sso:manage`. |
| `GET` | `/v1/organizations/{org_id}/enterprise-connections/{id}` | Fetch. |
| `PATCH` | `/v1/organizations/{org_id}/enterprise-connections/{id}` | Update. |
| `DELETE` | `/v1/organizations/{org_id}/enterprise-connections/{id}` | Soft-delete. |
| `POST` | `/v1/organizations/{org_id}/enterprise-connections/{id}/test` | Same dry-run probe as the BAPI counterpart. |

### SCIM 2.0 (IdP-facing — bearer-token auth)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/scim/v2/Users` | List provisioned users in the token's org. Supports SCIM filter / pagination. |
| `POST` | `/scim/v2/Users` | Provision a user. Fires `scimUser.provisioned`. |
| `GET` | `/scim/v2/Users/{id}` | Fetch one. |
| `PUT` | `/scim/v2/Users/{id}` | Full replace. |
| `PATCH` | `/scim/v2/Users/{id}` | SCIM patch operations. `active: false` triggers soft-delete + fires `scimUser.deprovisioned`. |
| `DELETE` | `/scim/v2/Users/{id}` | Hard-delete (rare — most IdPs use `active: false` instead). |
| `GET` | `/scim/v2/Groups` | List groups. |
| `POST` | `/scim/v2/Groups` | Create a group. |
| `GET` | `/scim/v2/Groups/{id}` | Fetch. |
| `PUT` / `PATCH` / `DELETE` | `/scim/v2/Groups/{id}` | Update / delete. |
| `GET` | `/scim/v2/ServiceProviderConfig` | Capability descriptor — IdPs probe this on connection test. |
| `GET` | `/scim/v2/ResourceTypes` | Supported SCIM resource types. |
| `GET` | `/scim/v2/Schemas` | Supported SCIM schemas. |

### Org-scoped SCIM admin (operator-facing — same auth as the rest of FAPI)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/organizations/{org_id}/scim/endpoint` | Read the SCIM endpoint URL the IdP admin pastes into their provisioning config. Returns `{ endpoint_url }`. Requires `org:sys_provisioning:read`. |
| `GET` | `/v1/organizations/{org_id}/scim/tokens` | List active + revoked `ScimToken` rows. Plaintext not returned. |
| `POST` | `/v1/organizations/{org_id}/scim/tokens` | Issue a fresh SCIM token — **plaintext returned exactly once on this response**. |
| `POST` | `/v1/organizations/{org_id}/scim/tokens/{id}/revoke` | Revoke. Subsequent SCIM requests with this token return `401`. |
| `GET` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Read the per-org override (returns the platform defaults when no override is set). |
| `PUT` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Replace the override. `PUT` with empty `mapping: {}` reverts to defaults. |

### SAML / OIDC callbacks (browser-only)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/saml/{id}/acs` | SAML AssertionConsumerService endpoint — the IdP POSTs the assertion here. Server validates against the connection's `saml_idp_certificate`. |
| `GET` | `/v1/saml/{id}/metadata` | SP metadata XML — the IdP ingests this URL to learn the SP's entity / ACS / signing-cert. |
| `GET` | `/v1/enterprise-sso-callback` | Shared OIDC redirect URI for every OIDC enterprise connection in the env. Connection is identified via the OAuth `state` parameter. |

## v0.4 endpoints (BAPI)

### Social sign-in (`OauthProvider`)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/oauth-providers` | List every `OauthProvider` row on the environment. |
| `POST` | `/v1/oauth-providers` | Create a `preset`, `custom_oidc`, or `custom_oauth2` row. |
| `GET` | `/v1/oauth-providers/{id}` | Fetch a single provider. `client_secret` is never included. |
| `PATCH` | `/v1/oauth-providers/{id}` | Update toggles, secret, scopes, attribute mapping. `provider_kind` and `provider_key` are immutable. |
| `DELETE` | `/v1/oauth-providers/{id}` | Soft-delete. Refused while `ExternalAccount` rows still link to this provider. |
| `POST` | `/v1/oauth-providers/{id}/test` | Dry-run probe — surfaces broken endpoints without redirecting any user. |

### SMS templates

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/sms-templates` | List the three seeded rows in slug order. |
| `GET` | `/v1/sms-templates/{slug}` | Fetch one. |
| `PATCH` | `/v1/sms-templates/{slug}` | Patch `body`, `delivered_by_us`, or `from_number_override`. |
| `POST` | `/v1/sms-templates/{slug}/revert` | Restore platform defaults. |

## v0.4 endpoints (FAPI)

### Connected accounts

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me/external-accounts` | List the signed-in user's `ExternalAccount` rows. |
| `GET` | `/v1/me/external-accounts/{id}` | Fetch one. |
| `DELETE` | `/v1/me/external-accounts/{id}` | Unlink (best-effort IdP-side revocation). |

### Phone numbers

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me/phone-numbers` | List the user's phone numbers. |
| `POST` | `/v1/me/phone-numbers` | Add a new phone number (always created unverified). |
| `GET` | `/v1/me/phone-numbers/{id}` | Fetch one. |
| `PATCH` | `/v1/me/phone-numbers/{id}` | Toggle `is_primary`, `reserved_for_second_factor`, `default_second_factor`. |
| `DELETE` | `/v1/me/phone-numbers/{id}` | Remove (refused while `reserved_for_second_factor: true`). |
| `POST` | `/v1/me/phone-numbers/{id}/challenges` | Issue a `phone_code` verification Challenge. |
| `POST` | `/v1/me/phone-numbers/{id}/challenges/{cid}/answer` | Answer with the 6-digit code. |
| `GET` | `/v1/me/phone-numbers/{id}/challenges/{cid}` | Poll Challenge status. |

### OAuth callback

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/oauth-callback/{provider_key}` | IdP redirect target — browsers only, never called by the SDK. |

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
