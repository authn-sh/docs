---
title: Theming
description: Customize the visual appearance of authn.sh's bundled components — colours, typography, layout, per-element class overrides.
---

The bundled components (`<SignIn />`, `<SignUp />`, `<UserProfile />`, `<UserButton />`, …) are customisable along three axes: **CSS design tokens**, **per-element className overrides**, and **structural layout toggles**. The configuration is per-environment; once an operator sets it, every consumer of the SDK in that environment picks it up automatically without a code change.

Theming is available from v0.5 of authn.sh.

## The `Appearance` shape

Three blocks, every block optional, every key inside it optional. Missing keys mean "use the default":

```ts
interface Appearance {
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorTextOnPrimary?: string;
    colorInputBackground?: string;
    colorInputText?: string;
    colorDanger?: string;
    colorSuccess?: string;
    colorWarning?: string;
    colorNeutral?: string;
    fontFamily?: string;
    fontFamilyButtons?: string;
    fontSize?: string;
    borderRadius?: string;
    spacingUnit?: string;
  };
  elements?: Record<ElementName, string>;
  layout?: {
    logoImageUrl?: string | null;
    logoLinkUrl?: string | null;
    socialButtonsPlacement?: 'top' | 'bottom';
    socialButtonsVariant?: 'blockButton' | 'iconButton';
    showOptionalFields?: boolean;
    privacyPageUrl?: string | null;
    termsPageUrl?: string | null;
    helpPageUrl?: string | null;
    animations?: boolean;
  };
}
```

### `variables` — CSS design tokens

A loose-string map applied as CSS custom properties on the component root. The server doesn't validate hex vs `rgb()` vs named colours — whatever you write round-trips. Lengths can be `px`, `rem`, `em`, `%`.

```json
{
  "variables": {
    "colorPrimary": "#0a84ff",
    "colorTextOnPrimary": "#ffffff",
    "borderRadius": "0.5rem",
    "fontFamily": "Inter, system-ui, sans-serif"
  }
}
```

The full token catalogue:

| Token | Applied to |
| --- | --- |
| `colorPrimary` | Buttons, focus rings, links. |
| `colorBackground` | Card / surface background. |
| `colorText` | Default body text colour. |
| `colorTextOnPrimary` | Text rendered on top of `colorPrimary` (e.g. primary button labels). |
| `colorInputBackground` | Form input background. |
| `colorInputText` | Form input text colour. |
| `colorDanger` | Destructive / error accent (delete buttons, validation errors). |
| `colorSuccess` | Success accent (verified states, success banners). |
| `colorWarning` | Warning accent (pending verification, caution banners). |
| `colorNeutral` | Neutral accent (secondary buttons, muted text). |
| `fontFamily` | Default font for body copy. |
| `fontFamilyButtons` | Button typography. Falls back to `fontFamily`. |
| `fontSize` | Base font size (e.g. `"14px"`, `"1rem"`). |
| `borderRadius` | Component corner radius. |
| `spacingUnit` | Spacing scale unit; multiplied for padding / gap. |

### `elements` — per-element className overrides

A map keyed by stable element names. Values are space-separated className strings the SDK **appends** to the default class list. This is the affordance for layering Tailwind / utility classes on top of authn.sh's defaults without owning the markup.

```json
{
  "elements": {
    "card": "shadow-2xl border border-slate-700",
    "formButtonPrimary": "tracking-wide uppercase",
    "formFieldInput": "ring-1 ring-slate-700"
  }
}
```

The catalogue of stable element keys:

| Element key | Targets |
| --- | --- |
| `formButtonPrimary` | Primary submit buttons. |
| `formButtonReset` | Secondary / cancel buttons. |
| `formFieldInput` | All `<input>` elements. |
| `formFieldLabel` | `<label>` text above fields. |
| `formFieldErrorText` | Field-level validation error text. |
| `card` | The outer card / dialog surface. |
| `headerTitle` | Card title (e.g. "Sign in"). |
| `headerSubtitle` | Card subtitle. |
| `dividerLine` | The horizontal rule between social buttons and form. |
| `dividerText` | The "or" label that floats over the divider. |
| `socialButtonsBlockButton` | OAuth provider buttons in `blockButton` variant. |
| `socialButtonsProviderIcon` | Provider icon inside a social button. |
| `footerActionLink` | "Don't have an account? Sign up" footer link. |
| `userPreviewMainIdentifier` | The user's email / name in `<UserButton />` and `<UserProfile />`. |
| `userPreviewSecondaryIdentifier` | The user's secondary identifier (typically a handle / org). |
| `userButtonAvatarBox` | `<UserButton />`'s avatar circle. |
| `userButtonPopoverActionButton` | Action rows inside the `<UserButton />` popover. |

Unknown keys are ignored — the SDK only honours the stable catalogue.

### `layout` — structural toggles

