# ADR-001: Content Source Strategy

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

The source English class content lives at `/opt/white/project/english_class/english-courses/` on the author's local machine. Each lesson folder contains:

- `materials/` — raw class materials (PDF, MP4 recordings). MP4 files are private (class recordings) and are not to be published.
- `pre-study/*.md` — pre-class study documents.
- `records/*.md` — post-class review notes with a fixed topic / vocabulary / grammar structure.

The new site repository (`SmallWhite-TW/english-class-review`) needs to decide how to consume this content. Candidates:

1. Copy the markdown into the repo as the single source of truth.
2. Reference the external directory via git submodule.
3. Sync from an external directory during CI build.

## Decision

**Copy `pre-study/*.md` and `records/*.md` into `src/content/lessons/` inside this repo. This repo is the single source of truth going forward. `materials/` is not imported.**

A one-shot migration script (`scripts/migrate-lessons.ts`) performs the initial copy and augments each file with frontmatter. After migration, edits happen only in this repo.

## Consequences

### Good

- Build is fully self-contained: GitHub Actions does not depend on any path outside the repo.
- Content and presentation version together; every site version is reproducible from a commit SHA.
- Avoids the classic submodule footguns (init, update-ref, CI checkout flags, collaborator confusion).
- PRs show content changes and rendering changes in one diff.

### Bad

- One-time migration cost and a period of deciding which directory is "live".
- Dave (fellow student who curates raw lesson material) does not currently use git directly. White ingests the files into this repo; the content handoff process must be documented (see ADR-004 and SOP).
- MP4 recordings remain outside the repo; the site cannot embed them directly (acceptable — they are not public).

## Alternatives Considered

### Git submodule

- **Pros**: Clear separation between content repo and site repo.
- **Cons**: Overkill for a single-maintainer project. CI checkout, submodule pointer drift, and local clone UX all add friction.
- **Rejected because**: The content and the site are the same product; there is no audience for a standalone content repo.

### CI sync from external source

- **Pros**: Keeps the local `english-courses/` folder as primary.
- **Cons**: CI cannot reach a local path. Syncing from a second git repo just hides complexity behind another pipeline.
- **Rejected because**: It splits the source of truth without any real benefit.
