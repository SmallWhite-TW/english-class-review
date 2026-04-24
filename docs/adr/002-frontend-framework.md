# ADR-002: Frontend Framework and Content Model

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

The site is content-driven (weekly English class notes) with a small amount of interactivity:

- Profile switcher (White / Dave)
- Per-topic progress UI (`reviewed` boolean + `confidence` 1–5)
- Full-text search over lesson content
- Vocabulary search over terms extracted from review markdown

The hosting target is GitHub Pages, so the build output must be fully static. Candidate frameworks include Astro, Next.js (static export), VitePress, and plain Vite + React.

## Decision

**Use Astro with content collections backed by a Zod schema, output as a static site.**

- `pre-study` and `review` are two separate content collections with distinct frontmatter schemas.
- Topics inside a review are not split into separate markdown files; they remain sections inside one review file. A parser extracts topic IDs and vocabulary at build time.
- Vocabulary is not authored separately — it is derived from review markdown by parsing the `` `English term`：中文意思 `` pattern into `src/content/generated/vocabulary.json`.
- Interactive pieces (profile switcher, progress bar, search UI) are implemented as small client-side islands or plain TypeScript modules loaded on demand.

## Consequences

### Good

- Astro is purpose-built for content-first sites and produces minimal JS by default.
- Zod schema on content collections catches malformed frontmatter at build time — content quality gate.
- Single source for content (the review markdown) drives both rendered pages and search / vocabulary indexes.
- Future migration to a more app-style framework is still possible because content stays as plain markdown + frontmatter.

### Bad

- GitHub Pages project-site sub-path (`/english-class-review/`) requires careful handling of `base` in every asset and link — a known source of bugs.
- Vocabulary extraction quality depends on authors following the documented markdown pattern precisely.
- Astro's content collection API is a hard dependency; major version upgrades may require schema migration.

## Alternatives Considered

### Next.js static export

- **Pros**: React ecosystem; clear upgrade path if the site ever needs SSR or server actions.
- **Cons**: Heavier than needed for content-first work; more boilerplate; more GitHub Pages sub-path edge cases.
- **Rejected because**: The project is not app-first. Adding Next.js pays upfront cost for flexibility we do not need yet.

### VitePress

- **Pros**: Very fast to start; markdown-first.
- **Cons**: Opinionated toward documentation sites; custom interactive components and data modeling are harder.
- **Rejected because**: We need profile/progress/search UI that goes beyond docs-site templates.

### Plain Vite + React

- **Pros**: Full flexibility.
- **Cons**: No built-in content pipeline; we would reimplement what Astro gives for free.
- **Rejected because**: No reason to pay that cost for a small site.
