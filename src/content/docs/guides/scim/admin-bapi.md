---
title: SCIM admin via BAPI
description: Issue, list, and revoke SCIM tokens programmatically from your backend using $authn->organizations()->scimTokens() and the matching JS SDK call.
---

In v0.6, SCIM token issuance was per-org and FAPI-only — operators provisioned tokens through `<OrganizationProfile />` in the customer-facing UI. v0.7 adds the **BAPI mirror** so operators can issue and rotate SCIM tokens server-side without going through the FAPI surface. Available from v0.7. Closes the v0.6 carryover.

This walkthrough covers the BAPI flow. For the customer-facing flow through `<OrganizationProfile />`, see the per-IdP [SCIM walkthroughs](/guides/scim/okta/).

## When to use the BAPI path

- **Onboarding automation.** You're scripting a customer-org setup and want to mint a SCIM token in the same migration that creates the org, the verified domain, and the enterprise connection.
- **Token rotation.** You're rotating SCIM tokens on a schedule (every 90 days, say) and want a server-side cron rather than a human clicking through the UI.
- **Multi-org reconciliation.** You want one daily report that lists every active SCIM token across every org with their last-used timestamps.
- **Operator backstop.** Your customer org's admin lost their token and can't get back in to issue a fresh one — operator support mints a replacement via BAPI.

## The endpoints

The full set mirrors the v0.6 FAPI surface, scoped to an org:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/v1/organizations/{org_id}/scim/endpoint` | Read the SCIM endpoint URL the IdP admin will paste into their provisioning config. |
| `GET` | `/v1/organizations/{org_id}/scim/tokens` | List active + revoked `ScimToken` rows. Plaintext never returned. |
| `POST` | `/v1/organizations/{org_id}/scim/tokens` | Issue a fresh SCIM token. **Plaintext returned exactly once on this response.** |
| `POST` | `/v1/organizations/{org_id}/scim/tokens/{id}/revoke` | Revoke. Subsequent SCIM requests with the token return `401`. |
| `GET` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Read the per-org override (returns platform defaults when no override is set). |
| `PUT` | `/v1/organizations/{org_id}/scim/attribute-mappings` | Replace the override. Empty `mapping: {}` reverts to defaults. |

All six are BAPI keys — server-side, secret-key authenticated, never browser-exposed. No FAPI capability gate or permission check (the BAPI key is the auth boundary).

## PHP — `$authn->organizations()->scimTokens()`

The `sdk-php` `OrganizationsManager` exposes a `scimTokens` sub-manager:

```php
use Authnsh\Authn\AuthnClient;

$authn = new AuthnClient(['secret_key' => env('AUTHN_SECRET_KEY')]);

// Issue a fresh token for org_abc
$result = $authn->organizations()->scimTokens()->create('org_abc', [
    'description' => 'Issued by ops cron 2026-05-12',
]);

// Plaintext is on the create response — save it immediately.
echo $result->token;            // "scim_5Z4Q9k…" — never appears again
echo $result->prefix;           // "scim_5Z4Q…" — appears on every subsequent GET
echo $result->id;               // "scimtkn_01J7Z…"

// List tokens
foreach ($authn->organizations()->scimTokens()->list('org_abc') as $row) {
    printf("%s — prefix=%s revoked_at=%s\n", $row->id, $row->prefix, $row->revoked_at ?? 'never');
}

// Revoke
$authn->organizations()->scimTokens()->revoke('org_abc', 'scimtkn_01J7Z…');
```

The matching `AttributeMappings` sub-manager:

```php
// Read (returns defaults when no override is set)
$mapping = $authn->organizations()->scimAttributeMappings()->get('org_abc');

// Replace
$authn->organizations()->scimAttributeMappings()->put('org_abc', [
    'mapping' => [
        'userName' => 'email_address',
        'name.givenName' => 'first_name',
        'name.familyName' => 'last_name',
        'externalId' => 'external_id',
        'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.department'
            => 'public_metadata.department',
    ],
]);

// Reset to platform defaults
$authn->organizations()->scimAttributeMappings()->put('org_abc', ['mapping' => []]);
```

## JavaScript — `authn.organizations.scimTokens`

The matching shape on `@authn-sh/sdk-js`:

```typescript
import { Authn } from '@authn-sh/sdk-js';

