import { jsonResponse } from '../cors.js';
import { verifyProfileSecret } from '../auth.js';
import { emptyDocument, loadProgress, saveProgress } from '../kv/progress-store.js';
import { mergeProgressDocuments } from '../merge/merge-progress.js';
import type { Env, ProfileId, ProfileProgressDocument } from '../types.js';
import { PROGRESS_SCHEMA_VERSION, isProfileId } from '../types.js';

function unauthorized(env: Env, origin: string | null): Response {
  return jsonResponse(
    { ok: false, error: 'unauthorized' },
    { env, origin, status: 401 },
  );
}

function badRequest(
  env: Env,
  origin: string | null,
  detail: string,
): Response {
  return jsonResponse(
    { ok: false, error: 'bad_request', detail },
    { env, origin, status: 400 },
  );
}

function extractProfile(pathname: string): ProfileId | null {
  // /api/v1/progress/<profile>
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  return isProfileId(last) ? last : null;
}

function readSecret(request: Request): string | null {
  return request.headers.get('x-profile-secret');
}

function isValidDocument(
  value: unknown,
  profile: ProfileId,
): value is ProfileProgressDocument {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as Partial<ProfileProgressDocument>;
  if (doc.profile !== profile) return false;
  if (doc.version !== PROGRESS_SCHEMA_VERSION) return false;
  if (typeof doc.updatedAt !== 'string') return false;
  if (typeof doc.topics !== 'object' || doc.topics === null) return false;
  if (typeof doc.items !== 'object' || doc.items === null) return false;
  return true;
}

export async function handleGetProgress(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const profile = extractProfile(url.pathname);
  if (profile === null) return badRequest(env, origin, 'invalid_profile');

  if (!verifyProfileSecret(env, profile, readSecret(request))) {
    return unauthorized(env, origin);
  }

  const doc = (await loadProgress(env, profile)) ?? emptyDocument(profile);
  return jsonResponse({ ok: true, data: doc }, { env, origin });
}

export async function handlePutProgress(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const profile = extractProfile(url.pathname);
  if (profile === null) return badRequest(env, origin, 'invalid_profile');

  if (!verifyProfileSecret(env, profile, readSecret(request))) {
    return unauthorized(env, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest(env, origin, 'invalid_json');
  }

  if (!isValidDocument(payload, profile)) {
    return badRequest(env, origin, 'invalid_document');
  }

  const server = await loadProgress(env, profile);
  const merged = mergeProgressDocuments(server, payload);
  await saveProgress(env, merged);

  return jsonResponse({ ok: true, data: merged }, { env, origin });
}
