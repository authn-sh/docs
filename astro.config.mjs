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
                        { label: 'Passkeys', slug: 'concepts/passkeys' },
                        { label: 'Enterprise SSO', slug: 'concepts/enterprise-sso' },
                        { label: 'SCIM attribute mapping', slug: 'concepts/scim-attribute-mapping' },
                        { label: 'JWT templates', slug: 'concepts/jwt-templates' },
                        { label: 'Webhooks', slug: 'concepts/webhooks' },
                    ],
                },
                {
                    label: 'OAuth provider mode',
                    items: [
                        { label: 'Overview', slug: 'concepts/oauth-provider/overview' },
                        { label: 'Registering an application', slug: 'concepts/oauth-provider/registering-an-application' },
                        { label: 'Authorization-code flow', slug: 'concepts/oauth-provider/authorization-code-flow' },
                        { label: 'PKCE for public clients', slug: 'concepts/oauth-provider/pkce' },
                        { label: 'Discovery + JWKS', slug: 'concepts/oauth-provider/discovery' },
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
                        { label: 'Social sign-in', slug: 'guides/social-sign-in' },
                        { label: 'Custom OIDC walkthrough', slug: 'guides/custom-oidc' },
                        { label: 'Custom OAuth2 walkthrough', slug: 'guides/custom-oauth2' },
                        { label: 'Phone numbers', slug: 'guides/phone-numbers' },
                        { label: 'Multi-factor authentication', slug: 'guides/multi-factor-authentication' },
                        { label: 'Second-factor sign-in', slug: 'guides/second-factor-sign-in' },
                        { label: 'SMS MFA', slug: 'guides/sms-mfa' },
                        { label: 'Per-org SSO setup', slug: 'guides/per-org-sso-setup' },
                        { label: 'Verified domains', slug: 'guides/verified-domains' },
                    ],
                },
                {
                    label: 'SCIM 2.0',
                    items: [
                        { label: 'Okta', slug: 'guides/scim/okta' },
                        { label: 'Azure AD / Entra ID', slug: 'guides/scim/azure-ad' },
                        { label: 'Google Workspace', slug: 'guides/scim/google-workspace' },
                        { label: 'Rippling', slug: 'guides/scim/rippling' },
                        { label: 'SCIM admin via BAPI', slug: 'guides/scim/admin-bapi' },
                    ],
                },
                {
                    label: 'Customization',
                    items: [
                        { label: 'Theming', slug: 'customization/theming' },
                        { label: 'Localization', slug: 'customization/localization' },
                    ],
                },
                {
                    label: 'Social providers',
                    items: [
                        { label: 'Discord', slug: 'social-providers/discord' },
                        { label: 'Facebook', slug: 'social-providers/facebook' },
                        { label: 'LinkedIn', slug: 'social-providers/linkedin' },
                        { label: 'X (Twitter)', slug: 'social-providers/x' },
                        { label: 'GitLab', slug: 'social-providers/gitlab' },
                        { label: 'Slack', slug: 'social-providers/slack' },
                    ],
                },
                {
                    label: 'React components',
                    items: [
                        { label: '<SignIn />', slug: 'sdk/react/components/sign-in' },
                        { label: '<SignUp />', slug: 'sdk/react/components/sign-up' },
                        { label: '<UserProfile />', slug: 'sdk/react/components/user-profile' },
                        { label: '<UserButton />', slug: 'sdk/react/components/user-button' },
                        { label: '<OrganizationProfile />', slug: 'sdk/react/components/organization-profile' },
                        { label: '<OrganizationSwitcher />', slug: 'sdk/react/components/organization-switcher' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'REST API', slug: 'reference/rest' },
                        { label: 'SDKs', slug: 'reference/sdks' },
                        { label: 'Roles & Permissions', slug: 'reference/roles-and-permissions' },
                        { label: 'Security section components', slug: 'reference/security-components' },
                        { label: 'Connected-accounts components', slug: 'reference/connected-accounts' },
                        { label: 'SMS templates', slug: 'reference/sms-templates' },
                        { label: 'SMS drivers', slug: 'reference/sms-drivers' },
                        { label: 'JWT claims', slug: 'reference/jwt-claims' },
                    ],
                },
            ],
        }),
    ],
});
