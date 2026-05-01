# CLAUDE.md

Project-specific guidance for Claude Code working on this repository. Read `docs/adr/` first — every architectural decision is documented there with reasoning.

## Project in one paragraph

Static site on GitHub Pages (Astro) showing weekly English class content for two users (White, Dave) with per-topic review progress. Progress syncs across a single user's devices via a small Cloudflare Worker + KV. Content is authored as markdown under `src/content/{pre-study,review}/`.

## Key invariants — do not break

- **Base path**: the site lives at `/english-class-review/`. Never hard-code `/foo` paths; always use `import.meta.env.BASE_URL` or Astro's URL helpers.
- **Topic IDs are positional**: `<lessonId>::<reviewSlug>::topic-<index>` based on heading order. Reordering published headings breaks existing progress records. See ADR-005.
- **Materials (MP4, private PDFs) never enter the repo**. `src/content/` is markdown-only. See ADR-001.
- **Profile secrets are in the bundle by design**. They are not strong auth; do not add logic that assumes they are. See ADR-004.
- **API is versioned at `/api/v1`**. Any breaking change means `/api/v2` + dual-support window, not in-place edits.

## When making changes

- Front-end: changes under `src/` → rebuild triggers `deploy-pages.yml`.
- Worker: changes under `worker/` → rebuild triggers `deploy-worker.yml`.
- Schema changes (progress, frontmatter): update the matching ADR first, then code.
- New ADR for any architectural pivot — do not silently change direction.

## Things that commonly go wrong

- GitHub Pages sub-path issues: Pagefind, assets, internal links. Always test `npm run build && npm run preview` before pushing.
- Worker deploy lagging front-end deploy (or vice versa): bump API version if the shape changes.
- Vocabulary extraction depending on exact markdown pattern `` `term`：meaning ``. Fullwidth colon (`：`) is required — half-width (`:`) is silently skipped by the parser.

## Useful commands

```bash
npm run dev                   # Astro dev server
npm run build                 # static build to dist/
npm run typecheck             # astro check + tsc
npm run worker:dev            # local wrangler dev
npm run new-lesson <N>        # scaffold english-courses/lesson-NNN/{pre-study,records}/
npm run migrate:lessons       # sync content from english-courses/ into src/content/
npm run extract:items         # regenerate src/content/generated/items.json
npm run validate:content      # frontmatter / vocab format check (CI gate)
```

## Adding a new lesson (weekly workflow)

1. `npm run new-lesson 8` — scaffolds `english-courses/lesson-008/` with `pre-study/` and `records/` subdirs.
2. Drop the review markdown into `lesson-008/records/` (filename pattern `YYMMDD-lesson-008-review.md`).
3. `npm run migrate:lessons` — copies into `src/content/review/` and rewrites the frontmatter.
4. `git add -A && git commit -m "chore: add lesson-008 review" && git push`.

`migrate-lessons.ts` also has a fallback: review markdown placed loose under `lesson-NNN/` (not under `records/`) is still picked up if the filename matches `*review*` or `*record*` — it logs a warning so you know to tidy up later.
