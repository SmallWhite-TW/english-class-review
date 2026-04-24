import type {
  ConfidenceLevel,
  ItemProgressRecord,
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
    items: {},
  };
}

function normalize(doc: ProfileProgressDocument): ProfileProgressDocument {
  return {
    profile: doc.profile,
    version: PROGRESS_SCHEMA_VERSION,
    updatedAt: doc.updatedAt,
    topics: doc.topics ?? {},
    items: doc.items ?? {},
  };
}

export function loadLocal(profile: ProfileId): ProfileProgressDocument {
  if (!isBrowser()) return emptyDocument(profile);
  const raw = localStorage.getItem(keyFor(profile));
  if (raw === null) return emptyDocument(profile);
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      profile?: ProfileId;
      updatedAt?: string;
      topics?: Record<string, TopicProgressRecord>;
      items?: Record<string, ItemProgressRecord>;
    };
    if (parsed.profile !== profile) return emptyDocument(profile);
    // Legacy v1 → v2 migrate in-place
    if ((parsed.version as number | undefined) === 1) {
      const migrated: ProfileProgressDocument = {
        profile,
        version: PROGRESS_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
        topics: (parsed.topics as ProfileProgressDocument['topics']) ?? {},
        items: {},
      };
      saveLocal(migrated);
      return migrated;
    }
    if (parsed.version !== PROGRESS_SCHEMA_VERSION) return emptyDocument(profile);
    return normalize(parsed as ProfileProgressDocument);
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

function mergeMaps<T extends { updatedAt: string }>(
  base: Record<string, T>,
  incoming: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...base };
  for (const [id, incomingRecord] of Object.entries(incoming)) {
    const existing = out[id];
    if (!existing) {
      out[id] = incomingRecord;
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt);
    const incomingTime = Date.parse(incomingRecord.updatedAt);
    if (Number.isNaN(incomingTime)) continue;
    if (Number.isNaN(existingTime) || incomingTime > existingTime) {
      out[id] = incomingRecord;
    }
  }
  return out;
}

export function mergeDocument(
  base: ProfileProgressDocument,
  incoming: ProfileProgressDocument,
): ProfileProgressDocument {
  if (base.profile !== incoming.profile) return base;
  return {
    profile: base.profile,
    version: PROGRESS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    topics: mergeMaps<TopicProgressRecord>(base.topics, incoming.topics),
    items: mergeMaps<ItemProgressRecord>(base.items, incoming.items),
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
