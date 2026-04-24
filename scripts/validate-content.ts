#!/usr/bin/env tsx
/**
 * Content validator. Runs in CI; fails the build when issues are found.
 *
 * Checks:
 *  1. Every content file has valid frontmatter (lessonId, lessonNo, title,
 *     slug, type).
 *  2. `slug` is unique within each collection.
 *  3. `lessonId` format matches `lesson-NNN` and matches `lessonNo`.
 *  4. Review files that have topic headings use the `## Topic N：...` pattern.
 *  5. Vocabulary list items are well formed (backtick-wrapped terms).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const CONTENT_ROOT = join(REPO_ROOT, 'src/content');

const LESSON_ID = /^lesson-(\d{3})$/;
const TOPIC_HEADING = /^##\s+Topic\s*(\d+)[：:\s]\s*(.+?)\s*$/;
const BARE_TOPIC = /^##\s+Topic\b/;
const LIST_ITEM_TERM = /^\s*[-*]\s+`[^`]+`/;
const LIST_ITEM_MAYBE_TERM = /^\s*[-*]\s+.*?`[^`]+`/;

interface Issue {
  file: string;
  level: 'error' | 'warn';
  message: string;
}

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

async function validateCollection(
  collection: 'pre-study' | 'review',
): Promise<Issue[]> {
  const files = await listMarkdown(join(CONTENT_ROOT, collection));
  const issues: Issue[] = [];
  const slugs = new Set<string>();

  for (const path of files) {
    const rel = path.replace(REPO_ROOT + '/', '');
    const raw = await readFile(path, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data as Record<string, unknown>;

    const lessonId = fm.lessonId as string | undefined;
    const lessonNo = fm.lessonNo as number | undefined;
    const slug = fm.slug as string | undefined;
    const type = fm.type as string | undefined;
    const title = fm.title as string | undefined;

    if (!lessonId) issues.push({ file: rel, level: 'error', message: 'missing frontmatter: lessonId' });
    if (!lessonNo) issues.push({ file: rel, level: 'error', message: 'missing frontmatter: lessonNo' });
    if (!slug) issues.push({ file: rel, level: 'error', message: 'missing frontmatter: slug' });
    if (!type) issues.push({ file: rel, level: 'error', message: 'missing frontmatter: type' });
    if (!title) issues.push({ file: rel, level: 'error', message: 'missing frontmatter: title' });

    if (type && type !== collection) {
      issues.push({
        file: rel,
        level: 'error',
        message: `frontmatter type "${type}" does not match collection "${collection}"`,
      });
    }

    if (lessonId) {
      const match = lessonId.match(LESSON_ID);
      if (!match) {
        issues.push({
          file: rel,
          level: 'error',
          message: `lessonId "${lessonId}" does not match ^lesson-\\d{3}$`,
        });
      } else if (lessonNo !== undefined) {
        const expected = Number.parseInt(match[1] ?? '0', 10);
        if (expected !== lessonNo) {
          issues.push({
            file: rel,
            level: 'error',
            message: `lessonNo ${lessonNo} does not match lessonId "${lessonId}"`,
          });
        }
      }
    }

    if (slug) {
      if (slugs.has(slug)) {
        issues.push({ file: rel, level: 'error', message: `duplicate slug "${slug}"` });
      }
      slugs.add(slug);
    }

    if (collection === 'review') {
      const lines = parsed.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (BARE_TOPIC.test(line) && !TOPIC_HEADING.test(line)) {
          issues.push({
            file: rel,
            level: 'warn',
            message: `line ${i + 1}: topic heading does not match "## Topic N：..." pattern`,
          });
        }
        // Vocabulary list item: if it looks like a term but missing backticks, warn.
        if (/^\s*[-*]\s+[A-Za-z]/.test(line) && !LIST_ITEM_TERM.test(line) && !LIST_ITEM_MAYBE_TERM.test(line)) {
          // probably a regular English list item, only warn if followed by `：` (suggests vocab intent)
          if (line.includes('：') || line.includes(':')) {
            issues.push({
              file: rel,
              level: 'warn',
              message: `line ${i + 1}: list item looks like a vocabulary entry without backticks around the term`,
            });
          }
        }
      }
    }
  }

  return issues;
}

async function run(): Promise<void> {
  const issues: Issue[] = [];
  for (const collection of ['pre-study', 'review'] as const) {
    issues.push(...(await validateCollection(collection)));
  }

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');

  for (const issue of [...errors, ...warnings]) {
    const prefix = issue.level === 'error' ? 'ERROR' : 'WARN ';
    console.log(`${prefix} ${issue.file}: ${issue.message}`);
  }

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
