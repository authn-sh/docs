---
title: <SignUp />
description: The bundled sign-up flow component — identifier entry, verification, optional profile fields, organization invitations.
---

`<SignUp />` renders the complete sign-up flow — identifier entry, identifier verification (email code / email link / phone code), optional first-name / last-name capture, password / passkey enrollment when required, and the post-sign-up handoff (organization invitation acceptance, automatic active-org selection).

Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { SignUp } from '@authn.sh/sdk-react';

export default function SignUpPage() {
  return <SignUp />;
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `routing` | `'path' \| 'hash' \| 'virtual'` | `'path'` | How the component navigates between internal steps. |
| `path` | `string` | `'/sign-up'` | Base path for `routing: 'path'`. |
| `signInUrl` | `string` | — | Where to send users who click "Already have an account? Sign in". Defaults to the environment's sign-in URL. |
| `afterSignUpUrl` | `string` | environment `home_url` | Where to send users on successful sign-up. |
| `afterSignInUrl` | `string` | environment `home_url` | Used when the sign-up flow transfers into a sign-in (e.g. magic-link recipient who already has an account). |
| `redirectUrl` | `string` | the OAuth callback handler | OAuth `redirect_uri` override. |
| `initialValues` | `Partial<SignUpFormValues>` | `{}` | Pre-fills `{ emailAddress, firstName, lastName, phoneNumber }`. |
| `appearance` | `Appearance` | — | Per-render appearance override. |
| `localization` | `Localization` | — | Per-render localization override. |
| `unsafeMetadata` | `Record<string, unknown>` | — | Forwarded as `User.unsafe_metadata` on creation. |
| `forceRedirectUrl` | `string` | — | Forces the post-sign-up redirect to this URL regardless of `afterSignUpUrl`. |

## State

```
start         → identifier entry + optional fields
verifying     → identifier verification in flight (email-code / magic-link / phone-code)
missing_requirements → environment requires a field the form didn't capture (e.g. password)
complete      → User created, session minted, redirect imminent
```

The `missing_requirements` state is the affordance for environments that require, e.g., a password on sign-up. The component renders the missing-field prompt automatically — there's no extra wiring.

## Organization invitations

If a user arrives at `<SignUp />` via an organization invitation link (the `?__authn_ticket=...` query param), the component:

1. Verifies the ticket against `/v1/me/invitations/accept`.
2. Pre-fills the email field with the invited address and locks editing.
3. After verification, automatically adds the new `User` to the inviting `Organization` and sets it as `User.active_organization`.

No extra props required — the component reads the ticket from the URL.
