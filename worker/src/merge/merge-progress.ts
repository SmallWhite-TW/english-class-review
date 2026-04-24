import type {
  ProfileProgressDocument,
  TopicProgressRecord,
} from '../types.js';

/**
 * Per-topic last-write-wins merge. See ADR-005.
 *
 * For every topicId appearing in either document, keep the record with the
 * later `updatedAt`. If a topicId appears in only one side, take it as-is.
 * The merged document's `updatedAt` is set by the caller (usually server
 * wall-clock time).
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
  };

  if (base.profile !== clientDoc.profile) {
    throw new Error('Profile mismatch in merge');
  }
  if (base.version !== clientDoc.version) {
    throw new Error('Version mismatch in merge');
  }

  const mergedTopics: Record<string, TopicProgressRecord> = {
    ...base.topics,
  };

  for (const [topicId, clientRecord] of Object.entries(clientDoc.topics)) {
    const serverRecord = mergedTopics[topicId];
    if (serverRecord === undefined) {
      mergedTopics[topicId] = clientRecord;
      continue;
    }
    const serverTime = Date.parse(serverRecord.updatedAt);
    const clientTime = Date.parse(clientRecord.updatedAt);
    if (Number.isNaN(clientTime)) {
      continue;
    }
    if (Number.isNaN(serverTime) || clientTime >= serverTime) {
      mergedTopics[topicId] = clientRecord;
    }
  }

  return {
    profile: base.profile,
    version: base.version,
    updatedAt: now.toISOString(),
    topics: mergedTopics,
  };
}
