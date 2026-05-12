---
title: Verified domains and enrollment modes
description: DNS-TXT domain verification, the three enrollment modes (manual / auto-invitation / auto-suggestion), how they stack with enterprise-SSO routing, and the rare multi-connection-on-one-domain case.
---

A **verified `OrganizationDomain`** is the anchor for two independent behaviours in authn.sh:

- **Enrollment** — what happens to a sign-up whose email matches the domain (does the user get a membership immediately, get suggested as a candidate, or get nothing?).
- **Enterprise-SSO routing** (v0.6+) — when the org has at least one enterprise connection claiming the domain, sign-ins whose identifier domain matches are routed to that connection.

The two behaviours **stack independently**. The same `OrganizationDomain` can simultaneously auto-invite new sign-ups (enrollment) and route sign-ins through Okta (SSO routing). The matrix below covers every combination.

This guide picks up where [Organizations → Domain enrollment](/guides/organizations/#domain-enrollment) leaves off. Read the basics there first if you haven't.

## Verifying a domain (DNS TXT)

DNS-TXT is the recommended verification strategy — it doesn't require an inbox at the domain and lets operators publish the record asynchronously. The flow is the standard `Challenge` dance:

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../domains \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "acme.com", "enrollment_mode": "automatic_invitation" }'
```

```bash
curl -X POST https://<FAPI_URL>/v1/organizations/org_01.../domains/orgdom_01.../challenges \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "strategy": "domain_dns_txt" }'
```

The challenge response returns a `nonce`:

```json
{
  "id": "cha_01...",
  "strategy": "domain_dns_txt",
  "nonce": "_authn-domain-verify.acme.com TXT \"authn_<nonce>\"",
  "status": "pending"
}
```

The admin publishes that TXT record at `_authn-domain-verify.<domain>`. The server resolves it on every subsequent `GET` against the challenge — there's no separate "verify" call.

```bash
curl https://<FAPI_URL>/v1/organizations/org_01.../domains/orgdom_01.../challenges/cha_01... \
  -H "Authorization: Bearer <secret_key>"
```

When the record resolves, `status` flips to `verified` and `OrganizationDomain.verified` becomes `true`. From this point both enrollment and SSO routing are wired up — the domain has nothing more to configure on the verification side.

```tsx
import { useOrganization } from '@authn.sh/sdk-react';

const { organization } = useOrganization();

const domain = await organization.createDomain({
    name: 'acme.com',
    enrollmentMode: 'automatic_invitation',
});

const challenge = await domain.startVerification({ strategy: 'domain_dns_txt' });
// render challenge.nonce to the admin; poll challenge.reload() every ~5s
```

### The email-code alternative

For domains where DNS edits are gated by a separate team, an admin can fall back to email-code verification: an affiliation address at the domain (e.g. `admin@acme.com`) receives a 6-digit code, and the admin answers the challenge with it. Same `Challenge` shape, different `strategy` value:

```bash
curl -X POST .../domains/orgdom_01.../challenges \
  -d '{ "strategy": "email_code" }'

curl -X POST .../domains/orgdom_01.../challenges/cha_01.../answer \
  -d '{ "code": "123456" }'
```

`affiliation_email_address` on the `OrganizationDomain` is the target address — pre-populated to `admin@<domain>` on create; an admin can override.

## The three enrollment modes

`enrollment_mode` gates what happens **after a successful sign-up** whose email domain matches the verified domain. It does not affect existing members.

| Mode | Effect on plain (password / email-code / OAuth) sign-up | Effect on enterprise-SSO sign-up |
| ---- | ------------------------------------------------------- | -------------------------------- |
| `manual_invitation` | No automatic action. Members must be invited explicitly via `OrganizationInvitation`. | The user lands without an `OrganizationMembership` — the connection's `default_role` is ignored. They can still be invited later. |
| `automatic_invitation` | Sign-up auto-creates an `OrganizationInvitation` that immediately resolves to a membership at the org's default role. | JIT-provisions an `OrganizationMembership` at the connection's `default_role` (overriding the org default). |
| `automatic_suggestion` | Sign-up gets an `OrganizationMembershipRequest` an admin must approve. | Same — a membership request is still minted. Admin approval is required even though the IdP asserted the identity. |

### When to pick each

- **`manual_invitation`** — the default and the right pick for most B2B SaaS. Customer admins decide who's a member; SSO routing still works for users who already have memberships.
- **`automatic_invitation`** — appropriate when the customer treats every email at the domain as a trusted employee. Common pairing: a single-tenant deployment where the company's own staff IdP is the only sign-in source.
- **`automatic_suggestion`** — middle ground for orgs that want visibility into new sign-ups but won't grant access automatically. The pending requests render on `<OrganizationProfile />` → **Membership requests**.

### Switching modes

Modes can change any time — PATCH the domain:

```bash
curl -X PATCH https://<FAPI_URL>/v1/organizations/org_01.../domains/orgdom_01... \
  -H "Authorization: Bearer <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{ "enrollment_mode": "automatic_suggestion" }'
