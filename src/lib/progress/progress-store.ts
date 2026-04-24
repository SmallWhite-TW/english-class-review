import type {
  ConfidenceLevel,
  ProfileId,
  ProfileProgressDocument,
  TopicProgressRecord,
} from '../../types/progress.js';
import { PROGRESS_SCHEMA_VERSION } from '../../types/progress.js';

function keyFor(profile: ProfileId): string {
  return `ecr:progress:v1:${profile}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function emptyDocument(profile: ProfileId): ProfileProgressDocument {
  return {
    profile,
    version: PROGRESS_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    topics: {},
  };
}

export function loadLocal(profile: ProfileId): ProfileProgressDocument {
  if (!isBrowser()) return emptyDocument(profile);
  const raw = localStorage.getItem(keyFor(profile));
  if (raw === null) return emptyDocument(profile);
  try {
    const parsed = JSON.parse(raw) as ProfileProgressDocument;
    if (parsed.version !== PROGRESS_SCHEMA_VERSION || parsed.profile !== profile) {
      return emptyDocument(profile);
    }
    return parsed;
  } catch {
    return emptyDocument(profile);
  }
}

export function saveLocal(doc: ProfileProgressDocument): void {
  if (!isBrowser()) return;
  localStorage.setItem(keyFor(doc.profile), JSON.stringify(doc));
  window.dispatchEvent(
    new CustomEvent('progress:changed', { detail: { profile: doc.profile } }),
  );
}

export function updateTopic(
  profile: ProfileId,
  lessonId: string,
  reviewSlug: string,
  topicId: string,
  patch: { reviewed?: boolean; confidence?: ConfidenceLevel | null },
): ProfileProgressDocument {
  const doc = loadLocal(profile);
  const existing: TopicProgressRecord = doc.topics[topicId] ?? {
    topicId,
    lessonId,
    reviewSlug,
    reviewed: false,
    confidence: null,
    updatedAt: new Date(0).toISOString(),
  };
  const updated: TopicProgressRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next: ProfileProgressDocument = {
    ...doc,
    updatedAt: new Date().toISOString(),
    topics: { ...doc.topics, [topicId]: updated },
  };
  saveLocal(next);
  return next;
}

export function mergeDocument(
  base: ProfileProgressDocument,
  incoming: ProfileProgressDocument,
): ProfileProgressDocument {
  if (base.profile !== incoming.profile) return base;
  const topics: Record<string, TopicProgressRecord> = { ...base.topics };
  for (const [id, incomingRecord] of Object.entries(incoming.topics)) {
    const existing = topics[id];
    if (!existing) {
      topics[id] = incomingRecord;
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt);
    const incomingTime = Date.parse(incomingRecord.updatedAt);
    if (Number.isNaN(incomingTime)) continue;
    if (Number.isNaN(existingTime) || incomingTime > existingTime) {
      topics[id] = incomingRecord;
    }
  }
  return {
    profile: base.profile,
    version: base.version,
    updatedAt: new Date().toISOString(),
    topics,
  };
}

export function computeProgress(doc: ProfileProgressDocument): {
  reviewed: number;
  total: number;
  percent: number;
  averageConfidence: number | null;
} {
  const topics = Object.values(doc.topics);
  const total = topics.length;
  const reviewed = topics.filter((t) => t.reviewed).length;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  const confidences = topics
    .map((t) => t.confidence)
    .filter((c): c is ConfidenceLevel => c !== null);
  const averageConfidence =
    confidences.length === 0
      ? null
      : confidences.reduce((a, b) => a + b, 0) / confidences.length;
  return { reviewed, total, percent, averageConfidence };
}
