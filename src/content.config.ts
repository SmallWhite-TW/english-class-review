import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lessonIdPattern = /^lesson-\d{3}$/;

const baseSchema = z.object({
  lessonId: z.string().regex(lessonIdPattern, 'Expected format: lesson-NNN'),
  lessonNo: z.number().int().positive(),
  title: z.string().min(1),
  slug: z.string().min(1),
  sourcePath: z.string().optional(),
  published: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  summary: z.string().optional(),
  order: z.number().int().positive().optional(),
});

const preStudyCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pre-study' }),
  schema: baseSchema.extend({
    type: z.literal('pre-study'),
    estimatedMinutes: z.number().int().positive().optional(),
  }),
});

const reviewCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/review' }),
  schema: baseSchema.extend({
    type: z.literal('review'),
    topicCount: z.number().int().nonnegative().optional(),
    vocabularyCount: z.number().int().nonnegative().optional(),
    reviewedVersion: z.string().optional(),
  }),
});

export const collections = {
  'pre-study': preStudyCollection,
  review: reviewCollection,
};
