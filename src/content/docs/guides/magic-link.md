---
title: Magic-link sign-in
description: Passwordless sign-in via a click-through email link, covering same-device and cross-device flows.
---

The `email_link` strategy sends a one-time link instead of a code. The user clicks it in their email client; authn.sh validates the ticket and completes sign-in. No code to copy — just a click.

## When to use it vs email-code

| | `email_code` | `email_link` |
| --- | --- | --- |
| User action | Type 6 digits | Click a link |
| Works across devices | Yes | Yes (with polling) |
| Copy-paste friction | Yes | No |
| Replay protection | Inherent (one-time code) | Signed, expiring ticket |

`email_link` is better for transactional, one-shot sign-in flows where friction is the main concern. `email_code` is better when the user is expected to complete sign-in on the same session tab.

## Same-device flow

The simplest case: the user opens their email on the same device and browser where they started sign-in.

1. Call `prepareFirstFactor` with `strategy: email_link` and a `redirect_url`.
2. The user receives an email with the magic link.
3. The link opens in the browser, hitting `GET /v1/client/handshake?__authn_ticket=…&redirect_url=…`.
4. `clientHandshake` validates the ticket and sets `__client` — the session is now active.
5. The browser is redirected to `redirect_url`.

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

function MagicLinkSignIn() {
    const { signIn, isLoaded } = useSignIn();

    const send = async (email: string) => {
        await signIn.create({ identifier: email });

        await signIn.prepareFirstFactor({
            strategy: 'email_link',
            emailAddressId: signIn.supportedFirstFactors
                ?.find((f) => f.strategy === 'email_link')
                ?.emailAddressId ?? '',
            redirectUrl: `${window.location.origin}/sso-callback`,
        });
    };

    if (!isLoaded) return null;

    return (
        <form onSubmit={(e) => { e.preventDefault(); send(new FormData(e.currentTarget).get('email') as string); }}>
            <input name="email" type="email" required />
            <button type="submit">Send magic link</button>
        </form>
    );
}
```

Mount `<MagicLinkLanding />` at the `redirect_url` path to handle the landing:

```tsx
import { MagicLinkLanding } from '@authn.sh/sdk-react';

<MagicLinkLanding
    afterSignInUrl="/dashboard"
    afterSignUpUrl="/welcome"
/>;
```

`<MagicLinkLanding />` reads `__authn_ticket` from the query string, calls `clientHandshake`, and redirects to the appropriate URL once sign-in completes.

## Cross-device flow

The user starts sign-in on a laptop, opens the email on their phone, and clicks the link there. The laptop tab must poll until the click resolves.

authn.sh handles this via the `__client` cookie. The originating device polls `getClient` while the other device completes the handshake:

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

function MagicLinkSignInWithPolling() {
    const { signIn } = useSignIn();

    const send = async (email: string) => {
        await signIn.create({ identifier: email });

        const factor = signIn.supportedFirstFactors?.find(
            (f) => f.strategy === 'email_link',
        );

        await signIn.prepareFirstFactor({
            strategy: 'email_link',
            emailAddressId: factor?.emailAddressId ?? '',
            redirectUrl: `${window.location.origin}/sso-callback`,
        });

        // SDK polls getClient automatically; subscribe to status changes
        signIn.on('status_change', (status) => {
            if (status === 'complete') {
                window.location.href = '/dashboard';
            }
        });
    };
}
```

The SDK polls every 2 seconds via `POST /v1/client/sessions/{sid}/tokens` on the originating device. When the other device clicks the link and `clientHandshake` validates the ticket, the session on the originating device transitions to `complete` on the next poll.

The cross-device poll window expires after 10 minutes. If the user hasn't clicked by then, the sign-in must be restarted.

## Transferable flow

If the user who clicks the link has no account, they are transferred to sign-up automatically. `<MagicLinkLanding />` handles this transparently — pass both `afterSignInUrl` and `afterSignUpUrl` and the component routes to the right one.

You can also handle it manually:

```ts
import { authn } from '@authn.sh/sdk-js';

const signIn = authn.client.signIn;
const result = await signIn.attemptFirstFactor({ strategy: 'email_link' });

if (result.status === 'needs_transfer') {
    // Create a sign-up using the email from the sign-in attempt
    const signUp = await authn.client.signUp.create({
        transfer: true,
    });
    // continue sign-up flow
}
```

## Replay protection

Every magic-link ticket is:

- **Single-use** — consumed on the first valid `clientHandshake` call.
- **Time-limited** — expires after 10 minutes (same as the cross-device poll window).
- **Bound to the environment** — tickets signed by one FAPI URL are rejected by others.

Replaying the link after it's been used returns `422 magic_link_expired`.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ins/{sign_in_id}/prepare-first-factor` | Prepare `email_link` factor — sends the email. |
| `POST` | `/v1/client/sign-ins/{sign_in_id}/attempt-first-factor` | Poll / attempt `email_link` on the originating device. |
| `GET`  | `/v1/client/handshake` | Consume a `__authn_ticket` and complete the session. |
