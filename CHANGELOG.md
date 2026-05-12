# Changelog

## [0.6.0] — 2026-05-11

### Added

- **Concepts → Enterprise SSO** — the unified `EnterpriseConnection` model covering both SAML 2.0 and OIDC under one resource (with `protocol` discriminator + immutable scope choice), the instance-wide vs org-scoped split (`organization_id: null` vs set), the server-computed read-only URLs operators paste into the IdP (`saml_acs_url`, `saml_sp_entity_id`, `oidc_redirect_uri`), the write-only secret-handling story for `oidc_client_secret` + `saml_signing_key`, the five-key `attribute_mapping` shape with per-protocol defaults, and the persistent-link `EnterpriseAccount` resource (`User.enterprise_accounts[]`).
- **Concepts → SCIM attribute mapping** — the two-layer defaults + per-org override model, the standard SCIM path → authn.sh field mapping table, the `public_metadata.<key>` routing prefix, the Liquid expression syntax for value transforms (`downcase` / `split` / `replace` / `default`), and the resolver rules around `active: false` soft-delete, verified-true email writes, `externalId` dedup, and per-org token scoping.
- **Guides → Per-org SSO setup walkthrough** — the customer-side flow: org admin uses `<OrganizationProfile />` → **Single Sign-On** to add a connection, including the SAML metadata XML round-trip with SP-side EntityID / ACS pasted into the IdP, the OIDC discovery preview, the test-connection dry-run probe, going live, and the SP signing key story for SAML self-hosters (`AUTHN_SAML_SP_SIGNING_KEY_PATH` / `AUTHN_SAML_SP_SIGNING_KEY_B64` env vars on the server; mirrored by the chart and CDK construct).
- **Guides → Verified domains and enrollment modes** — DNS-TXT verification (`domain_dns_txt` strategy, the `_authn-domain-verify.<domain>` record, polling for verification), the email-code fallback, the three enrollment modes (`manual_invitation` / `automatic_invitation` / `automatic_suggestion`) with their behaviour on both plain sign-ups **and** enterprise-SSO sign-ins, the two enterprise-SSO routing failure modes (`enterprise_sso_no_connection`, `enterprise_sso_multiple_connections`), and how multi-connection domains stack during migrations.
- **Guides → SCIM 2.0 with Okta / Azure AD (Entra ID) / Google Workspace / Rippling** — one walkthrough per IdP covering the endpoint URL fetch, token issuance (plaintext-once contract), pasting URL + token into the IdP-side admin console, mapping recipes for the IdP's specific attribute shape (Okta groups → org roles; Entra's `?aadOptscim062020` query string; Google's single-`userName` shape and 15-minute cycle; Rippling's HR-driven enterprise-extension attributes), and per-vendor troubleshooting tables.
- **`<OrganizationProfile />` reference** additions — three new sections wired into the component (Single Sign-On, Directory Sync, Verified Domains) with their permission gates (`org:sys_enterprise_sso:manage` / `org:sys_provisioning:manage`).

### Changed

- **Webhooks concept** — event-type catalogue extended with the v0.6 events (`enterpriseConnection.created/updated/deleted`, `enterpriseAccount.connected/unlinked`, `scimToken.issued/revoked`, `scimUser.provisioned/deprovisioned`) including the `scimUser.*` payload triple (`{ user, enterprise_connection_id, organization_id }`). v0.4 names corrected to match the shipped surface (`externalAccount.connected`/`.unlinked`, `phoneNumber.created`/`.verified`/`.removed`; `smsTemplate.*` events do not exist).
- **REST reference** auto-rebuilt against the v0.6 OpenAPI bundle: `EnterpriseConnection`, `EnterpriseConnectionRequest`, `EnterpriseConnectionTestResult`, `EnterpriseAccount`, `ScimUser`, `ScimGroup`, `ScimToken`, `ScimAttributeMapping`, `ScimPatchOp`, `ScimListResponse`, `ScimError` schemas; BAPI `/v1/enterprise-connections` + `/v1/enterprise-accounts` CRUD; FAPI `/v1/organizations/{org_id}/enterprise-connections` + `/v1/organizations/{org_id}/scim/*` admin surface; IdP-facing `/scim/v2/Users` + `/scim/v2/Groups` + `/scim/v2/ServiceProviderConfig` / `ResourceTypes` / `Schemas`; SAML `/v1/saml/{id}/acs` + `/metadata` and OIDC `/v1/enterprise-sso-callback` browser callbacks.
- Sidebar reorganized — new top-level **SCIM 2.0** section listing the four IdP walkthroughs; **Concepts** adds Enterprise SSO + SCIM attribute mapping; **Guides** adds Per-org SSO setup + Verified domains.

