#!/usr/bin/env tsx
/**
 * Extract vocabulary entries from review markdown files.
 *
 * Accepts two shapes (both inside list items under a section heading):
 *   - `English term`
 *   - `English term`：中文意思
 *   - `English term`: 中文意思   (half-width colon also tolerated)
 *
 * Output: src/content/generated/vocabulary.json with entries shaped per
 * VocabularyEntry in src/types/content.ts.
 *
 * The parser tracks the current Topic (## Topic N：...) and section
 * (### 關鍵單字／片語, etc.) while scanning each file.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import type { VocabularyEntry } from '../src/types/content.js';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const REVIEW_DIR = join(REPO_ROOT, 'src/content/review');
const OUTPUT_PATH = join(REPO_ROOT, 'src/content/generated/vocabulary.json');

const TOPIC_HEADING = /^##\s+Topic\s*(\d+)[：:\s]\s*(.+?)\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const TERM_ENTRY =
  /^\s*[-*]\s+`([^`]+)`\s*(?:[：:]\s*(.+?))?\s*$/;

const ACCEPTED_SECTIONS = [
  '關鍵單字／片語',
  '更自然的說法',
  '補充例句',
] as const;

type Section = (typeof ACCEPTED_SECTIONS)[number] | 'other';

function classifySection(heading: string): Section {
  for (const accepted of ACCEPTED_SECTIONS) {
    if (heading.includes(accepted)) return accepted;
  }
  return 'other';
}

function slugifyTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

interface ParsedFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

async function parseFile(path: string): Promise<ParsedFile> {
  const raw = await readFile(path, 'utf8');
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
}

function extractFromReview(
  lessonId: string,
  lessonNo: number,
  reviewSlug: string,
  body: string,
): VocabularyEntry[] {
  const lines = body.split('\n');
  const entries: VocabularyEntry[] = [];
  const seen = new Set<string>();

  let topicTitle: string | undefined;
  let currentSection: Section = 'other';

  for (const line of lines) {
    const topicMatch = line.match(TOPIC_HEADING);
    if (topicMatch) {
      topicTitle = topicMatch[2]?.trim();
      currentSection = 'other';
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch) {
      currentSection = classifySection(sectionMatch[1] ?? '');
      continue;
    }

    const termMatch = line.match(TERM_ENTRY);
    if (!termMatch) continue;

    const term = termMatch[1]?.trim();
    const meaning = termMatch[2]?.trim() ?? '';
    if (!term) continue;

    const id = `${lessonId}::${reviewSlug}::${slugifyTerm(term)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    entries.push({
      id,
      term,
      meaningZh: meaning,
      lessonId,
      lessonNo,
      reviewSlug,
      topicTitle,
      section: currentSection,
    });
  }

  return entries;
}

async function run(): Promise<void> {
  const files = await readdir(REVIEW_DIR);
  const markdownFiles = files
    .filter((f) => f.endsWith('.md'))
    .sort();

  const allEntries: VocabularyEntry[] = [];

  for (const filename of markdownFiles) {
    const path = join(REVIEW_DIR, filename);
    const { frontmatter, body } = await parseFile(path);

    const lessonId = frontmatter.lessonId as string | undefined;
    const lessonNo = frontmatter.lessonNo as number | undefined;
    const reviewSlug = frontmatter.slug as string | undefined;

    if (!lessonId || !lessonNo || !reviewSlug) {
      console.warn(`  skip ${filename}: missing frontmatter`);
      continue;
    }

    const entries = extractFromReview(lessonId, lessonNo, reviewSlug, body);
    allEntries.push(...entries);
    console.log(`  ${filename}: ${entries.length} vocabulary entries`);
  }

  await mkdir(join(REPO_ROOT, 'src/content/generated'), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(allEntries, null, 2) + '\n',
    'utf8',
  );

  console.log(`\nTotal: ${allEntries.length} entries -> ${OUTPUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
