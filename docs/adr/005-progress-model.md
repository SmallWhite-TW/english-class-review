# ADR-005: Progress Data Model

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

Each topic in a lesson carries two pieces of state per profile:

- `reviewed: boolean` — "I have reviewed this topic."
- `confidence: 1..5 | null` — subjective self-assessment.

State must sync across a single user's devices. Storage is Cloudflare KV, which is eventually consistent and does not support transactions.

## Decision

**Store one progress document per profile in KV. Merge at the per-topic level using last-write-wins keyed by `updatedAt` timestamps. The client uploads the full document; the server merges against the current stored version and returns the canonical result.**

### KV key layout

```
progress:v1:white
progress:v1:dave
```

Key prefix carries a schema version so future breaking changes can coexist during migration.

### Document shape (authoritative)

```ts
type ProfileId = 'white' | 'dave';
type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

interface TopicProgressRecord {
  topicId: string;            // e.g. "lesson-001::lesson-001-review-01::topic-001"
  lessonId: string;
  reviewSlug: string;
  reviewed: boolean;
  confidence: ConfidenceLevel | null;
  updatedAt: string;          // ISO 8601
}

interface ProfileProgressDocument {
  profile: ProfileId;
  version: 1;
  updatedAt: string;          // document-level, refreshed on every merge
  topics: Record<string, TopicProgressRecord>;
}
```

### Merge rules

1. Reject if `profile` mismatches or `version` differs.
2. For each topic key in client + server union:
   - If only one side has the record, take it.
   - If both sides have it, keep the record with the later `updatedAt`.
3. Document-level `updatedAt` is set to the server's merge time.

### Topic ID generation

Topic IDs are generated at build time by the markdown parser:

```
<lessonId>::<reviewSlug>::topic-<index>
```

Index is assigned by heading order within a review file. Reordering published topic headings will break existing progress entries — this is an explicit content governance rule.

## Consequences

### Good

- Simple enough to implement in ~100 lines in the worker.
- Tolerates offline devices: each device merges when back online without coordination.
- KV's eventual consistency is acceptable because the merge is idempotent and the data has no cross-user semantics.

### Bad

- If two devices edit the same topic within the same second, the later write wins — earlier edits are lost silently.
- No audit trail / history — previous states are overwritten.
- Topic ID is positional, so reordering headings drifts existing records. Mitigation: documented rule plus optional explicit anchor in frontmatter later.

## Alternatives Considered

### Whole-document last-write-wins

- **Pros**: Simplest to implement.
- **Cons**: Two devices updating different topics in the same window would clobber each other.
- **Rejected because**: Per-topic merge is only marginally more complex and eliminates this failure mode.

### Cloudflare D1 (SQLite)

- **Pros**: Strong consistency; row-per-topic queries.
- **Cons**: Significantly more setup and schema management for two users' toy-sized dataset.
- **Rejected because**: KV is clearly sufficient for current scale.