Structural opts applied to the component shell:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `logoImageUrl` | `string \| null` | `null` | Image rendered above the card title. `null` hides the logo. |
| `logoLinkUrl` | `string \| null` | environment `home_url` | Where the logo links to when clicked. |
| `socialButtonsPlacement` | `'top' \| 'bottom'` | `'top'` | Render the OAuth provider buttons above or below the identifier form. |
| `socialButtonsVariant` | `'blockButton' \| 'iconButton'` | `'blockButton'` | `blockButton` — labelled "Continue with Google" buttons stacked vertically. `iconButton` — icon-only buttons laid out horizontally. |
| `showOptionalFields` | `boolean` | `true` | When `false`, fields the environment marks as `optional` (e.g. `first_name`, `last_name`) are hidden on the sign-up form. |
| `privacyPageUrl` | `string \| null` | `null` | Linked from the footer / sign-up legal copy. |
| `termsPageUrl` | `string \| null` | `null` | Linked from the footer / sign-up legal copy. |
| `helpPageUrl` | `string \| null` | `null` | Linked from the help affordance in `<UserProfile />`. |
| `animations` | `boolean` | `true` | When `false`, the SDK uses `prefers-reduced-motion`-style static styling. |

## Server-side appearance — the dashboard editor

Open **Dashboard → Configure → Appearance**. The editor renders the same `<SignIn />`, `<SignUp />`, `<UserProfile />`, `<UserButton />` your end users see, in a live preview pane. Edits propagate through the existing FAPI surface:

- Each save call goes to `PATCH /v1/instance/appearance` — a sparse merge against the current blob.
- A full overwrite is available via `PUT /v1/instance/appearance` if you want to replace the entire shape (useful for export / import flows).
- The current blob is readable via `GET /v1/instance/appearance` (BAPI, operator auth) or as `Environment.appearance` on the FAPI `GET /v1/environment` response (public, used by the SDK at boot).

The FAPI response wraps the blob with an `etag` — `sha256(canonical-JSON(appearance))` — so the SDK can short-circuit re-renders when the config hasn't changed.

### Cache + edit propagation

The FAPI surface for `GET /v1/environment` serves with `ETag` + a short `Cache-Control` window. Edits saved in the dashboard propagate to end-user browsers within a few seconds (the SDK revalidates on focus + per-page-load), so designers can iterate against a real production-style preview.

Self-hosters running their own CDN in front of the FAPI host should respect the `Cache-Control` headers the app emits — see [Operating an instance](https://github.com/authn-sh/helm#operating-an-instance) in the helm README for details.

## Client-side appearance — the `appearance` prop

When you want to override appearance in just one consumer (e.g. embed authn in a customer-portal page with a custom palette) without touching the per-environment config, pass an `appearance` prop directly to the component. The prop and the server-side blob are merged at render time:

```tsx
import { SignIn } from '@authn.sh/sdk-react';

<SignIn
  appearance={{
    variables: {
      colorPrimary: '#7c3aed',
    },
    elements: {
      formButtonPrimary: 'font-mono uppercase tracking-widest',
    },
  }}
/>
```

### Merge semantics

The merge is **per-key**, deep, with the prop winning:

- `variables` — token-by-token override. Keys absent from the prop fall through to the server blob; keys absent from both fall to the SDK default.
- `elements` — className strings from prop and server are **concatenated** (not overwritten). This is intentional — operators can establish a brand baseline via the dashboard, and a specific embed can layer additional utility classes on top without losing the baseline.
- `layout` — key-by-key override. Same fall-through as `variables`.

To explicitly null-out a server-side value from the prop, pass `null`:

```tsx
<SignIn appearance={{ layout: { logoImageUrl: null } }} />
```

This hides the operator-configured logo in just this embed, without touching the dashboard setting.

## Common recipes

### Brand colour override

Just the primary accent — most consumers won't need anything else:

```json
{
  "variables": {
    "colorPrimary": "#0a84ff",
    "colorTextOnPrimary": "#ffffff"
  }
}
```

### Dark-mode palette

Full token sweep for an inverted theme:

```json
{
  "variables": {
    "colorPrimary": "rgb(10 132 255)",
    "colorBackground": "#0b1220",
    "colorText": "#e6edf3",
    "colorTextOnPrimary": "#ffffff",
    "colorInputBackground": "#111827",
    "colorInputText": "#e6edf3",
    "colorDanger": "#f87171",
    "colorSuccess": "#34d399",
    "colorWarning": "#fbbf24",
    "colorNeutral": "#9ca3af"
  }
}
```

### Tailwind-style custom button

The default primary button gets Tailwind utility classes layered on top:

```json
{
  "elements": {
    "formButtonPrimary": "tracking-wide uppercase shadow-lg hover:shadow-xl"
  }
}
```

The SDK's own primary-button class still applies underneath — the override appends rather than replaces.

### Hide optional sign-up fields

Sign-ups with the absolute minimum identifier-and-password surface:

```json
{
  "layout": {
    "showOptionalFields": false
  }
}
```

`first_name` / `last_name` (when they're marked optional on the environment) disappear from the sign-up form. Required fields are unaffected.

### Icon-only social buttons at the bottom of the form

```json
{
  "layout": {
    "socialButtonsPlacement": "bottom",
    "socialButtonsVariant": "iconButton"
  }
}
```

## Webhook events

When operator-driven edits happen, the FAPI emits an `instance.config.appearance_updated` webhook event with the previous + current blob and a diff. Useful for audit pipelines or for caches that want to invalidate proactively rather than wait for the next ETag check.
