#!/usr/bin/env tsx
/**
 * Print the items needing synthetic examples for a given lesson list, in
 * a format that's easy for a human (or an LLM in a chat) to read and
 * fill in.
 *
 * Usage: tsx scripts/list-missing-examples.ts lesson-006 lesson-007
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ReviewItem } from '../src/types/content.js';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const ITEMS_PATH = `${REPO_ROOT}/src/content/generated/items.json`;

function buildTermMatcher(term: string): RegExp | null {
  const cleaned = term.trim();
  if (cleaned.length === 0) return null;
  const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/\s/.test(cleaned)) return new RegExp(escaped, 'i');
  const startsWithWord = /^\w/.test(cleaned);
  const endsWithWord = /\w$/.test(cleaned);
  const left = startsWithWord ? '\\b' : '';
  const right = endsWithWord ? '\\b' : '';
  return new RegExp(`${left}${escaped}${right}`, 'i');
}

async function main(): Promise<void> {
  const lessonFilter = new Set(process.argv.slice(2));
  const raw = await readFile(ITEMS_PATH, 'utf8');
  const items = JSON.parse(raw) as ReviewItem[];

  const examplesByTopic = new Map<string, ReviewItem[]>();
  for (const it of items) {
    if (it.type !== 'sentence' && it.type !== 'natural') continue;
    const key = `${it.lessonId}::${it.topicIndex ?? 'no-topic'}`;
    const list = examplesByTopic.get(key) ?? [];
    list.push(it);
    examplesByTopic.set(key, list);
  }

  const missing: ReviewItem[] = [];
  for (const item of items) {
    if (item.type !== 'vocabulary' && item.type !== 'phrase') continue;
    if (lessonFilter.size > 0 && !lessonFilter.has(item.lessonId)) continue;
    const re = buildTermMatcher(item.english);
    if (!re) continue;
    const key = `${item.lessonId}::${item.topicIndex ?? 'no-topic'}`;
    const pool = examplesByTopic.get(key) ?? [];
    if (pool.filter((e) => re.test(e.english)).length === 0) {
      missing.push(item);
    }
  }

  // Tabular output for inspection
  const lines: string[] = [];
  lines.push('id\ttype\tlesson\ttopic\tterm\tmeaning');
  for (const m of missing) {
    lines.push(
      [
        m.id,
        m.type,
        m.lessonId,
        m.topicTitle ?? '',
        m.english,
        m.meaningZh ?? '',
      ]
        .map((s) => String(s).replace(/\t/g, ' '))
        .join('\t'),
    );
  }
  const outPath = `${REPO_ROOT}/scripts/.missing-examples.tsv`;
  await writeFile(outPath, lines.join('\n') + '\n', 'utf8');

  console.log(`${missing.length} items missing examples.`);
  console.log(`Wrote tab-separated table to: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
