import { handlePreflight, jsonResponse } from './cors.js';
import { handleHealth } from './routes/health.js';
import { handleGetProgress, handlePutProgress } from './routes/progress.js';
import type { Env } from './types.js';

const API_PREFIX = '/api/v1';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return handlePreflight(env, origin);
    }

    if (!url.pathname.startsWith(API_PREFIX)) {
      return jsonResponse(
        { ok: false, error: 'not_found' },
        { env, origin, status: 404 },
      );
    }

    const path = url.pathname.slice(API_PREFIX.length);

    if (path === '/health' && request.method === 'GET') {
      return handleHealth(env, origin);
    }

    if (path.startsWith('/progress/')) {
      if (request.method === 'GET') {
        return handleGetProgress(request, env, origin);
      }
      if (request.method === 'PUT') {
        return handlePutProgress(request, env, origin);
      }
      return jsonResponse(
        { ok: false, error: 'method_not_allowed' },
        { env, origin, status: 405 },
      );
    }

    return jsonResponse(
      { ok: false, error: 'not_found' },
      { env, origin, status: 404 },
    );
  },
} satisfies ExportedHandler<Env>;
