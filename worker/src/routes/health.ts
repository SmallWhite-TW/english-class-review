import { jsonResponse } from '../cors.js';
import type { Env } from '../types.js';

export function handleHealth(env: Env, origin: string | null): Response {
  return jsonResponse(
    {
      ok: true,
      version: env.API_VERSION,
    },
    { env, origin },
  );
}
