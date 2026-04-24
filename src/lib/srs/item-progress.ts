import type {
  ConfidenceLevel,
  ItemProgressRecord,
  ItemType,
  ProfileId,
  ProfileProgressDocument,
} from '../../types/progress.js';
import { loadLocal, saveLocal } from '../progress/progress-store.js';
import { computeNextSchedule } from './schedule.js';

export interface ItemContext {
  itemId: string;
  type: ItemType;
  lessonId: string;
  reviewSlug: string;
}

export function rateItem(
  profile: ProfileId,
  ctx: ItemContext,
  confidence: ConfidenceLevel,
  now: Date = new Date(),
): ProfileProgressDocument {
  const doc = loadLocal(profile);
  const previous = doc.items[ctx.itemId] ?? null;

  const schedule = computeNextSchedule({ previous, confidence, now });

  const next: ItemProgressRecord = {
    itemId: ctx.itemId,
    type: ctx.type,
    lessonId: ctx.lessonId,
    reviewSlug: ctx.reviewSlug,
    confidence,
    lastReviewedAt: schedule.lastReviewedAt,
    nextDueAt: schedule.nextDueAt,
    intervalDays: schedule.intervalDays,
    reviewCount: schedule.reviewCount,
    consecutiveMastery: schedule.consecutiveMastery,
    updatedAt: now.toISOString(),
  };

  const updated: ProfileProgressDocument = {
    ...doc,
    updatedAt: now.toISOString(),
    items: { ...doc.items, [ctx.itemId]: next },
  };
  saveLocal(updated);
  return updated;
}

export function getItemState(
  profile: ProfileId,
  itemId: string,
): ItemProgressRecord | null {
  const doc = loadLocal(profile);
  return doc.items[itemId] ?? null;
}

export function allItemStates(profile: ProfileId): Record<string, ItemProgressRecord> {
  return loadLocal(profile).items;
}