## [0.5.0] — 2026-05-11

### Added

- **Concepts → Passkeys** — the `Passkey` resource shape (public surface vs server-side credential bytes), the WebAuthn registration ceremony (begin / complete steps, the `PasskeyCreationOptions` envelope, `exclude_credentials[]` semantics), the sign-in (assertion) ceremony, the four passkey-specific error codes (`passkey_no_credentials`, `passkey_assertion_invalid`, `passkey_origin_mismatch`, `passkey_user_handle_mismatch`), RP-ID + origin allowlist guidance for self-hosters, and the recovery flow matrix.
- **Customization → Theming** — the `Appearance` shape (variables / elements / layout), the full token + element-key catalogues, server-side editing via `PATCH /v1/instance/appearance` and the dashboard editor, client-side overrides via the `appearance` prop with deep per-key merge semantics, and four common recipes (brand-colour override, dark-mode palette, Tailwind-class layering, hidden optional fields).
- **Customization → Localization** — resolution order (active locale → overrides → fallback → hard fallback), the five shipped locales, the `Localization` shape, the dashboard editor + `PATCH` sparse-merge / `null`-deletes-key semantics, the public CORS-open `GET /v1/localization/{locale}` endpoint with `Cache-Control` + `ETag` guidance, `{variable}` and `{count, plural, …}` placeholder syntax, and a walkthrough for adding a new locale via `supported_locales[]` + a full override blob.
- **Social providers → Discord / Facebook / LinkedIn / X / GitLab / Slack** — one page per provider covering IdP-side app registration, default scopes, `attribute_mapping` defaults, and provider-specific footguns (Facebook's nested `picture.data.url`, X's missing `email`, Slack's "Sign in with Slack" vs "Add to Slack", GitLab self-managed instance via `custom_oidc`).
- **React components reference (v1)** — final prop reference for `<SignIn />`, `<SignUp />`, `<UserProfile />`, `<UserButton />`, `<OrganizationProfile />`, `<OrganizationSwitcher />`, including the `routing` / `path` / `appearance` / `localization` props, the internal state machines, custom-page slots (`<UserProfile.Page />`, `<OrganizationProfile.Page />`), and composition hooks for users who want finer-grained control.

### Changed

- **Webhooks concept** — event-type catalogue extended with the v0.4 events (`oauthProvider.*`, `externalAccount.*`, `phoneNumber.*`, `smsTemplate.*`) and the v0.5 events (`passkey.added`, `passkey.removed`, `instance.config.appearance_updated`, `localization.updated`). The two configuration events carry a `{ previous, current, diff }` triple so audit handlers can replay the change without diffing full blobs.
- **REST reference** auto-rebuilt against the v0.5 OpenAPI bundle: `Passkey`, `PasskeyCreationOptions`, `PasskeyRequestOptions`, `PasskeyAttestation`, `PasskeyAssertion`, `Appearance`, `Localization`, `LocalizationUpdateRequest` schemas; FAPI `/v1/me/passkeys` CRUD + `/begin-registration` / `/complete-registration/{cid}` ceremony paths; FAPI sign-in `Challenge.strategy: passkey` ceremony; BAPI `/v1/instance/appearance` + `/v1/instance/localization` (GET / PUT / PATCH); the public CORS-open FAPI `/v1/localization/{locale}` endpoint; six new preset `provider_key` values on `OauthProvider.yaml` (`discord`, `facebook`, `linkedin`, `x`, `gitlab`, `slack`).
- Sidebar reorganized — new top-level **Customization**, **Social providers**, and **React components** sections.

## [0.4.0] — 2026-05-10

### Added

- **Guides → Social sign-in** — overview of the four shipped presets (`google`, `github`, `apple`, `microsoft`), the `custom_oidc` vs `custom_oauth2` split, the canonical redirect-URI handoff, the toggle matrix (`enabled` / `allow_sign_in` / `allow_sign_up` / `block_email_subaddresses`), and per-provider `attribute_mapping` recipes.
- **Guides → Custom OIDC walkthrough** — step-by-step wizard for any standards-compliant OIDC IdP (Auth0, Okta, Keycloak, …). Covers issuer entry, discovery preview, the test-button probe, troubleshooting.
- **Guides → Custom OAuth2 walkthrough** — manual-endpoint variant for plain OAuth 2.0 IdPs without OIDC discovery, including `userinfo_method` / `userinfo_auth` semantics and the optional `_verified` mapping.
- **Guides → Phone numbers** — add, verify, primary-elect, reserve-for-MFA, default-second-factor handling, the reserved test-number range.
- **Guides → SMS MFA** — second-factor `phone_code` flow, picker semantics when both `totp` and `phone_code` are enabled, why SMS MFA is off by default.
- **Reference → Connected-accounts components** — `<SocialButtons />`, `<PhoneNumberField />`, `<ConnectedAccountsPanel />` props / slots / events / state machines, plus the `useExternalAccounts()` / `usePhoneNumbers()` hooks.
- **Reference → SMS templates** — the three seeded slugs (`verification_code`, `reset_password_code`, `invitation`), placeholder catalogue, `delivered_by_us` semantics, `from_number_override`, the `revert` endpoint.
- **Reference → SMS drivers** — Twilio + Vonage configuration matrix, `null` driver for dev, the reserved `+1 (555) 555-0100` – `0199` test range, env-var bootstrap keys.
- **Reference → JWT claims** — full catalogue including v0.4's `pnv` (phone-number-verified) and `dsf` (default-second-factor) claims, plus the `VerifiedClaims` accessor list.

### Changed

- **Sessions and tokens concept** — claim table extended with `tfe`, `mfa`, `pnv`, `dsf`. Pointer added to the new JWT claims reference.
- **REST reference** auto-rebuilt against the v0.4 OpenAPI bundle: `OauthProvider`, `ExternalAccount`, `PhoneNumber`, `SmsTemplate` schemas; the BAPI `/v1/oauth-providers` and `/v1/sms-templates` CRUD; the FAPI `/v1/me/external-accounts`, `/v1/me/phone-numbers`, and `/v1/oauth-callback/{provider_key}` paths; the `multi_factor.phone_code` instance-settings block; the `Environment.sms` bootstrap block.
- All code samples updated to the v0.4 SDK shape (`SocialButtons`, `PhoneNumberField`, `ConnectedAccountsPanel`, `useExternalAccounts`, `usePhoneNumbers`, `togglePhoneNumberReservedForSecondFactor`, `Authn.handleRedirectCallback`).

## [0.3.0] — 2026-05-10

### Added

- **Multi-factor authentication guide** — TOTP enrollment dance (start, scan QR, verify), backup codes (one-time reveal, regenerate), removing factors, BAPI operator overrides, instance settings table.
- **Second-factor sign-in walkthrough** — `needs_second_factor` state, `step: "second"` Challenges, `supported_strategies` narrowing per-user enrollment, backup code format (`xxxx-xxxx`).
- **Security section components reference** — `<TotpEnrollDialog />`, `<BackupCodesDialog />`, `<RemoveMfaDialog />` props / slots / state machines.

### Changed

- REST reference auto-rebuilt against the v0.3 OpenAPI bundle (TOTP + BackupCode + BackupCodeBatch schemas, MFA endpoints, MultiFactor instance settings).

## [0.2.0] — 2026-05-10

### Added

- **Guides → Organizations** — what an `Organization` is, creating via SDK / Account Portal / BAPI, inviting members, managing roles, active-organization concept + the JWT `org` claim flow, domain enrollment modes (manual / auto-invitation / auto-suggestion) + DNS verification.
- **Reference → Roles & Permissions** — the 13 system permissions catalog, the two seeded default roles (`org:admin`, `org:member`), creating custom roles via BAPI, per-platform helpers (`User::hasOrgPermission()`, `VerifiedClaims->hasPermission()`, `useOrganization().membership.hasPermission()`).
- **Guides → Magic-link sign-in** — when to use it vs email-code, same-device flow, cross-device polling (now keyed off `GET /challenges/{cid}`), transferable handling, replay protection, and the same Challenge dance for adding a new email to an existing account.
- **Domain enrollment** — DNS TXT verification documented as the standard challenge dance: client polls until `status: verified`, no more "trigger then refresh" guesswork.

### Changed

- **Sessions guide** — adds the `org` JWT claim section.
- **Webhooks guide** — adds the v0.2 event catalogue and the `organization` field on session events.
- **REST reference** auto-rebuilt from the v0.2 OpenAPI bundle: kebab-case URL paths, `Challenge` sub-resource, `EmailAddress` / `OrganizationDomain` flat shapes.
- All code samples in guides updated to the SDK 0.2.0 shape (`createChallenge` / `Challenge.answer()` / `currentChallenge` / `useOrganization`).

## [0.1.0] — 2026-05-03

Initial public docs site. Quickstart, Account Portal guide, REST reference, Sessions, Webhooks, JWT verification, SDK install pages.
