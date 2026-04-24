import type { Env, ProfileId } from './types.js';

function expectedSecretFor(env: Env, profile: ProfileId): string {
  switch (profile) {
    case 'white':
      return env.WHITE_PROFILE_SECRET;
    case 'dave':
      return env.DAVE_PROFILE_SECRET;
  }
}

/**
 * Constant-time string comparison to avoid timing leaks on secret comparison.
 * Inputs must be the same length to avoid leaking length; we pad with nulls.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function verifyProfileSecret(
  env: Env,
  profile: ProfileId,
  providedSecret: string | null,
): boolean {
  if (providedSecret === null || providedSecret.length === 0) return false;
  const expected = expectedSecretFor(env, profile);
  if (!expected) return false;
  return timingSafeEqual(providedSecret, expected);
}
