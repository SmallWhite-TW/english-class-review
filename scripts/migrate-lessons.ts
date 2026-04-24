#!/usr/bin/env tsx
/**
 * One-shot migration: copy lesson markdown from the original local folder into
 * this repo's Astro content collections, synthesising frontmatter as needed.
 *
 * Source layout (read-only):
 *   /opt/white/project/english_class/english-courses/lesson-NNN/
 *     ├── materials/   (NOT migrated — contains private MP4 recordings and PDFs)
 *     ├── pre-study/*.md
 *     └── records/*.md
 *
 * Target layout:
 *   src/content/pre-study/<slug>.md
 *   src/content/review/<slug>.md
 *
 * Idempotent: re-running will overwrite target files. Source is never modified.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import matter from 'gray-matter';

const SOURCE_ROOT = '/opt/white/project/english_class/english-courses';
const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const TARGET_ROOT = join(REPO_ROOT, 'src/content');

const LESSON_ID_PATTERN = /^lesson-(\d{3})$/;

interface MigratedFile {
  source: string;
  target: string;
  lessonId: string;
  collection: 'pre-study' | 'review';
  slug: string;
}

async function listLessonDirs(): Promise<string[]> {
  const entries = await readdir(SOURCE_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && LESSON_ID_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => join(dir, e.name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

function parseDateFromFilename(name: string): string | undefined {
  // "260328-lesson-001-review.md" -> "2026-03-28"
  const match = name.match(/^(\d{2})(\d{2})(\d{2})-/);
  if (!match) return undefined;
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}`;
}

function extractTitle(body: string): string | undefined {
  const h1Match = body.match(/^#\s+(.+)$/m);
  return h1Match?.[1]?.trim();
}

function slugify(basename: string): string {
  return basename
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function buildSlug(lessonId: string, filename: string): string {
  const base = slugify(filename.replace(/\.md$/, ''));
  // If the filename already starts with the lessonId, avoid double-prefix.
  if (base.startsWith(lessonId)) return base;
  // Date-prefixed names: "260328-lesson-001-review" -> move date suffix-wards
  const dateStripped = base.replace(/^\d{6}-/, '');
  if (dateStripped.startsWith(lessonId)) return dateStripped;
  return `${lessonId}-${base}`;
}

function lessonIdToNumber(lessonId: string): number {
  const match = lessonId.match(LESSON_ID_PATTERN);
  if (!match) throw new Error(`Invalid lesson id: ${lessonId}`);
  return Number.parseInt(match[1], 10);
}

async function migrateFile(
  sourcePath: string,
  lessonId: string,
  collection: 'pre-study' | 'review',
): Promise<MigratedFile> {
  const raw = await readFile(sourcePath, 'utf8');
  const parsed = matter(raw);
  const body: string = parsed.content;
  const existingFrontmatter = parsed.data as Record<string, unknown>;

  const filename = sourcePath.split('/').pop() ?? 'unknown.md';
  const slug = buildSlug(lessonId, filename);
  const lessonNo = lessonIdToNumber(lessonId);
  const date = parseDateFromFilename(filename);
  const title =
    (existingFrontmatter.title as string | undefined) ??
    extractTitle(body) ??
    `${lessonId} ${collection}`;

  const frontmatter: Record<string, unknown> = {
    type: collection,
    lessonId,
    lessonNo,
    title,
    slug,
    sourcePath: `english-courses/${lessonId}/${collection === 'review' ? 'records' : 'pre-study'}/${filename}`,
    published: true,
    ...existingFrontmatter,
  };

  if (date && !frontmatter.tags) {
    frontmatter.tags = [];
  }

  const targetDir = join(TARGET_ROOT, collection);
  await mkdir(targetDir, { recursive: true });
  const targetPath = join(targetDir, `${slug}.md`);

  const serialized = matter.stringify(body, frontmatter);
  await writeFile(targetPath, serialized, 'utf8');

  return {
    source: sourcePath,
    target: targetPath,
    lessonId,
    collection,
    slug,
  };
}

async function run(): Promise<void> {
  // Sanity check source exists.
  try {
    await stat(SOURCE_ROOT);
  } catch {
    throw new Error(`Source directory not found: ${SOURCE_ROOT}`);
  }

  const lessons = await listLessonDirs();
  console.log(`Found ${lessons.length} lesson directories: ${lessons.join(', ')}`);

  const migrated: MigratedFile[] = [];

  for (const lessonId of lessons) {
    const lessonDir = join(SOURCE_ROOT, lessonId);

    for (const collection of ['pre-study', 'review'] as const) {
      const subdir = collection === 'review' ? 'records' : 'pre-study';
      const files = await listMarkdownFiles(join(lessonDir, subdir));
      for (const file of files) {
        const result = await migrateFile(file, lessonId, collection);
        migrated.push(result);
        console.log(
          `  ${collection}: ${relative(SOURCE_ROOT, file)} -> ${relative(REPO_ROOT, result.target)}`,
        );
      }
    }
  }

  console.log(`\nMigrated ${migrated.length} files total.`);
  console.log('Done. Review the output under src/content/ and run: npm run typecheck');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