```

Switching only affects sign-ups from this moment on. Pending invitations and pending membership requests created under the previous mode are preserved — they sit in `total_pending_invitations` and `total_pending_suggestions` on the domain row until an admin actions them.

## Enterprise-SSO routing

When the org has at least one `EnterpriseConnection` whose `domains[]` includes a verified `OrganizationDomain.name`, sign-ins whose identifier domain matches are routed to that connection automatically. The server:

1. Resolves the domain from the identifier the user typed.
2. Looks up the matching `EnterpriseConnection` rows.
3. Narrows `SignIn.supported_strategies` to `["enterprise_sso"]` and populates `SignIn.enterprise_connection_id`.

```json
{
  "object": "sign_in",
  "id": "si_01...",
  "status": "needs_first_factor",
  "identifier": "alice@acme.example",
  "supported_strategies": ["enterprise_sso"],
  "enterprise_connection_id": "entcon_01...",
  "first_factor_verification": null,
  "created_at": 1714723000000
}
```

`<SignIn />` reads those fields and swaps its first-factor form for a single **Continue with Acme Okta** button. The button issues a `Challenge` with `strategy: enterprise_sso`, the response carries `external_verification_redirect_url`, and the SDK redirects the browser.

### Multi-connection domains

A domain can be claimed by more than one connection — rare, but legal during a migration (e.g. SAML → OIDC cutover) or a multi-IdP setup (some employees on the corporate Okta, some on a contractor-only Auth0).

When the resolver finds more than one match and the SDK didn't pass an explicit `connection_id`:

| Error | Payload |
| --- | --- |
| `enterprise_sso_multiple_connections` | `{ connections: [{ id, name }, …] }` — the candidate list. The SDK is expected to render a picker and re-issue the Challenge with `connection_id` set. |

When the resolver finds zero matches (the domain isn't claimed, or the only claiming connection is `enabled: false`):

| Error | When it fires |
| --- | --- |
| `enterprise_sso_no_connection` | The requested `connection_id` doesn't exist on the org, is disabled, or doesn't claim the identifier's domain. The SDK falls back to the org's other first-factor strategies. |

## Domain ownership and audit

`OrganizationDomain.verified` flipping false is **not** automatic — the platform doesn't poll the DNS record after the initial verification. If the customer drops the TXT record, the verification status survives. To force a re-verify, an admin POSTs a new challenge against the domain — the previous `current_challenge_id` is rotated and a fresh nonce is published.

For audit visibility into changes, the org events fire on every domain mutation:

```
organizationDomain.created
organizationDomain.updated
organizationDomain.deleted
```

`organizationDomain.updated` covers both `enrollment_mode` flips and changes to the `domains` array on the linked `EnterpriseConnection` (which is what wires up SSO routing). The full event-type catalogue is on [Concepts → Webhooks](/concepts/webhooks/).

## What's next

- [Enterprise SSO](/concepts/enterprise-sso/) — the connection model that drives the SSO-routing half of this guide.
- [Per-org SSO setup walkthrough](/guides/per-org-sso-setup/) — how an org admin wires up the IdP-side via `<OrganizationProfile />`.
- [SCIM 2.0 setup](/guides/scim/okta/) — directory sync on top of SSO routing for lifecycle automation.
