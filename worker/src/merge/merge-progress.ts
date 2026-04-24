import type {
  ItemProgressRecord,
  ProfileProgressDocument,
  TopicProgressRecord,
} from '../types.js';

/**
 * Per-record last-write-wins merge. See ADR-005.
 *
 * Both `topics` and `items` are merged at the record level: if a key
 * appears in either side, we keep the record with the later updatedAt.
 */
export function mergeProgressDocuments(
  serverDoc: ProfileProgressDocument | null,
  clientDoc: ProfileProgressDocument,
  now: Date = new Date(),
): ProfileProgressDocument {
  const base = serverDoc ?? {
    profile: clientDoc.profile,
    version: clientDoc.version,
    updatedAt: new Date(0).toISOString(),
    topics: {},
    items: {},
  };

  if (base.profile !== clientDoc.profile) {
    throw new Error('Profile mismatch in merge');
  }
  if (base.version !== clientDoc.version) {
    throw new Error('Version mismatch in merge');
  }

  return {
    profile: base.profile,
    version: base.version,
    updatedAt: now.toISOString(),
    topics: mergeMaps(base.topics, clientDoc.topics),
    items: mergeMaps(base.items, clientDoc.items),
  };
}

function mergeMaps<T extends { updatedAt: string }>(
  base: Record<string, T>,
  incoming: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...base };
  for (const [id, clientRecord] of Object.entries(incoming)) {
    const existing = out[id];
    if (existing === undefined) {
      out[id] = clientRecord;
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt);
    const incomingTime = Date.parse(clientRecord.updatedAt);
    if (Number.isNaN(incomingTime)) continue;
    if (Number.isNaN(existingTime) || incomingTime >= existingTime) {
      out[id] = clientRecord;
    }
  }
  return out;
}

/** Exported for tests. */
export const _test = { mergeMaps };

/** Keep the old export name working for callers that imported it. */
export { mergeProgressDocuments as default };

// Helpers retained for external use
export type { TopicProgressRecord, ItemProgressRecord };
