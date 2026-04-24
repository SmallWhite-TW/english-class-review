import type { ProfileId, ProfileProgressDocument } from '../../types/progress.js';
import { getProfileSecret, getWorkerUrl } from '../profile/profile-store.js';
import { loadLocal, mergeDocument, saveLocal } from './progress-store.js';

interface ApiSuccess {
  ok: true;
  data: ProfileProgressDocument;
}

interface ApiFailure {
  ok: false;
  error: string;
  detail?: string;
}

type ApiResponse = ApiSuccess | ApiFailure;

function endpoint(profile: ProfileId): string {
  const base = getWorkerUrl();
  if (!base) throw new Error('PUBLIC_WORKER_URL is not configured');
  return `${base}/api/v1/progress/${profile}`;
}

function headers(profile: ProfileId): HeadersInit {
  const secret = getProfileSecret(profile);
  return {
    'Content-Type': 'application/json',
    'x-profile-secret': secret,
  };
}

export async function pullProgress(
  profile: ProfileId,
): Promise<ProfileProgressDocument> {
  const res = await fetch(endpoint(profile), {
    method: 'GET',
    headers: headers(profile),
  });
  const body = (await res.json()) as ApiResponse;
  if (!res.ok || !body.ok) {
    const err = body as ApiFailure;
    throw new Error(`pull failed: ${err.error} ${err.detail ?? ''}`);
  }
  return body.data;
}

export async function pushProgress(
  document: ProfileProgressDocument,
): Promise<ProfileProgressDocument> {
  const res = await fetch(endpoint(document.profile), {
    method: 'PUT',
    headers: headers(document.profile),
    body: JSON.stringify(document),
  });
  const body = (await res.json()) as ApiResponse;
  if (!res.ok || !body.ok) {
    const err = body as ApiFailure;
    throw new Error(`push failed: ${err.error} ${err.detail ?? ''}`);
  }
  return body.data;
}

/**
 * Pull → merge with local → push → save merged. Safe to call on focus,
 * on visibilitychange, or after each local edit (debounced).
 */
export async function syncProgress(
  profile: ProfileId,
): Promise<ProfileProgressDocument> {
  const remote = await pullProgress(profile);
  const local = loadLocal(profile);
  const merged = mergeDocument(local, remote);
  const confirmed = await pushProgress(merged);
  saveLocal(confirmed);
  return confirmed;
}

let pendingSync: Promise<ProfileProgressDocument> | null = null;
let debounceHandle: number | null = null;

export function scheduleSync(profile: ProfileId, delayMs = 1500): void {
  if (typeof window === 'undefined') return;
  if (debounceHandle !== null) {
    window.clearTimeout(debounceHandle);
  }
  debounceHandle = window.setTimeout(() => {
    debounceHandle = null;
    if (pendingSync !== null) return;
    pendingSync = syncProgress(profile)
      .catch((err) => {
        console.warn('[progress-sync]', err);
        return loadLocal(profile);
      })
      .finally(() => {
        pendingSync = null;
      }) as Promise<ProfileProgressDocument>;
  }, delayMs);
}
