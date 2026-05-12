---
title: Per-org SSO setup walkthrough
description: How a customer org admin uses <OrganizationProfile /> to wire up their company's IdP — verified-domain check, SAML metadata XML round-trip, OIDC discovery preview, testing, and going live.
---

This walkthrough is the **customer-facing** path for adding an enterprise connection. The org admin in the customer organization does this in your product — they never touch your dashboard. The full surface lives behind `<OrganizationProfile />` → **Single Sign-On**, gated on `org:sys_enterprise_sso:manage`. Available from v0.6.

If you're configuring a **workspace-wide** connection (your own staff IdP, instance-wide scope) instead, you do that from your operator dashboard's **Authentication → Enterprise SSO**. The two surfaces share the same `EnterpriseConnection` resource and the same wire model — only the BAPI vs FAPI path prefix differs.

For the conceptual model behind connections, read [Enterprise SSO](/concepts/enterprise-sso/) first.

## Prerequisites

The org admin needs:

- A verified `OrganizationDomain` whose `name` matches the email domain employees will sign in with. Add and verify the domain first from **`<OrganizationProfile />` → Domains** if they haven't already — without a verified domain, the SSO routing has nothing to anchor to and sign-ins fall back to whatever the org's other strategies allow.
- Admin access to the IdP itself (Okta admin, Azure AD app-registration permission, Google Workspace SSO config, etc.).
- The `org:sys_enterprise_sso:manage` permission on their `OrganizationMembership`. The two seeded `org:admin` and `org:member` roles include / exclude it by default.

## Step 1 — Open the SSO panel

```tsx
import { OrganizationProfile } from '@authn.sh/sdk-react';

export default function OrgSettingsPage() {
  return <OrganizationProfile />;
}
```

The admin navigates to **Single Sign-On** in the section list and clicks **Add connection**. The wizard asks for two upfront choices:

- **Protocol** — SAML or OIDC. Pick OIDC when the IdP supports it (every modern IdP does); SAML is the lowest-common-denominator for older or air-gapped IdPs. The choice is immutable after create.
- **Connection name** — a human label, rendered on the sign-in screen when more than one connection is offered.

## Step 2A — SAML: metadata XML round-trip

For SAML, the wizard then displays the **SP-side metadata XML** the IdP needs to register the connection. The XML is served live at the connection's `saml_sp_entity_id` URL (`https://<env_slug>.authn.sh/v1/saml/<id>/metadata`), so the IdP can either ingest the URL directly or the admin can paste the XML body.

```xml
<EntityDescriptor entityID="https://acme.authn.sh/v1/saml/entcon_01HKX9SY9V7H7TF8C8K7J9X4ZA/metadata" ...>
  <SPSSODescriptor ...>
    <AssertionConsumerService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="https://acme.authn.sh/v1/saml/entcon_01HKX9SY9V7H7TF8C8K7J9X4ZA/acs"
        index="0"/>
    <!-- ... -->
  </SPSSODescriptor>
</EntityDescriptor>
```

Two values the admin must paste into the IdP's SAML app config — they're also surfaced as plain text next to the XML for IdPs that don't accept metadata ingest:

- **ACS URL** — `https://<env_slug>.authn.sh/v1/saml/<id>/acs`
- **SP EntityID / Audience** — `https://<env_slug>.authn.sh/v1/saml/<id>/metadata`

The IdP-side app, once created, hands back its own metadata. The wizard takes either of:

- The IdP's metadata URL (an `https://…/saml/metadata` endpoint) — the platform pulls it server-side and extracts the EntityID, SSO URL, and certificate.
- The IdP's metadata XML pasted into a textarea — same extraction.

Behind the scenes that boils down to one `POST /v1/organizations/{org_id}/enterprise-connections`:

```http
POST /v1/organizations/org_01.../enterprise-connections
Content-Type: application/json

{
  "protocol": "saml",
  "name": "Acme Okta",
  "domains": ["acme.example"],
  "saml_idp_entity_id": "https://idp.acme.example/saml/metadata",
  "saml_sso_url": "https://idp.acme.example/saml/sso",
  "saml_idp_certificate": "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----"
}
```

