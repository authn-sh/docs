# Changelog

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
