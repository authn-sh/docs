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
