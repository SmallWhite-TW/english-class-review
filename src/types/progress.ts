export type ProfileId = 'white' | 'dave';

export const PROFILE_IDS: readonly ProfileId[] = ['white', 'dave'] as const;

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export type ItemType = 'vocabulary' | 'phrase' | 'sentence' | 'natural';

export interface TopicProgressRecord {
  topicId: string;
  lessonId: string;
  reviewSlug: string;
  reviewed: boolean;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
}

/**
 * SRS state for a single reviewable item (word / phrase / sentence / natural).
 *
 * lastReviewedAt / nextDueAt / intervalDays drive the daily review queue.
 * See src/lib/srs/schedule.ts for how intervals are computed.
 */
export interface ItemProgressRecord {
  itemId: string;
  type: ItemType;
  lessonId: string;
  reviewSlug: string;
  confidence: ConfidenceLevel | null;
  lastReviewedAt: string | null;
  nextDueAt: string | null;
  intervalDays: number;     // current interval; next review = lastReviewedAt + intervalDays
  reviewCount: number;      // how many times it has been rated
  consecutiveMastery: number; // streak of confidence == 5 (drives bonus multiplier)
  updatedAt: string;
}

export interface ProfileProgressDocument {
  profile: ProfileId;
  version: 2;
  updatedAt: string;
  topics: Record<string, TopicProgressRecord>;
  items: Record<string, ItemProgressRecord>;
}

export const PROGRESS_SCHEMA_VERSION = 2 as const;

/**
 * Migrate a legacy v1 document (topics only) to v2 (topics + items). Used
 * when the Worker loads a KV blob that predates item-level tracking.
 */
export function migrateToV2(legacy: unknown): ProfileProgressDocument | null {
  if (typeof legacy !== 'object' || legacy === null) return null;
  const doc = legacy as Partial<ProfileProgressDocument> & { version?: number };
  if (doc.profile !== 'white' && doc.profile !== 'dave') return null;

  if (doc.version === 2) {
    return doc as ProfileProgressDocument;
  }
  if (doc.version === 1) {
    return {
      profile: doc.profile,
      version: 2,
      updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
      topics: (doc.topics as Record<string, TopicProgressRecord>) ?? {},
      items: {},
    };
  }
  return null;
}
