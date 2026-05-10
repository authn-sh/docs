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

1. Create a sign-in, then `POST .../challenges { strategy: "email_link", redirect_url }` — the server emails the magic link and returns a `Challenge` in `pending` status.
2. Call `POST .../challenges/{cid}/answer {}` — the empty body commits the SDK to the out-of-band path.
3. The user receives the email and clicks the link, hitting `GET /v1/client/handshake?__authn_ticket=…`.
4. `clientHandshake` validates the ticket and sets `__client` — the session is now active.
5. The browser is redirected to `redirect_url`.

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

function MagicLinkSignIn() {
    const { signIn, isLoaded } = useSignIn();

    const send = async (email: string) => {
        await signIn.create({ identifier: email });

        const challenge = await signIn.createChallenge({
            strategy: 'email_link',
            redirectUrl: `${window.location.origin}/sso-callback`,
        });

        await challenge.answer({});
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

authn.sh handles this via the `Challenge` sub-resource. After `answer({})`, the SDK polls `GET /v1/client/sign-ins/{sid}/challenges/{cid}` on the originating device until `status` flips to `verified` or `transferable`:

```tsx
import { useSignIn } from '@authn.sh/sdk-react';

function MagicLinkSignInWithPolling() {
    const { signIn } = useSignIn();

    const send = async (email: string) => {
        await signIn.create({ identifier: email });

        const challenge = await signIn.createChallenge({
            strategy: 'email_link',
            redirectUrl: `${window.location.origin}/sso-callback`,
        });

        await challenge.answer({});

        challenge.on('status_change', (status) => {
            if (status === 'verified') {
                window.location.href = '/dashboard';
            }
        });
    };
}
```

The SDK polls `GET /v1/client/sign-ins/{sid}/challenges/{cid}` every 2 seconds for the first minute, then every 5 seconds for up to 5 minutes. When the other device clicks the link and `clientHandshake` validates the ticket, the challenge flips to `verified` on the next poll.

The cross-device poll window expires after 10 minutes. If the user hasn't clicked by then, the sign-in must be restarted.

## Transferable flow

If the user who clicks the link has no account, the challenge flips to `transferable` instead of `verified`. `<MagicLinkLanding />` handles this transparently — pass both `afterSignInUrl` and `afterSignUpUrl` and the component routes to the right one.

You can also handle it manually:

```ts
import { authn } from '@authn.sh/sdk-js';

const signIn = authn.client.signIn;
const challenge = await signIn.createChallenge({ strategy: 'email_link', redirectUrl: '...' });
await challenge.answer({});

challenge.on('status_change', async (status) => {
    if (status === 'transferable') {
        const signUp = await authn.client.signUp.create({ transfer: true });
    }
});
```

## Verifying additional emails

The same `email_link` strategy works when a signed-in user adds a secondary email address and needs to verify ownership. The flow is identical to sign-in's magic-link path — only the parent resource changes from `sign-in` to `email-address`.

```ts
import { authn } from '@authn.sh/sdk-js';

const emailAddress = authn.user.emailAddresses.find(e => e.id === targetId);

const challenge = await emailAddress.createChallenge({ strategy: 'email_link' });

await challenge.answer({});

challenge.on('status_change', (status) => {
    if (status === 'verified') {
        console.log('email verified');
    }
});
```

The SDK polls `GET /v1/me/email-addresses/{id}/challenges/{cid}` until `status` flips to `verified`. The same 10-minute expiry applies.

## Replay protection

Every magic-link ticket is:

- **Single-use** — consumed on the first valid `clientHandshake` call.
- **Time-limited** — expires after 10 minutes (same as the cross-device poll window).
- **Bound to the environment** — tickets signed by one FAPI URL are rejected by others.

Replaying the link after it's been used returns `422 magic_link_expired`.

## REST reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/client/sign-ins/{sid}/challenges` | Issue an `email_link` challenge — sends the magic-link email. |
| `POST` | `/v1/client/sign-ins/{sid}/challenges/{cid}/answer` | Commit to polling (empty body for `email_link`). |
| `GET`  | `/v1/client/sign-ins/{sid}/challenges/{cid}` | Poll challenge status on the originating device. |
| `GET`  | `/v1/client/handshake` | Consume a `__authn_ticket` and complete the session. |
| `POST` | `/v1/me/email-addresses/{id}/challenges` | Issue an `email_link` or `email_code` challenge for a secondary email. |
| `POST` | `/v1/me/email-addresses/{id}/challenges/{cid}/answer` | Answer the challenge (code string or empty body for `email_link`). |
| `GET`  | `/v1/me/email-addresses/{id}/challenges/{cid}` | Poll verification status. |
