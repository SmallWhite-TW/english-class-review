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

export interface VocabularyEntry {
  id: string;
  term: string;
  meaningZh: string;
  lessonId: string;
  lessonNo: number;
  reviewSlug: string;
  topicTitle?: string;
  section: '關鍵單字／片語' | '更自然的說法' | '補充例句' | 'other';
  aliases?: string[];
}

export interface TopicMeta {
  topicId: string;
  lessonId: string;
  reviewSlug: string;
  index: number;
  title: string;
  summary?: string;
}
