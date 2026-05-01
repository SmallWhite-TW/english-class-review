#!/usr/bin/env tsx
/**
 * Analyze how many vocab/phrase items currently have NO example sentence
 * (using the same word-boundary matcher the UI uses), so we can decide
 * how big the synthetic-examples job is.
 *
 * Usage: tsx scripts/analyze-missing-examples.ts
 */

import { readFile } from 'node:fs/promises';
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

  const targets = items.filter((it) => it.type === 'vocabulary' || it.type === 'phrase');
  const missing: ReviewItem[] = [];
  const hits: { item: ReviewItem; n: number }[] = [];

  for (const item of targets) {
    const re = buildTermMatcher(item.english);
    if (!re) continue;
    const key = `${item.lessonId}::${item.topicIndex ?? 'no-topic'}`;
    const pool = examplesByTopic.get(key) ?? [];
    const matches = pool.filter((e) => re.test(e.english));
    if (matches.length === 0) missing.push(item);
    else hits.push({ item, n: matches.length });
  }

  console.log('Total vocab + phrase:', targets.length);
  console.log('  with ≥1 review example:', hits.length);
  console.log('  with 0 review examples (need synthetic):', missing.length);
  console.log();

  // Per-lesson breakdown
  const byLesson: Record<string, { missing: number; hit: number }> = {};
  for (const t of targets) {
    byLesson[t.lessonId] ??= { missing: 0, hit: 0 };
  }
  for (const m of missing) byLesson[m.lessonId]!.missing++;
  for (const h of hits) byLesson[h.item.lessonId]!.hit++;
  console.log('Per lesson (missing / total):');
  for (const [lid, c] of Object.entries(byLesson).sort()) {
    const tot = c.missing + c.hit;
    console.log(`  ${lid}: ${c.missing} / ${tot}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