const authn = new Authn({ secretKey: process.env.AUTHN_SECRET_KEY! });

// Issue
const { token, prefix, id } = await authn.organizations.scimTokens.create('org_abc', {
  description: 'Issued by ops cron 2026-05-12',
});

console.log(token);  // "scim_5Z4Q9k…" — save now

// List
const rows = await authn.organizations.scimTokens.list('org_abc');

// Revoke
await authn.organizations.scimTokens.revoke('org_abc', id);

// Read endpoint URL (for surfacing in your dashboard or in a customer-facing email)
const { endpoint_url } = await authn.organizations.scimEndpoint.get('org_abc');
```

## Onboarding flow

The full automate-from-scratch flow for a new B2B customer:

```php
// 1. Create the org
$org = $authn->organizations()->create(['name' => 'Acme Inc.', 'slug' => 'acme']);

// 2. Add and verify the domain
$domain = $authn->organizations()->domains()->create($org->id, [
    'name' => 'acme.example',
    'enrollment_mode' => 'automatic_invitation',
]);
// (then operator-side prompt to add the DNS TXT and call /verify)

// 3. Add the enterprise SSO connection (Okta in this example)
$conn = $authn->enterpriseConnections()->create([
    'protocol' => 'saml',
    'organization_id' => $org->id,
    'name' => 'Acme Okta',
    'domains' => ['acme.example'],
    'saml_idp_entity_id' => $oktaMetadata->entity_id,
    'saml_sso_url' => $oktaMetadata->sso_url,
    'saml_idp_certificate' => $oktaMetadata->certificate,
]);

// 4. Mint the SCIM token
$scim = $authn->organizations()->scimTokens()->create($org->id, [
    'description' => 'Onboarding cron, ticket #4711',
]);

// 5. Email the IdP admin everything they need
Mail::to($adminEmail)->send(new ScimOnboardingMail([
    'org_name'        => $org->name,
    'scim_endpoint'   => $authn->organizations()->scimEndpoint()->get($org->id)->endpoint_url,
    'scim_token'      => $scim->token,  // ← only chance — survives only inside this request
    'okta_app_id'     => $oktaApp->id,
]));
```

The `scim_token` plaintext lives **only** in the response of the `create` call. Save it immediately — even your audit log shouldn't store it (store the `prefix` instead). The email handler above includes it in transit only.

## Rotation cron

```php
// Run weekly. Rotates any token issued more than 90 days ago.
foreach (Organization::active()->cursor() as $org) {
    $tokens = $authn->organizations()->scimTokens()->list($org->authn_id);
    foreach ($tokens as $row) {
        if ($row->revoked_at !== null) continue;
        if (now()->diffInDays($row->created_at_carbon) < 90) continue;

        // Mint replacement, distribute it, then revoke the old one.
        $replacement = $authn->organizations()->scimTokens()->create($org->authn_id, [
            'description' => "Auto-rotation, replaces {$row->id}",
        ]);

        ScimRotationMail::dispatch($org, $replacement->token);

        $authn->organizations()->scimTokens()->revoke($org->authn_id, $row->id);
    }
}
```

There's no overlap window — the IdP's provisioning config must be updated to the new token before you revoke the old one. The typical pattern is to mint the replacement, send it to the customer with a deadline (e.g. "rotate within 7 days"), and only revoke the old token after the deadline.

## Webhook events

The BAPI surface fires the same `scimToken.issued` and `scimToken.revoked` events as the FAPI surface. The plaintext token is **never** in the event payload — only the `prefix`. Audit handlers can distinguish BAPI-issued tokens from FAPI-issued ones via the `event.meta.surface` field (`"bapi"` vs `"fapi"`).

## Permissions

There's no permission gate — the BAPI key is the auth boundary. Anyone with the env's BAPI secret can issue, list, and revoke SCIM tokens for any org in the env. If you want per-ops-engineer audit trails, distribute scoped BAPI keys (`POST /v1/api-keys` with `restricted_to_actions: ['organizations.scim_tokens.*']`) rather than sharing the env's primary key.
