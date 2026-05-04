// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
    site: 'https://docs.authn.sh',
    integrations: [
        starlight({
            title: 'authn.sh docs',
            description: 'Self-hosted authentication-as-a-service. Drop in Account Portal pages, sign-in components, and a Dashboard your operators actually want to use.',
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
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'REST API', slug: 'reference/rest' },
                        { label: 'SDKs', slug: 'reference/sdks' },
                    ],
                },
            ],
        }),
    ],
});
