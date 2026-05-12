---
title: Webhooks
description: Endpoint setup, retries, signature scheme.
---

authn.sh emits webhooks for the lifecycle events your backend needs to react to (a user signing up, a session ending, an email being verified). Endpoints are configured per environment from the Dashboard.

## Setup

In the Dashboard, **Webhooks → Add endpoint**. You give:

- The receiving URL (HTTPS in production, HTTP allowed in local).
- The events to subscribe to. The default is `*` (everything).

The Dashboard returns a signing secret once on creation. Store it on your backend; we hash it at rest.

## Delivery

Each event fires a `POST <url>` with a JSON body:

```json
{
  "object": "event",
  "id": "evt_01K…",
  "type": "user.created",
  "occurred_at": 1733428800000,
  "environment_id": "env_01K…",
  "data": {
    "user": { "object": "user", "id": "user_01K…", "first_name": "Jane", ... }
  }
}
```

Headers worth caring about:

| Header | Notes |
| ------ | ----- |
| `Authn-Signature` | One or more `v1,<base64-hmac>` segments separated by `,`. |
| `Authn-Webhook-Id` | The delivery ID. Idempotent retries reuse this. |
| `Authn-Webhook-Timestamp` | Unix-ms timestamp signed into the body. Reject if older than 5 minutes. |
| `Authn-Event-Type` | Convenience copy of `data.type`. |

## Retries

Failed deliveries (anything that doesn't return 2xx within 30s) retry with exponential backoff: 1m, 5m, 30m, 1h, 6h, 12h, then a final attempt at 24h. After the last attempt, the delivery is marked `failed` and visible in the Dashboard's Webhooks → Deliveries table.

## Signature scheme

The signature is `HMAC-SHA256(secret, "<id>.<timestamp>.<body>")`, base64-encoded:

```
signed_payload = $webhook_id . "." . $webhook_timestamp . "." . $raw_body
signature      = base64(hmac_sha256($secret, $signed_payload))
header         = "v1,$signature"
```

During a rotation window, two `v1,...` segments are sent — verify against either. See [verify webhook signatures](/guides/verify-webhooks/) for code.

## Event types

### v0.1

```
user.created
user.updated
user.deleted
session.created
session.ended
session.removed
session.revoked
email.created
invitation.created
invitation.accepted
invitation.revoked
```

### v0.2

```
session.touched
organization.created
organization.updated
organization.deleted
organizationMembership.created
organizationMembership.updated
organizationMembership.deleted
organizationInvitation.created
organizationInvitation.accepted
organizationInvitation.revoked
organizationDomain.created
organizationDomain.updated
organizationDomain.deleted
organizationMembershipRequest.created
organizationMembershipRequest.accepted
organizationMembershipRequest.rejected
role.created
role.updated
role.deleted
permission.created
permission.updated
permission.deleted
```

The `data` field of each event carries the full resource snapshot — `Organization`, `OrganizationMembership`, `OrganizationInvitation`, `OrganizationDomain`, `OrganizationMembershipRequest`, `Role`, or `Permission` — so handlers don't need a follow-up fetch in most cases. Magic-link sign-in/sign-up does not introduce its own event type; the outgoing email is reported via the existing `email.created` event.

### v0.4

```
oauthProvider.created
oauthProvider.updated
oauthProvider.deleted
externalAccount.connected
externalAccount.unlinked
phoneNumber.created
phoneNumber.verified
phoneNumber.removed
```

`data` carries `OauthProvider`, `ExternalAccount`, or `PhoneNumber`. The `externalAccount.*` pair fires when a user links / unlinks an IdP via `<SocialButtons />`; `phoneNumber.verified` fires when the verify-challenge resolves (separate from the `phoneNumber.created` row creation, since the row is created unverified).

### v0.5

```
passkey.added
passkey.removed
instance.config.appearance_updated
localization.updated
```

The two passkey events carry a `Passkey` resource on `data`. The two configuration events carry a `{ previous, current, diff }` triple — the `diff` is shaped like the corresponding `PATCH` request body (`Appearance` for appearance, `LocalizationUpdateRequest` for localization), so audit handlers can replay the change without diffing the full blobs themselves.

### v0.6

```
enterpriseConnection.created
enterpriseConnection.updated
enterpriseConnection.deleted
enterpriseAccount.connected
enterpriseAccount.unlinked
scimToken.issued
scimToken.revoked
scimUser.provisioned
scimUser.deprovisioned
```

`data` carries:

- `enterpriseConnection.*` → `EnterpriseConnection`. The write-only secrets (`oidc_client_secret`, `saml_signing_key`) are **never** in the payload — encrypted at rest.
- `enterpriseAccount.*` → `EnterpriseAccount`. Fires on first SSO sign-in (`connected`) and on operator unlink (`unlinked`).
- `scimToken.*` → `ScimToken`. The plaintext `token` is **never** in the payload — only the `prefix`. Captures token issuance / revocation for audit handlers.
- `scimUser.*` → `{ user: User, enterprise_connection_id, organization_id }`. The triple carries the connection that drove the SCIM operation plus the scoping org, so audit handlers can route without a follow-up lookup.

### v0.7

```
jwtTemplate.created
jwtTemplate.updated
jwtTemplate.deleted
oauthApplication.created
oauthApplication.updated
oauthApplication.deleted
authorizationGrant.granted
authorizationGrant.revoked
```

`data` carries:

- `jwtTemplate.*` → `JwtTemplate`. The write-only `custom_signing_key` is **never** in the payload — same write-only contract as the GET responses.
- `oauthApplication.*` → `OauthApplication`. The write-only `client_secret` is **never** in the payload — even on `oauthApplication.created`, the only place plaintext is surfaced is the BAPI create response.
- `authorizationGrant.*` → `AuthorizationGrant`. Fires when a user first consents (`granted`) and on revocation (`revoked` — both user-driven via `<UserProfile />` and operator-driven via BAPI). `meta.surface` distinguishes `"user"` from `"operator"`.

The live list is published via `GET /v1/event-types` against the BAPI.
