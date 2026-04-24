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

export async function loadProgress(
  env: Env,
  profile: ProfileId,
): Promise<ProfileProgressDocument | null> {
  const raw = await env.PROGRESS_KV.get(keyFor(profile), 'text');
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as ProfileProgressDocument;
    if (parsed.version !== PROGRESS_SCHEMA_VERSION) return null;
    if (parsed.profile !== profile) return null;
    return parsed;
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
  };
}
