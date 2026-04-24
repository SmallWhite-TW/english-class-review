import type { ItemType } from './progress.js';

export type ContentType = 'pre-study' | 'review';

export interface LessonMeta {
  lessonId: string;
  title: string;
  lessonNo: number;
  date?: string;
  published: boolean;
  tags?: string[];
}

export interface BaseContentFrontmatter {
  lessonId: string;
  lessonNo: number;
  title: string;
  slug: string;
  sourcePath?: string;
  published: boolean;
  tags?: string[];
  summary?: string;
  order?: number;
}

export interface PreStudyFrontmatter extends BaseContentFrontmatter {
  type: 'pre-study';
  estimatedMinutes?: number;
}

export interface ReviewFrontmatter extends BaseContentFrontmatter {
  type: 'review';
  topicCount?: number;
  vocabularyCount?: number;
  reviewedVersion?: string;
}

/**
 * A reviewable item extracted from review markdown at build time. Items
 * come in four flavours; they all share the same shape so the review
 * session / flashcard / vocabulary pages can treat them uniformly.
 *
 * - vocabulary: single words from `關鍵單字／片語`
 * - phrase: multi-word phrases from `關鍵單字／片語`
 * - sentence: example sentences from `文法／用法` and `補充例句`
 * - natural: more natural phrasing from `更自然的說法`
 */
export interface ReviewItem {
  id: string;
  type: ItemType;
  english: string;
  meaningZh: string;
  lessonId: string;
  lessonNo: number;
  reviewSlug: string;
  topicIndex?: number;
  topicTitle?: string;
  section: '關鍵單字／片語' | '更自然的說法' | '補充例句' | '文法／用法' | 'other';
}

/** Backwards compatible alias — the vocabulary page still calls it this. */
export type VocabularyEntry = Omit<ReviewItem, 'english'> & { term: string };

export interface TopicMeta {
  topicId: string;
  lessonId: string;
  reviewSlug: string;
  index: number;
  title: string;
  summary?: string;
}
