---
title: Localization
description: How authn.sh resolves translated strings, the five shipped locales, and how operators tweak copy per-environment.
---

The bundled components render every user-facing string through a localization layer. Five locales ship with canonical catalogs in `@authn.sh/sdk-react`; operators tweak copy per-locale from the dashboard without rebuilding the SDK.

Localization is available from v0.5 of authn.sh.

## How resolution works

For every key the SDK renders, the runtime walks four sources in order. The first source that has a non-`null` value for the key wins:

```
default_catalog[active_locale]
  ⊕ overrides[active_locale]             ← operator's per-locale tweak
  ⊕ default_catalog[fallback_locale]     ← used for keys the active locale didn't translate
  ⊕ overrides[fallback_locale]
  ⊕ (per-key hard fallback, baked into the SDK)
```

This means:

- **Canonical defaults** are shipped with the SDK and updated through SDK releases — `0.5.x` ships a complete `en-US` catalogue.
- **Operator overrides** are sparse — you only set the keys you want to change. Unmentioned keys fall through to the canonical default.
- **Fallback locale** picks up the slack when the active locale doesn't translate a specific key (typical for niche keys an operator added for `en-US` but hasn't translated yet for `pt-BR`).
- **Per-key hard fallback** is the absolute floor — every key in the SDK has a baked-in English string the runtime emits if literally everything else is missing. You'll never see a raw key in the UI.

## The five shipped locales

| BCP-47 | Language |
| --- | --- |
| `en-US` | English (United States) |
| `pt-BR` | Portuguese (Brazil) |
| `es-ES` | Spanish (Spain) |
| `fr-FR` | French (France) |
| `de-DE` | German (Germany) |

The SDK exposes the active locale via `useLocale()` and the language picker via `<UserButton />`'s **Language** affordance. The active locale is resolved as:

1. The user's `User.public_metadata.locale` if set.
2. The browser's `Accept-Language` header, intersected with `supported_locales[]`.
3. `default_locale` from the environment's `Localization` config.

## The `Localization` shape

Per-environment configuration stored as `Environment.localization`:

```ts
interface Localization {
  default_locale: string;
  fallback_locale: string;
  supported_locales: string[];
  overrides: Record<string, Record<string, string>>;
}
```

| Field | Description |
| --- | --- |
| `default_locale` | BCP-47 tag used when the SDK can't read a user preference. Must be in `supported_locales`. |
| `fallback_locale` | BCP-47 tag the SDK falls back to per-key when the active locale doesn't have a translation. Typically `en-US`. |
| `supported_locales` | The locales the SDK surfaces in the language picker and auto-detects from `Accept-Language`. Must include `default_locale` and `fallback_locale`. |
| `overrides` | Per-locale operator overrides. Outer key is a BCP-47 tag; inner map is dot-keyed canonical keys to translated strings. |

Locales not present in the bundled default catalog **must** have a full override blob — the BAPI validator returns `unsupported_locale` if a caller adds an entry to `supported_locales[]` without a matching default or override. This is the affordance for shipping a sixth (or 60th) locale before authn.sh upstreams it.

## The dashboard editor

Open **Dashboard → Configure → Localization**. The editor:

- Renders side-by-side **canonical / override** columns per locale, so you see exactly what's being overridden.
- Shows the `{variable}` and `{count, plural, …}` placeholders inline with validation — the save button is disabled if your override drops a required placeholder.
- Lives-previews the changes against the bundled `<SignIn />` / `<SignUp />` / `<UserProfile />` components.

Each save goes to `PATCH /v1/instance/localization` — a sparse merge. Setting a key's value to `null` in the PATCH body **deletes** that single override (the key falls back to the canonical default) without affecting the rest of the locale.

A full overwrite is available via `PUT /v1/instance/localization` for export / import flows. The current blob is readable via `GET /v1/instance/localization` (BAPI, operator auth) or as `Environment.localization` on the FAPI `GET /v1/environment` response (public, used by the SDK at boot).

### Public localization endpoint

The SDK also fetches the live override map for each locale via a CORS-open FAPI path:

```http
GET /v1/localization/{locale}
```

Hit on every Account Portal / SDK page load. The response carries:

- `Cache-Control: public, max-age=300, stale-while-revalidate=3600` — five-minute fresh window, hour-long stale-revalidate window.
- An `ETag` that mirrors `Environment.localization.override_etag` — operator edits invalidate it immediately.

If you front your FAPI host with your own CDN, respect those headers so that operator edits in the dashboard propagate to end-user browsers within seconds rather than hours. See [Operating an instance](https://github.com/authn-sh/helm#operating-an-instance) in the helm README for details.

## Placeholder syntax

Two interpolation flavours, both standard ICU MessageFormat subsets:

### `{variable}` — simple substitution

```text
"signIn.start.greeting": "Welcome back, {firstName}!"
```

The SDK substitutes the variable at render time. If the variable is missing from the context, the placeholder is left untouched (it's a bug for the SDK to call into a key without supplying the expected variable; we surface it loudly in dev mode).

### `{count, plural, …}` — pluralisation

```text
"reference.passkeys.count": "{count, plural, one {# passkey} other {# passkeys}}"
```

Standard CLDR plural categories: `zero`, `one`, `two`, `few`, `many`, `other`. Not every locale uses every category — the SDK picks the right branch based on the active locale's CLDR plural rules. `#` substitutes the count.

Locale-aware number formatting comes for free (`1,234` in `en-US`, `1.234` in `de-DE`) because the SDK runs the substitution through `Intl.PluralRules` + `Intl.NumberFormat`.

## Adding a new locale

If your environment needs a locale outside the five shipped ones — say, `ja-JP`:

1. Translate the canonical catalogue from `@authn.sh/sdk-react`. The full catalogue is exported as `defaultLocaleCatalogues['en-US']` for convenience.
2. POST the override blob:

   ```http
   PATCH /v1/instance/localization
   Content-Type: application/json

   {
     "supported_locales": ["en-US", "pt-BR", "es-ES", "fr-FR", "de-DE", "ja-JP"],
     "overrides": {
       "ja-JP": {
         "signIn.start.title": "サインイン",
         "signIn.start.subtitle": "メールアドレスを入力してください",
         "...": "..."
       }
     }
   }
   ```

3. Users with `Accept-Language: ja` (and no `User.public_metadata.locale` override) will see the new locale immediately.

If you'd like a locale upstreamed into the SDK so other operators can pick it up without an override blob, contributions are welcome — the canonical catalogues live in [authn-sh/javascript](https://github.com/authn-sh/javascript) under `packages/sdk-react/src/locales/`. (Translations of these docs themselves are post-v1.0.)

## Error codes

The localization BAPI validator can refuse a `PATCH` with:

| Code | When it fires |
| --- | --- |
| `invalid_locale_code` | A key in `supported_locales[]` or `overrides` isn't a syntactically valid BCP-47 tag. |
| `unsupported_locale` | A locale was added to `supported_locales[]` without an entry in `overrides` and isn't in the bundled default catalog. |
| `unknown_localization_key` | An `overrides[locale]` dictionary contains a key that isn't in the canonical SDK catalogue. The catalogue is the source of truth; if you need a new key, that's an SDK contribution. |

## Webhook events

Edits emit a `localization.updated` webhook event with the previous + current blob and a diff. Useful for audit pipelines, for caches that want to invalidate proactively, or for cross-environment sync if you want to mirror copy from a staging environment to production.
