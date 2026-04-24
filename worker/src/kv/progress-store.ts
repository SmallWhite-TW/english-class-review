import type {
  Env,
  ProfileId,
  ProfileProgressDocument,
} from '../types.js';
import { PROGRESS_SCHEMA_VERSION } from '../types.js';

const KEY_PREFIX = 'progress:v1:';

function keyFor(profile: ProfileId): string {
  return `${KEY_PREFIX}${profile}`;
}

function migrate(doc: unknown, profile: ProfileId): ProfileProgressDocument | null {
  if (typeof doc !== 'object' || doc === null) return null;
  const anyDoc = doc as Partial<ProfileProgressDocument> & { version?: number };
  if (anyDoc.profile !== profile) return null;

  if (anyDoc.version === PROGRESS_SCHEMA_VERSION) {
    return {
      profile,
      version: PROGRESS_SCHEMA_VERSION,
      updatedAt: anyDoc.updatedAt ?? new Date(0).toISOString(),
      topics: anyDoc.topics ?? {},
      items: anyDoc.items ?? {},
    };
  }
  if (anyDoc.version === 1) {
    return {
      profile,
      version: PROGRESS_SCHEMA_VERSION,
      updatedAt: anyDoc.updatedAt ?? new Date(0).toISOString(),
      topics: anyDoc.topics ?? {},
      items: {},
    };
  }
  return null;
}

export async function loadProgress(
  env: Env,
  profile: ProfileId,
): Promise<ProfileProgressDocument | null> {
  const raw = await env.PROGRESS_KV.get(keyFor(profile), 'text');
  if (raw === null) return null;
  try {
    return migrate(JSON.parse(raw), profile);
  } catch {
    return null;
  }
}

export async function saveProgress(
  env: Env,
  doc: ProfileProgressDocument,
): Promise<void> {
  await env.PROGRESS_KV.put(keyFor(doc.profile), JSON.stringify(doc));
}

export function emptyDocument(profile: ProfileId): ProfileProgressDocument {
  return {
    profile,
    version: PROGRESS_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    topics: {},
    items: {},
  };
}
