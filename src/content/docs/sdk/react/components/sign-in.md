---
title: <SignIn />
description: The bundled sign-in flow component — every supported first-factor and second-factor strategy out of the box.
---

`<SignIn />` renders the complete sign-in flow — identifier entry, strategy picking, OAuth redirects, magic-link / email-code / SMS-code verification, passkey assertion, second-factor prompts — without you wiring any of it. It's the v1 entry-point component you drop into a `/sign-in` page.

Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { SignIn } from '@authn.sh/sdk-react';

export default function SignInPage() {
  return <SignIn />;
}
```

The component reads the environment config at mount, surfaces every enabled first-factor strategy (password / email-code / email-link / phone-code / OAuth providers / passkey), drives second-factor challenges (TOTP / backup codes / phone-code) when the user has them, and on success either calls `routing` to navigate the user away or invokes the `afterSignInUrl`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `routing` | `'path' \| 'hash' \| 'virtual'` | `'path'` | How the component navigates between internal steps. `path` mutates `window.location.pathname`; `hash` mutates the hash; `virtual` keeps everything in-memory (useful when embedded in a modal). |
| `path` | `string` | `'/sign-in'` | Base path for `routing: 'path'`. The component appends `/factor-one`, `/factor-two`, `/reset-password`, etc. |
| `signUpUrl` | `string` | — | Where to send users who click the "Sign up" footer link. Defaults to the environment's sign-up URL. |
| `afterSignInUrl` | `string` | environment `home_url` | Where to send users on successful sign-in. Overridable per-render. |
| `afterSignUpUrl` | `string` | environment `home_url` | Where to send users who completed a transferable sign-up triggered from this `<SignIn />` (e.g. a magic-link recipient with no existing account). |
| `redirectUrl` | `string` | the OAuth callback handler | Used as the OAuth `redirect_uri` instead of the canonical environment value. Self-hosters with custom routing topologies use this to keep OAuth callbacks on a stable domain. |
| `initialValues` | `Partial<SignInFormValues>` | `{}` | Pre-fills the identifier form (e.g. `{ emailAddress: 'user@example.com' }` when you ship users from a prior interstitial). |
| `appearance` | `Appearance` | — | Per-render appearance override; merged with the per-environment `Environment.appearance` blob. See [Theming](/customization/theming/). |
| `localization` | `Localization` | — | Per-render localization override; merged with the per-environment `Environment.localization` blob. See [Localization](/customization/localization/). |
| `transferable` | `boolean` | `true` | When `true`, an email-code / email-link aimed at an address with no existing `User` automatically transfers into a sign-up. Set `false` to refuse transfers (sign-up must happen via `<SignUp />`). |
| `forceRedirectUrl` | `string` | — | Skips `routing` and forces the post-sign-in redirect to this URL regardless of `afterSignInUrl`. Used by deep-link recovery flows. |

## State

Internal state machine the component walks:

```
start            → identifier entry, strategy picker
factor_one       → first-factor verification (password / email-code / magic-link / phone-code / passkey / oauth)
factor_two       → second-factor prompt (totp / backup-code / phone-code)
verifying        → strategy verification in flight (e.g. magic-link polling)
complete         → session minted, redirect imminent
```

Each state has its own internal page. With `routing: 'path'` the URL reflects the state (`/sign-in/factor-one`, `/sign-in/factor-two`); with `routing: 'virtual'` the user sees a single URL for the whole flow.

## Composition

`<SignIn />` is monolithic by design. If you need to compose individual sub-flows yourself, use the hooks under [`@authn.sh/sdk-react` → hooks](https://github.com/authn-sh/javascript/tree/main/packages/sdk-react):

- `useSignIn()` — drive a sign-in by hand.
- `useUser()` — current `User` once signed in.
- `useSession()` — current `Session`.

The hooks expose the same surfaces `<SignIn />` uses internally; everything `<SignIn />` does is reachable from user code.
