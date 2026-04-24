import type { Env } from './types.js';

export function corsHeaders(env: Env, origin: string | null): HeadersInit {
  const allowedOrigin = env.ALLOWED_ORIGIN;
  const isAllowed = origin !== null && origin === allowedOrigin;

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-profile-secret',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; env: Env; origin: string | null },
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(init.env, init.origin),
    },
  });
}

export function handlePreflight(env: Env, origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env, origin),
  });
}
