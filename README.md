# authn.sh docs

The developer documentation site for [authn.sh](https://authn.sh) — `docs.authn.sh` in production.

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Local dev

```bash
npm install
npm run dev
```

Open <http://localhost:4321>.

## Build

```bash
npm run build
```

Outputs a static site to `dist/`.

## Writing

Pages live under `src/content/docs/`, organized by sidebar section:

```
src/content/docs/
├── index.mdx                   # landing page (hero + cards)
├── getting-started/            # quickstart + first sign-in
├── concepts/                   # tenancy, api keys, sessions, webhooks
├── guides/                     # task-oriented walkthroughs
└── reference/                  # REST + SDKs
```

The sidebar order is configured in `astro.config.mjs` — adding a Markdown file isn't enough on its own, also list it under the matching `sidebar:` group.

### Conventions

- Heading levels: `h1` from frontmatter `title`, `##` for top-level sections within the page, `###` for subsections. Don't use bare `#` in body.
- Code-fence languages: `bash`, `tsx`, `ts`, `php`, `python`, `go`, `json`, `yaml`. Use these consistently for syntax highlighting + Pagefind search.
- Links to other pages use absolute paths starting with `/`, e.g. `/concepts/api-keys/`.
- Links to source on GitHub link to `main`, not a tag, so they stay current.

### License

The docs themselves are AGPL-3.0 (`LICENSE`). Code samples in fenced blocks are CC0 / public domain — copy-paste freely.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes to Cloudflare Pages (project `authn-sh-docs`).

CI on every push runs `.github/workflows/ci.yml`: build + a Pa11y a11y smoke against every page in the sidebar.
