# Changelog

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
