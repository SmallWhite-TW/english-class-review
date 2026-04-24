# ADR-003: Hosting and Deployment

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

The site must be hosted under `smallwhite-tw.github.io` — the user's preferred public URL. Progress sync is handled separately by a Cloudflare Worker (see ADR-004, ADR-005). Deployment should be triggered automatically by `git push` with minimal manual steps.

## Decision

**Host the Astro static build on GitHub Pages as a project site at `https://smallwhite-tw.github.io/english-class-review/`. Deploy via GitHub Actions.**

Three workflows live under `.github/workflows/`:

- `ci.yml` — lint, typecheck, build on every PR.
- `deploy-pages.yml` — build and publish to GitHub Pages on push to `main`.
- `deploy-worker.yml` — deploy the Cloudflare Worker (see ADR-004) on push to `main` that touches `worker/**`.

Astro's `site` and `base` are set to account for the project-site sub-path:

```js
{
  site: 'https://smallwhite-tw.github.io',
  base: '/english-class-review',
}
```

## Consequences

### Good

- One URL, one deploy trigger, one audit trail (GitHub Actions run log).
- Zero hosting cost for the static site.
- Tight integration with the repo means build context always matches the committed content.

### Bad

- Project-site sub-path is a well-known footgun: asset URLs, search index paths, and internal links must all respect `import.meta.env.BASE_URL`. Manual `/foo` paths will break.
- GitHub Pages provides no dynamic API; all runtime data needs (progress sync) must live on the worker.
- Front-end and worker deploy from the same repo but via separate workflows — a schema change that touches both needs coordinated deploys.

## Alternatives Considered

### Cloudflare Pages

- **Pros**: Tight integration with Cloudflare Workers; easier to add Workers-based routing later.
- **Cons**: URL is `*.pages.dev` unless a custom domain is set up. User explicitly wants `github.io`.
- **Rejected because**: Hosting preference is already decided.

### Vercel

- **Pros**: Excellent DX for front-end deploys.
- **Cons**: Adds a third platform (GitHub + Cloudflare + Vercel) for no real gain; URL is not `github.io`.
- **Rejected because**: Same reason as above.
