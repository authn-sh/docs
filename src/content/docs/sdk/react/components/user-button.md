---
title: <UserButton />
description: The avatar + popover that surfaces account actions and an org-switcher from anywhere in your app.
---

`<UserButton />` renders the current user's avatar with a popover that surfaces "Manage account", "Sign out", a language switcher, and (when Organizations are enabled on the environment) an inline org-switcher. It's the v1 component you drop into the corner of your app's chrome.

Available from v1 of `@authn.sh/sdk-react`.

## Quickstart

```tsx
import { UserButton } from '@authn.sh/sdk-react';

export default function AppShell({ children }) {
  return (
    <div>
      <nav>
        <a href="/">Home</a>
        <UserButton />
      </nav>
      {children}
    </div>
  );
}
```

When the user is signed out, the component renders nothing — you'll typically render a `<Link to="/sign-in">` next to it and let one of the two show at a time.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `afterSignOutUrl` | `string` | environment `home_url` | Where to send the user after they click **Sign out**. |
| `signInUrl` | `string` | environment sign-in URL | Where to send the user when they don't have an active session (typically used in tandem with `<SignedOut />` to bypass rendering the component itself). |
| `userProfileUrl` | `string` | `/user` | The route the **Manage account** link points at — wire it to the page that hosts `<UserProfile />`. |
| `userProfileMode` | `'navigation' \| 'modal'` | `'navigation'` | `navigation` opens `userProfileUrl` in the current tab. `modal` opens `<UserProfile />` in an in-place modal dialog (useful when your app has no dedicated account page). |
| `showName` | `boolean` | `false` | When `true`, renders the user's name next to the avatar. |
| `appearance` | `Appearance` | — | Per-render appearance override. |
| `localization` | `Localization` | — | Per-render localization override. |
| `defaultOpen` | `boolean` | `false` | Forces the popover open on mount. Useful for product tours / onboarding. |

## Composition

For a custom popover layout, the action rows are exposed:

- `<UserButton.MenuItems />` — full menu list customisation.
- `<UserButton.Action label="…" labelIcon={…} onClick={…} />` — slot a custom action.
- `<UserButton.Link label="…" labelIcon={…} href="…" />` — slot a custom link.

```tsx
<UserButton>
  <UserButton.MenuItems>
    <UserButton.Action
      label="Switch theme"
      labelIcon={<MoonIcon />}
      onClick={() => toggleTheme()}
    />
    <UserButton.Link
      label="Help"
      labelIcon={<HelpIcon />}
      href="/help"
    />
  </UserButton.MenuItems>
</UserButton>
```

Custom items render after the bundled rows (Manage account, language picker, theme picker, Sign out).

## Org switcher

When the environment has Organizations enabled, the popover includes an inline org list and a "Create organization" action. Switching organizations changes `User.active_organization` and refreshes the JWT with the new `org` claim. See [`<OrganizationSwitcher />`](/sdk/react/components/organization-switcher/) for a standalone variant when you want the org picker outside the `<UserButton />` chrome.
