export type ProfileId = 'white' | 'dave';

export const PROFILE_IDS: readonly ProfileId[] = ['white', 'dave'] as const;

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface TopicProgressRecord {
  topicId: string;
  lessonId: string;
  reviewSlug: string;
  reviewed: boolean;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
}

export interface ProfileProgressDocument {
  profile: ProfileId;
  version: 1;
  updatedAt: string;
  topics: Record<string, TopicProgressRecord>;
}

export const PROGRESS_SCHEMA_VERSION = 1 as const;