The server generates a `saml_signing_key` server-side at this point unless the admin uploaded one — see [SP signing key for SAML self-hosters](#sp-signing-key-for-saml-self-hosters) below.

## Step 2B — OIDC: discovery preview

For OIDC, the wizard asks for three things:

- **Issuer URL** — the IdP's OIDC base (e.g. `https://login.microsoftonline.com/<tenant>/v2.0`).
- **Client ID** — from the IdP-side OIDC app the admin just registered.
- **Client secret** — from the same app. PKCE-only IdPs can leave this blank.

The wizard then runs **discovery preview** — fetches `<issuer>/.well-known/openid-configuration` server-side and shows the admin what the platform found: the resolved `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, and the issuer's signing JWKS. If discovery fails (404, TLS error, wrong issuer), the wizard surfaces the underlying error inline so the admin can fix the issuer URL before saving.

The redirect URI the admin pastes back into the IdP-side OIDC app:

- **Redirect URI** — `https://<env_slug>.authn.sh/v1/enterprise-sso-callback`

Behind the scenes:

```http
POST /v1/organizations/org_01.../enterprise-connections
Content-Type: application/json

{
  "protocol": "oidc",
  "name": "Acme Azure AD",
  "domains": ["acme.example"],
  "oidc_issuer": "https://login.microsoftonline.com/<tenant>/v2.0",
  "oidc_client_id": "11111111-2222-3333-4444-555555555555",
  "oidc_client_secret": "<idp-issued secret>",
  "oidc_scopes": ["openid", "profile", "email"]
}
```

## Step 3 — Wire the domains

The wizard pre-fills `domains[]` with every verified `OrganizationDomain` on the org and lets the admin tick which ones should route to this connection. At least one ticked domain is the common case — that's what makes sign-in routing automatic for employees typing their company email on `<SignIn />`.

The admin can leave `domains[]` empty if they only want explicit "Sign in with Acme Okta" button flows and no automatic routing. The sign-in route then requires the SDK to pass `connection_id` explicitly.

## Step 4 — Test the connection

The wizard's **Test connection** button runs a dry-run probe — the same `POST /v1/organizations/{org_id}/enterprise-connections/{id}/test` endpoint the operator dashboard uses:

```http
POST /v1/organizations/org_01.../enterprise-connections/entcon_01.../test
```

The response is an `EnterpriseConnectionTestResult`:

```json
{
  "ok": true,
  "checks": [
    { "name": "discovery", "passed": true },
    { "name": "jwks", "passed": true },
    { "name": "redirect_uri_registered", "passed": true }
  ]
}
```

For SAML, the probe validates the IdP certificate's date validity, the SSO endpoint's HTTPS reachability, and the metadata round-trip. For OIDC, it re-runs discovery + JWKS fetch and verifies the `redirect_uri` is registered on the IdP side (when the IdP exposes that introspection — Auth0, Okta, and Azure AD do; Keycloak doesn't, so the check is skipped with `skipped: true`).

The test never redirects a real user, so the admin can re-run it as many times as they want while wiring up the IdP-side app.

## Step 5 — Go live

When the test passes, the admin flips the **Enabled** toggle. From this moment:

- Sign-ins whose email matches one of the ticked `domains[]` are routed to this connection automatically — `<SignIn />` swaps the password / email-code form for a "Continue with Acme Okta" button.
- Explicit `enterprise_sso` strategy challenges with `connection_id` succeed.

To roll back: flip the toggle to disabled. Existing `EnterpriseAccount` rows survive — they're just unusable for sign-in until the connection is re-enabled.

## SP signing key for SAML self-hosters

Self-hosted deployments using SAML can configure a **single SP signing key** for the whole authn.sh instance, used to sign every outbound AuthnRequest / LogoutRequest. This is separate from the per-connection IdP certificate (which signs inbound assertions).

You don't strictly need the SP signing key — connections without one fall back to unsigned AuthnRequests, which the vast majority of IdPs accept. You'll want one when:

- Your IdP rejects unsigned AuthnRequests (some Azure AD / ADFS configurations).
- Your compliance posture demands signed SP-side requests.
- You want signed LogoutRequests so the IdP can match them against a known SP cert.

Configure the key via one of two env vars on the authn.sh server:

| Env var | Description |
| --- | --- |
| `AUTHN_SAML_SP_SIGNING_KEY_PATH` | Filesystem path to a PEM-encoded private key. Preferred — pair with a k8s secret volume or an ECS secret mount. |
| `AUTHN_SAML_SP_SIGNING_KEY_B64` | Base64-encoded PEM as an inline env value. Use when you can't mount a file. |

Set exactly one of the two. If both are set, `AUTHN_SAML_SP_SIGNING_KEY_PATH` wins.

The chart documents the same keys in `values.yaml`; the CDK construct exposes them via the typed `enterpriseSso.samlSpSigningKeySecretArn` config block (which wires `AUTHN_SAML_SP_SIGNING_KEY_B64` from a SecretsManager secret into the ECS task definition).

Rotation is a no-deploy operation if you're using `AUTHN_SAML_SP_SIGNING_KEY_PATH` — write the new PEM to the mounted secret and the next process restart picks it up. No connection-level fields need to change.

## What's next

- [Verified domains and enrollment modes](/guides/verified-domains/) — how the org's `enrollment_mode` interacts with first-time enterprise-SSO sign-ins.
- [SCIM 2.0 setup](/guides/scim/okta/) — adding lifecycle automation on top of SSO so the IdP can provision / deprovision users without manual sign-in.
- [`<OrganizationProfile />`](/sdk/react/components/organization-profile/) — the full component reference including the SSO / Directory Sync / Verified Domains sections.
