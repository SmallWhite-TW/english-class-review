import type { ProfileId } from '../../types/progress.js';

export const PROFILE_IDS: readonly ProfileId[] = ['white', 'dave'] as const;

export const PROFILE_DISPLAY: Record<ProfileId, string> = {
  white: 'White',
  dave: 'Dave',
};

const STORAGE_KEY = 'ecr:active-profile';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isProfileId(value: string): value is ProfileId {
  return (PROFILE_IDS as readonly string[]).includes(value);
}

export function getActiveProfile(): ProfileId | null {
  if (!isBrowser()) return null;
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === null) return null;
  return isProfileId(value) ? value : null;
}

export function setActiveProfile(profile: ProfileId): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, profile);
  window.dispatchEvent(new CustomEvent('profile:changed', { detail: profile }));
}

export function clearActiveProfile(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('profile:changed', { detail: null }));
}

const SECRETS: Record<ProfileId, string> = {
  white: import.meta.env.PUBLIC_WHITE_PROFILE_SECRET ?? '',
  dave: import.meta.env.PUBLIC_DAVE_PROFILE_SECRET ?? '',
};

export function getProfileSecret(profile: ProfileId): string {
  return SECRETS[profile];
}

export function getWorkerUrl(): string {
  const url = import.meta.env.PUBLIC_WORKER_URL ?? '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
