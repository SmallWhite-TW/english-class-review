import type { TopicMeta } from '../../types/content.js';

/**
 * Parse topic headings from a review markdown body.
 *
 * The convention (see docs/adr/record-style-guide — or the legacy
 * english-courses/record-style-guide.md) is:
 *
 *   ## Topic 1：自我介紹的開場與基本背景
 *   ### Topic 摘要
 *   ...
 *   ## Topic 2：工作內容與職場表達
 *   ...
 *
 * We treat each H2 that matches `## Topic N：...` as a topic. The topic id
 * is positional: lessonId :: reviewSlug :: topic-NNN, zero-padded to 3.
 *
 * For pre-study or review files that do not follow this convention, the
 * parser returns an empty array — callers should render the body as-is.
 */
const TOPIC_HEADING = /^##\s+Topic\s*(\d+)[：:\s]\s*(.+?)\s*$/;

export interface ParsedTopic extends TopicMeta {
  body: string;
  summary?: string;
}

export function parseTopics(
  lessonId: string,
  reviewSlug: string,
  markdown: string,
): ParsedTopic[] {
  const lines = markdown.split('\n');
  const topics: ParsedTopic[] = [];

  let current: { index: number; title: string; start: number } | null = null;

  const finalize = (endLine: number) => {
    if (current === null) return;
    const body = lines.slice(current.start, endLine).join('\n');
    const summary = extractSummary(body);
    const index = topics.length + 1;
    const paddedIndex = String(index).padStart(3, '0');
    topics.push({
      topicId: `${lessonId}::${reviewSlug}::topic-${paddedIndex}`,
      lessonId,
      reviewSlug,
      index,
      title: current.title,
      summary,
      body,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = line.match(TOPIC_HEADING);
    if (match) {
      finalize(i);
      current = {
        index: Number.parseInt(match[1] ?? '0', 10),
        title: match[2]?.trim() ?? '',
        start: i,
      };
    }
  }
  finalize(lines.length);

  return topics;
}

function extractSummary(topicBody: string): string | undefined {
  // First paragraph after "### Topic 摘要" if present.
  const match = topicBody.match(/###\s+Topic\s+摘要\s*\n+([^\n].*?)(?=\n\s*\n|\n###)/s);
  return match?.[1]?.trim();
}

/**
 * Lightweight topic list (no body) for progress UI — cheaper than parsing
 * the full body when we only need topic ids and titles.
 */
export function parseTopicMeta(
  lessonId: string,
  reviewSlug: string,
  markdown: string,
): TopicMeta[] {
  return parseTopics(lessonId, reviewSlug, markdown).map(
    ({ body: _body, ...meta }) => meta,
  );
}
