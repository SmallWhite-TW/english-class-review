import { getActiveProfile } from '../profile/profile-store.js';
import {
  computeProgress,
  loadLocal,
  updateTopic,
} from './progress-store.js';
import { scheduleSync, syncProgress } from './sync-client.js';
import type { ConfidenceLevel, ProfileId } from '../../types/progress.js';

function parseConfidence(value: string): ConfidenceLevel | null {
  const n = Number.parseInt(value, 10);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

function applyStateToControl(
  el: HTMLElement,
  reviewed: boolean,
  confidence: ConfidenceLevel | null,
): void {
  const checkbox = el.querySelector<HTMLInputElement>(
    'input[type="checkbox"][data-role="reviewed"]',
  );
  if (checkbox) checkbox.checked = reviewed;
  const select = el.querySelector<HTMLSelectElement>(
    'select[data-role="confidence"]',
  );
  if (select) select.value = confidence === null ? '' : String(confidence);
}

function refreshAllControlsForTopic(
  topicId: string,
  reviewed: boolean,
  confidence: ConfidenceLevel | null,
): void {
  document
    .querySelectorAll<HTMLElement>(`[data-topic-id="${CSS.escape(topicId)}"]`)
    .forEach((el) => applyStateToControl(el, reviewed, confidence));
}

function refreshReviewHeaderProgress(topicIds: readonly string[]): void {
  const profile = getActiveProfile();
  if (!profile) return;
  const doc = loadLocal(profile);
  const relevant = topicIds
    .map((id) => doc.topics[id])
    .filter((t): t is NonNullable<typeof t> => t !== undefined);
  const reviewed = relevant.filter((t) => t.reviewed).length;
  const total = topicIds.length;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);

  const fill = document.getElementById('review-progress-fill');
  const label = document.getElementById('review-progress-label');
  if (fill) fill.style.width = `${percent}%`;
  if (label) {
    label.textContent =
      total === 0
        ? '無 topic'
        : `${reviewed}/${total} 已複習（${percent}%）`;
  }
}

function handleReviewedChange(
  control: HTMLElement,
  profile: ProfileId,
): void {
  const topicId = control.dataset.topicId;
  const lessonId = control.dataset.lessonId;
  const reviewSlug = control.dataset.reviewSlug;
  if (!topicId || !lessonId || !reviewSlug) return;
  const checkbox = control.querySelector<HTMLInputElement>(
    'input[type="checkbox"][data-role="reviewed"]',
  );
  if (!checkbox) return;
  const reviewed = checkbox.checked;
  const doc = updateTopic(profile, lessonId, reviewSlug, topicId, { reviewed });
  const record = doc.topics[topicId];
  if (record) {
    refreshAllControlsForTopic(topicId, record.reviewed, record.confidence);
  }
  scheduleSync(profile);
}

function handleConfidenceChange(
  control: HTMLElement,
  profile: ProfileId,
): void {
  const topicId = control.dataset.topicId;
  const lessonId = control.dataset.lessonId;
  const reviewSlug = control.dataset.reviewSlug;
  if (!topicId || !lessonId || !reviewSlug) return;
  const select = control.querySelector<HTMLSelectElement>(
    'select[data-role="confidence"]',
  );
  if (!select) return;
  const confidence = parseConfidence(select.value);
  const doc = updateTopic(profile, lessonId, reviewSlug, topicId, { confidence });
  const record = doc.topics[topicId];
  if (record) {
    refreshAllControlsForTopic(topicId, record.reviewed, record.confidence);
  }
  scheduleSync(profile);
}

function wireControls(profile: ProfileId): void {
  document
    .querySelectorAll<HTMLElement>('.topic-progress')
    .forEach((control) => {
      const checkbox = control.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-role="reviewed"]',
      );
      const select = control.querySelector<HTMLSelectElement>(
        'select[data-role="confidence"]',
      );
      checkbox?.addEventListener('change', () =>
        handleReviewedChange(control, profile),
      );
      select?.addEventListener('change', () =>
        handleConfidenceChange(control, profile),
      );
    });
}

function hydrateFromLocalStorage(profile: ProfileId): void {
  const doc = loadLocal(profile);
  for (const record of Object.values(doc.topics)) {
    refreshAllControlsForTopic(record.topicId, record.reviewed, record.confidence);
  }
}

function getTopicIdsFromArticle(): string[] {
  const article = document.querySelector<HTMLElement>('article[data-topic-ids]');
  if (!article) return [];
  const raw = article.dataset.topicIds ?? '';
  return raw.split(',').filter(Boolean);
}

export function initTopicProgressUi(): void {
  const profile = getActiveProfile();
  const topicIds = getTopicIdsFromArticle();

  if (!profile) {
    document.querySelectorAll<HTMLInputElement>(
      '.topic-progress input, .topic-progress select',
    ).forEach((el) => {
      el.disabled = true;
      el.title = '請先到 /profile 選擇一個 profile';
    });
    refreshReviewHeaderProgress(topicIds);
    return;
  }

  hydrateFromLocalStorage(profile);
  wireControls(profile);
  refreshReviewHeaderProgress(topicIds);

  window.addEventListener('progress:changed', () => {
    refreshReviewHeaderProgress(topicIds);
  });

  syncProgress(profile)
    .then(() => {
      hydrateFromLocalStorage(profile);
      refreshReviewHeaderProgress(topicIds);
    })
    .catch((err) => console.warn('[progress-sync]', err));
}

/**
 * For the home page: compute per-lesson reviewed percentage and paint the
 * progress bars on each lesson card. Topic totals come from the DOM dataset
 * because the server doesn't know which topics exist in a given lesson —
 * the server only has records once a user interacts.
 */
export function initLessonCardProgress(
  totalsByLessonId: Record<string, number>,
): void {
  const profile = getActiveProfile();
  if (!profile) return;
  const doc = loadLocal(profile);

  const perLesson: Record<string, number> = {};
  for (const record of Object.values(doc.topics)) {
    if (!record.reviewed) continue;
    perLesson[record.lessonId] = (perLesson[record.lessonId] ?? 0) + 1;
  }

  document
    .querySelectorAll<HTMLElement>('.progress[data-lesson-id]')
    .forEach((el) => {
      const lessonId = el.dataset.lessonId;
      if (!lessonId) return;
      const total = totalsByLessonId[lessonId] ?? 0;
      const reviewed = perLesson[lessonId] ?? 0;
      const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);
      const fill = el.querySelector<HTMLElement>('.progress-fill');
      const label = el.querySelector<HTMLElement>('.progress-label');
      if (fill) fill.style.width = `${percent}%`;
      if (label) {
        label.textContent =
          total === 0 ? '無 topic' : `${reviewed}/${total} · ${percent}%`;
      }
    });
}

export { computeProgress };
