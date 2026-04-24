import type {
  ConfidenceLevel,
  ItemProgressRecord,
  ItemType,
} from '../../types/progress.js';

/**
 * Simplified SM-2 style scheduler.
 *
 * confidence 1  → reset to 1 day (treat as "not learned yet")
 * confidence 2  → 3 days
 * confidence 3  → 7 days (first time); subsequent times the interval grows
 *                 smoothly (prev * 1.5, capped at 30).
 * confidence 4  → 14 days (first time); subsequent times grow by * 2.0
 * confidence 5  → 30 days (first time); subsequent times * 2.5. A streak
 *                 of 5s pushes the interval further (30 → 75 → 187 → …).
 *
 * Intervals are capped at 120 days — the site is a personal review tool,
 * not an SRS optimiser; beyond four months we'd rather re-surface an item
 * than lose track of it entirely.
 */

const MS_PER_DAY = 86_400_000;
const MAX_INTERVAL_DAYS = 120;

const BASE_INTERVAL: Record<ConfidenceLevel, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

const GROWTH_FACTOR: Record<ConfidenceLevel, number> = {
  1: 0, // reset: don't grow
  2: 1.2,
  3: 1.5,
  4: 2.0,
  5: 2.5,
};

function clampInterval(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 1;
  return Math.min(Math.round(days), MAX_INTERVAL_DAYS);
}

export interface ScheduleInput {
  previous: ItemProgressRecord | null;
  confidence: ConfidenceLevel;
  now?: Date;
}

export interface ScheduleResult {
  intervalDays: number;
  lastReviewedAt: string;
  nextDueAt: string;
  reviewCount: number;
  consecutiveMastery: number;
}

/**
 * Given the previous state + the new confidence rating, compute the next
 * schedule. The caller is responsible for writing the merged record back
 * to the progress document.
 */
export function computeNextSchedule(input: ScheduleInput): ScheduleResult {
  const now = input.now ?? new Date();
  const previous = input.previous;
  const conf = input.confidence;

  const base = BASE_INTERVAL[conf];
  const growth = GROWTH_FACTOR[conf];

  let intervalDays: number;

  if (conf === 1) {
    // forgot — reset to short interval
    intervalDays = base;
  } else if (!previous || previous.intervalDays <= 0) {
    intervalDays = base;
  } else {
    // Grow previous interval. Keep the floor at `base` so a user who
    // temporarily dipped to 2 still gets at least 3 days, not a reset.
    const grown = previous.intervalDays * growth;
    intervalDays = Math.max(base, grown);
  }

  intervalDays = clampInterval(intervalDays);

  const next = new Date(now.getTime() + intervalDays * MS_PER_DAY);
  const reviewCount = (previous?.reviewCount ?? 0) + 1;
  const consecutiveMastery = conf === 5 ? (previous?.consecutiveMastery ?? 0) + 1 : 0;

  return {
    intervalDays,
    lastReviewedAt: now.toISOString(),
    nextDueAt: next.toISOString(),
    reviewCount,
    consecutiveMastery,
  };
}

export interface ItemLike {
  id: string;
  type: ItemType;
  lessonId: string;
  reviewSlug: string;
}

export interface QueueEntry<T extends ItemLike> {
  item: T;
  state: ItemProgressRecord | null;
  status: 'overdue' | 'due' | 'new';
  dueAt: Date | null;
}

export interface DailyQueue<T extends ItemLike> {
  overdue: QueueEntry<T>[];
  due: QueueEntry<T>[];
  new: QueueEntry<T>[];
  total: number;
}

export interface QueueOptions {
  /** Hard cap on queue size (new items are clamped first, then due). */
  maxSize?: number;
  /** Only consider these item types. Empty / undefined = all types. */
  types?: readonly ItemType[];
  /** Only consider these lessons. Empty / undefined = all lessons. */
  lessonIds?: readonly string[];
}

/**
 * Build today's review queue. Classification:
 *
 *   - overdue: has a state and nextDueAt < start-of-today
 *   - due:     has a state and nextDueAt falls within today (0–23:59 local)
 *   - new:     no state yet (item has never been reviewed)
 *
 * State with nextDueAt in the future is not returned.
 */
export function buildDailyQueue<T extends ItemLike>(
  items: readonly T[],
  progressByItem: Readonly<Record<string, ItemProgressRecord>>,
  now: Date = new Date(),
  options: QueueOptions = {},
): DailyQueue<T> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const typeAllow = options.types && options.types.length > 0 ? new Set(options.types) : null;
  const lessonAllow =
    options.lessonIds && options.lessonIds.length > 0 ? new Set(options.lessonIds) : null;

  const overdue: QueueEntry<T>[] = [];
  const due: QueueEntry<T>[] = [];
  const fresh: QueueEntry<T>[] = [];

  for (const item of items) {
    if (typeAllow && !typeAllow.has(item.type)) continue;
    if (lessonAllow && !lessonAllow.has(item.lessonId)) continue;

    const state = progressByItem[item.id] ?? null;
    if (state === null) {
      fresh.push({ item, state: null, status: 'new', dueAt: null });
      continue;
    }
    if (state.nextDueAt === null) {
      fresh.push({ item, state, status: 'new', dueAt: null });
      continue;
    }
    const dueAt = new Date(state.nextDueAt);
    if (Number.isNaN(dueAt.getTime())) continue;
    if (dueAt < startOfToday) {
      overdue.push({ item, state, status: 'overdue', dueAt });
    } else if (dueAt <= endOfToday) {
      due.push({ item, state, status: 'due', dueAt });
    }
    // future → skip
  }

  // Sort: overdue by oldest dueAt first, due by dueAt, new by lesson order.
  overdue.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  due.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  fresh.sort((a, b) => a.item.lessonId.localeCompare(b.item.lessonId));

  if (options.maxSize && options.maxSize > 0) {
    const cap = options.maxSize;
    const total = overdue.length + due.length + fresh.length;
    if (total > cap) {
      const over = overdue.slice(0, cap);
      const remaining = cap - over.length;
      const d = due.slice(0, Math.max(0, remaining));
      const remaining2 = cap - over.length - d.length;
      const n = fresh.slice(0, Math.max(0, remaining2));
      return { overdue: over, due: d, new: n, total: over.length + d.length + n.length };
    }
  }

  return { overdue, due, new: fresh, total: overdue.length + due.length + fresh.length };
}

export function flattenQueue<T extends ItemLike>(queue: DailyQueue<T>): QueueEntry<T>[] {
  // Order within a session: overdue → due → new (most urgent first).
  return [...queue.overdue, ...queue.due, ...queue.new];
}
