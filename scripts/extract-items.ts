#!/usr/bin/env tsx
/**
 * Extract reviewable items from review markdown.
 *
 * Items come in four flavours — the source section decides the type:
 *
 *   ### 關鍵單字／片語   → vocabulary (1 word) / phrase (multi-word)
 *   ### 文法／用法       → sentence
 *   ### 補充例句          → sentence
 *   ### 更自然的說法      → natural
 *
 * List items are expected to be in the shape:
 *
 *   - `English text here`
 *   - `English text here`：中文
 *   - `English text here`: 中文  (half-width colon also accepted)
 *
 * Output: src/content/generated/items.json — consumed by the vocabulary
 * page, the review session, and the home queue.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import type { ReviewItem } from '../src/types/content.js';
import type { ItemType } from '../src/types/progress.js';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const REVIEW_DIR = join(REPO_ROOT, 'src/content/review');
const OUTPUT_PATH = join(REPO_ROOT, 'src/content/generated/items.json');

const TOPIC_HEADING = /^##\s+Topic\s*(\d+)[：:\s]\s*(.+?)\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const TERM_ENTRY = /^\s*[-*]\s+`([^`]+)`\s*(?:[：:]\s*(.+?))?\s*$/;

type Section = ReviewItem['section'];

function classifySection(heading: string): Section {
  if (heading.includes('關鍵單字') || heading.includes('片語')) return '關鍵單字／片語';
  if (heading.includes('更自然的說法')) return '更自然的說法';
  if (heading.includes('補充例句')) return '補充例句';
  if (heading.includes('文法') || heading.includes('用法')) return '文法／用法';
  return 'other';
}

function isSentenceLike(text: string): boolean {
  // Sentence heuristics: starts with a capital AND ends with sentence punctuation.
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const first = trimmed[0] ?? '';
  const startsUpper = /[A-Z]/.test(first);
  const endsPunct = /[.!?]$/.test(trimmed);
  return startsUpper && endsPunct;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function classifyType(section: Section, english: string): ItemType {
  if (section === '更自然的說法') return 'natural';
  if (section === '文法／用法' || section === '補充例句') return 'sentence';
  if (section === '關鍵單字／片語') {
    if (isSentenceLike(english)) return 'sentence';
    return wordCount(english) <= 1 ? 'vocabulary' : 'phrase';
  }
  // 'other' — best guess by shape
  if (isSentenceLike(english)) return 'sentence';
  return wordCount(english) <= 1 ? 'vocabulary' : 'phrase';
}

function stableId(lessonId: string, reviewSlug: string, type: ItemType, english: string): string {
  const hash = createHash('sha1')
    .update(`${lessonId}::${reviewSlug}::${type}::${english}`)
    .digest('hex')
    .slice(0, 10);
  return `${lessonId}::${reviewSlug}::${type}::${hash}`;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(dir, e.name))
    .sort();
}

interface ParsedFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

async function parseFile(path: string): Promise<ParsedFile> {
  const raw = await readFile(path, 'utf8');
  const parsed = matter(raw);
  return { frontmatter: parsed.data as Record<string, unknown>, body: parsed.content };
}

function extractFromReview(
  lessonId: string,
  lessonNo: number,
  reviewSlug: string,
  body: string,
): ReviewItem[] {
  const lines = body.split('\n');
  const items: ReviewItem[] = [];
  const seen = new Set<string>();

  let topicIndex: number | undefined;
  let topicTitle: string | undefined;
  let currentSection: Section = 'other';

  for (const line of lines) {
    const topicMatch = line.match(TOPIC_HEADING);
    if (topicMatch) {
      topicIndex = Number.parseInt(topicMatch[1] ?? '0', 10);
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

    const english = termMatch[1]?.trim();
    const meaning = termMatch[2]?.trim() ?? '';
    if (!english) continue;

    const type = classifyType(currentSection, english);
    const id = stableId(lessonId, reviewSlug, type, english);
    if (seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      type,
      english,
      meaningZh: meaning,
      lessonId,
      lessonNo,
      reviewSlug,
      topicIndex,
      topicTitle,
      section: currentSection,
    });
  }

  return items;
}

async function run(): Promise<void> {
  const files = await listMarkdownFiles(REVIEW_DIR);
  const all: ReviewItem[] = [];
  const counts: Record<ItemType, number> = { vocabulary: 0, phrase: 0, sentence: 0, natural: 0 };

  for (const path of files) {
    const { frontmatter, body } = await parseFile(path);
    const lessonId = frontmatter.lessonId as string | undefined;
    const lessonNo = frontmatter.lessonNo as number | undefined;
    const reviewSlug = frontmatter.slug as string | undefined;
    if (!lessonId || !lessonNo || !reviewSlug) {
      console.warn(`  skip ${path.split('/').pop()}: missing frontmatter`);
      continue;
    }
    const items = extractFromReview(lessonId, lessonNo, reviewSlug, body);
    all.push(...items);
    const localCounts: Record<ItemType, number> = { vocabulary: 0, phrase: 0, sentence: 0, natural: 0 };
    for (const it of items) {
      counts[it.type]++;
      localCounts[it.type]++;
    }
    console.log(
      `  ${path.split('/').pop()}: ${items.length} items  (vocab ${localCounts.vocabulary} · phrase ${localCounts.phrase} · sentence ${localCounts.sentence} · natural ${localCounts.natural})`,
    );
  }

  await mkdir(join(REPO_ROOT, 'src/content/generated'), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(all, null, 2) + '\n', 'utf8');

  console.log(
    `\nTotal: ${all.length} items  (vocab ${counts.vocabulary} · phrase ${counts.phrase} · sentence ${counts.sentence} · natural ${counts.natural}) -> ${OUTPUT_PATH}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
