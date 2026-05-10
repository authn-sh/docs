// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const rawGtmId = process.env.PUBLIC_GTM_ID ?? '';
const gtmId = /^GTM-[A-Z0-9]+$/.test(rawGtmId) ? rawGtmId : '';
const head = gtmId
    ? [
          {
              tag: /** @type {const} */ ('script'),
              content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
          },
      ]
    : [];

export default defineConfig({
    site: 'https://docs.authn.sh',
    integrations: [
        starlight({
            title: 'authn.sh docs',
            description: 'Self-hosted authentication-as-a-service. Drop in Account Portal pages, sign-in components, and a Dashboard your operators actually want to use.',
            head,
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/authn-sh/authn' }],
            editLink: {
                baseUrl: 'https://github.com/authn-sh/docs/edit/main/',
            },
            lastUpdated: true,
            sidebar: [
                {
                    label: 'Getting started',
                    items: [
                        { label: 'Self-host quickstart', slug: 'getting-started/quickstart' },
                        { label: 'Your first sign-in flow', slug: 'getting-started/first-sign-in' },
                    ],
                },
                {
                    label: 'Concepts',
                    items: [
                        { label: 'Workspaces, projects, environments', slug: 'concepts/tenancy' },
                        { label: 'API keys', slug: 'concepts/api-keys' },
                        { label: 'Sessions and tokens', slug: 'concepts/sessions-and-tokens' },
                        { label: 'Webhooks', slug: 'concepts/webhooks' },
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        { label: 'Embed <SignIn /> in a React app', slug: 'guides/react-sign-in' },
                        { label: 'Verify JWTs in a backend', slug: 'guides/verify-jwt' },
                        { label: 'Verify webhook signatures', slug: 'guides/verify-webhooks' },
                        { label: 'Organizations', slug: 'guides/organizations' },
                        { label: 'Magic-link sign-in', slug: 'guides/magic-link' },
                        { label: 'Multi-factor authentication', slug: 'guides/multi-factor-authentication' },
                        { label: 'Second-factor sign-in', slug: 'guides/second-factor-sign-in' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'REST API', slug: 'reference/rest' },
                        { label: 'SDKs', slug: 'reference/sdks' },
                        { label: 'Roles & Permissions', slug: 'reference/roles-and-permissions' },
                        { label: 'Security section components', slug: 'reference/security-components' },
                    ],
                },
            ],
        }),
    ],
});
