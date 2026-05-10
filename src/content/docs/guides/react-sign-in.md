---
title: Embed <SignIn /> in a React app
description: Drop the hosted sign-in form into your own React surface.
---

The shortest path is the [first sign-in flow](/getting-started/first-sign-in/) walkthrough — a fresh Vite app pointed at your local instance. Use this page as a reference for the configuration knobs that apply once you're past hello-world.

## Mount points

Every authn.sh React component lives under `<AuthnProvider>`:

```tsx
<AuthnProvider
    publishableKey="pk_live_…"
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    signInFallbackRedirectUrl="/dashboard"
    signUpFallbackRedirectUrl="/welcome"
    afterSignOutUrl="/sign-in"
>
    {children}
</AuthnProvider>
```

The provider boots the SDK and wires up the React context the components read from.

## Routing modes for `<SignIn />` / `<SignUp />`

The form transitions through internal steps (`factor-one`, `factor-two`, `verify-email-address`). Pick how those step changes show up in the URL:

| Mode | URL behavior | Use when |
| ---- | ------------ | -------- |
| `routing="virtual"` | URL stays at `/sign-in`. Steps live in component state. | One-route mounts. The simplest option. |
| `routing="path"` | URL changes to `/sign-in/factor-one` etc. | You want deep-linkable steps. Requires a wildcard route. |
| `routing="hash"` | Step lives in `#hash`. | Static hosts where you can't add wildcard routes. |

Default is `path`. `virtual` is what the bundled Account Portal uses.

## Pages with the SDK that aren't `<SignIn />`

- `<SignUp />` — same shape; pair with a `/sign-up` route.
- `<UserProfile />` — full account-management surface (emails, password, sessions). Needs a `/user/*` wildcard route.
- `<UserButton />` — the avatar dropdown.
- `<SignedIn>` / `<SignedOut>` — boundary components that render their children based on auth state.
- `<RedirectToSignIn>` — kicks signed-out visitors to your sign-in URL.

A worked tenant integration ships in v0.1.x; for now, the [Account Portal source](https://github.com/authn-sh/authn/tree/main/resources/js/account-portal) is the canonical example.

## Multi-factor authentication

When a user has MFA enrolled, `<SignIn />` automatically presents the second-factor step after the first factor succeeds — no additional configuration needed. To build a custom second-factor UI or manage enrollment, see:

- [Multi-factor authentication](/guides/multi-factor-authentication/) — TOTP enrollment and backup code management.
- [Second-factor sign-in](/guides/second-factor-sign-in/) — what `needs_second_factor` looks like and how to issue and answer second-factor challenges.
- [Security section components](/reference/security-components/) — the `<TotpEnrollDialog />`, `<BackupCodesDialog />`, and `<RemoveMfaDialog />` pre-built components.

## Adding and verifying email addresses

When a user adds a secondary email via `<UserProfile />` or your own form, the new address starts unverified. Verification is a `Challenge` on the `EmailAddress` resource — the same pattern used for sign-in verification.

Both `email_code` and `email_link` strategies are available:

```ts
import { useUser } from '@authn.sh/sdk-react';

const { user } = useUser();

const emailAddress = user.emailAddresses.find(e => e.id === targetId);

const challenge = await emailAddress.createChallenge({ strategy: 'email_code' });

await challenge.answer({ code: userInput });
```

For `email_link`, omit the code and poll instead:

```ts
const challenge = await emailAddress.createChallenge({ strategy: 'email_link' });

await challenge.answer({});

challenge.on('status_change', (status) => {
    if (status === 'verified') {
        console.log('email verified');
    }
});
```

Once the challenge reaches `status: verified`, `EmailAddress.verified` flips to `true` and `current_challenge_id` clears to `null`. `<UserProfile />` handles this automatically — no custom code needed if you're using the component.
