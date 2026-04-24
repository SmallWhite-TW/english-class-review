# ADR-006: Search Strategy

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

Two search needs:

1. **Full-text search** over lesson prose (topic titles, summaries, grammar notes, example sentences).
2. **Vocabulary search** — given an English term or Chinese meaning, jump to the exact review section where it appears.

The site is fully static, so search must run in the browser or be precomputed at build time.

## Decision

**Use Pagefind for full-text search and a custom build-time extractor for vocabulary.**

### Full-text: Pagefind

- Added to the build pipeline after `astro build`: `npx pagefind --site dist`.
- Output lives at `dist/pagefind/` and is served under `/english-class-review/pagefind/`.
- UI uses Pagefind's default search component, configured with a base-aware bundle path.

### Vocabulary: build-time extractor

- `scripts/extract-vocabulary.ts` parses every review markdown and finds lines matching the pattern `` `English term`：中文意思 ``.
- Output `src/content/generated/vocabulary.json` with entries:

```ts
interface VocabularyEntry {
  id: string;             // stable: "<lessonId>::<reviewSlug>::<slugified-term>"
  term: string;
  meaningZh: string;
  lessonId: string;
  lessonNo: number;
  reviewSlug: string;
  topicTitle?: string;
  section: '關鍵單字／片語' | '更自然的說法' | '補充例句' | 'other';
}
```

- Front-end loads this JSON once and does in-memory filtering (dataset size is small).

### Search UI

A single `/search` page with two tabs: "全文搜尋" (Pagefind) and "單字" (vocabulary JSON).

## Consequences

### Good

- Works offline / fully static — no search backend to operate.
- Vocabulary extraction reuses the existing markdown convention; no duplicate data entry.
- Pagefind outputs a paginated, lazy-loaded index — small initial download even as content grows.

### Bad

- Extraction quality depends on authors following the `` `term`：meaning `` format. A content validator (`scripts/validate-content.ts`) fails CI if the pattern is broken.
- Pagefind's default UI styling requires overrides to match the site design.
- Two separate search mechanisms means two different result rendering paths in the UI.

## Alternatives Considered

### Only full-text search

- **Pros**: Simpler.
- **Cons**: Vocabulary lookup by exact term would be buried in noise.
- **Rejected because**: Vocabulary review is a primary use case.

### Only vocabulary (no full-text)

- **Pros**: Very small index.
- **Cons**: Cannot find grammar explanations, teacher notes, or example sentences.
- **Rejected because**: Full-text is explicitly requested.

### Algolia / Meilisearch hosted

- **Pros**: Better relevance tuning.
- **Cons**: Adds a paid / hosted dependency for a tiny dataset.
- **Rejected because**: Pagefind is sufficient at this scale.
