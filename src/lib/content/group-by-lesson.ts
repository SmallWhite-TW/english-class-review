import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type PreStudyEntry = CollectionEntry<'pre-study'>;
export type ReviewEntry = CollectionEntry<'review'>;

export interface LessonGroup {
  lessonId: string;
  lessonNo: number;
  preStudy: PreStudyEntry[];
  reviews: ReviewEntry[];
}

export async function getLessons(): Promise<LessonGroup[]> {
  const [preStudyEntries, reviewEntries] = await Promise.all([
    getCollection('pre-study', (entry) => entry.data.published),
    getCollection('review', (entry) => entry.data.published),
  ]);

  const lessonMap = new Map<string, LessonGroup>();

  const ensure = (lessonId: string, lessonNo: number): LessonGroup => {
    const existing = lessonMap.get(lessonId);
    if (existing) return existing;
    const fresh: LessonGroup = {
      lessonId,
      lessonNo,
      preStudy: [],
      reviews: [],
    };
    lessonMap.set(lessonId, fresh);
    return fresh;
  };

  for (const entry of preStudyEntries) {
    ensure(entry.data.lessonId, entry.data.lessonNo).preStudy.push(entry);
  }
  for (const entry of reviewEntries) {
    ensure(entry.data.lessonId, entry.data.lessonNo).reviews.push(entry);
  }

  const lessons = Array.from(lessonMap.values()).sort(
    (a, b) => a.lessonNo - b.lessonNo,
  );

  for (const lesson of lessons) {
    lesson.preStudy.sort(sortByOrderThenSlug);
    lesson.reviews.sort(sortByOrderThenSlug);
  }

  return lessons;
}

function sortByOrderThenSlug(
  a: PreStudyEntry | ReviewEntry,
  b: PreStudyEntry | ReviewEntry,
): number {
  const orderA = a.data.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.data.order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a.data.slug.localeCompare(b.data.slug);
}
