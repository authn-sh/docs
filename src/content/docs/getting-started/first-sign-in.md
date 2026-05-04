---
title: Your first sign-in flow
description: Drop a working sign-in into a fresh React app pointed at your local instance.
---

This guide assumes you've finished the [self-host quickstart](/getting-started/quickstart/) and have the operator dashboard open at `http://localhost:8080/dashboard`.

## 1. Create a project

From `/dashboard/create-project`, give the project a name + slug. The Dashboard provisions a `production` environment with a publishable key (`pk_live_…`) and a routing label like `wise-otter-x4f`. The publishable key encodes the Frontend API URL, so the SDK doesn't need a separate config call to discover it.

Copy the `pk_live_…` from **API keys** in the sidebar — you'll paste it into your app in step 3.

## 2. Spin up a React app

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install @authn-sh/sdk-react
```

## 3. Wrap your app in `<AuthnProvider>`

```tsx title="src/main.tsx"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthnProvider, SignedIn, SignedOut, SignIn, UserButton } from '@authn-sh/sdk-react'
import '@authn-sh/ui/styles.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_AUTHN_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthnProvider publishableKey={PUBLISHABLE_KEY}>
            <SignedIn>
                <UserButton />
                <p>You're signed in!</p>
            </SignedIn>
            <SignedOut>
                <SignIn routing="virtual" />
            </SignedOut>
        </AuthnProvider>
    </StrictMode>,
)
```

Set the publishable key in a `.env`:

```bash title=".env"
VITE_AUTHN_PUBLISHABLE_KEY=pk_live_…paste-yours-here
```

## 4. Sign someone up

`npm run dev`, open the Vite URL, and you'll see the `<SignIn />` form. Click "Sign up" to register a new user. The verification email lands in [Mailpit](http://localhost:8025) — copy the 6-digit code, paste it back into the form, and you're signed in.

## What just happened

- The SDK decoded `pk_live_…` to find your FAPI URL and called `GET /v1/environment` + `GET /v1/client` to bootstrap.
- Sign-up POSTed to `/v1/client/sign_ups`, then `prepare_verification` sent the email.
- After `attempt_verification`, the server set a `__session` HttpOnly cookie. `<SignedIn>` started rendering its children; `<UserButton>` mounted with the user's avatar.

Next stops:

- [API keys](/concepts/api-keys/) — when to use `pk_` vs `sk_`.
- [Sessions and tokens](/concepts/sessions-and-tokens/) — how the `__session` JWT works.
- [Verify JWTs in a backend](/guides/verify-jwt/) — read the operator's session from a Laravel / Express / FastAPI request.
