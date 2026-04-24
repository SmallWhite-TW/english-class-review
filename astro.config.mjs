import { defineConfig } from 'astro/config';

// The worker URL and profile secrets are read from env at build time.
// Non-PUBLIC_ names are preserved for the worker deploy; we alias them into
// PUBLIC_* so Astro exposes them to the browser bundle. See ADR-004.
const WORKER_URL =
  process.env.PUBLIC_WORKER_URL ?? process.env.CF_WORKER_URL ?? '';
const WHITE_SECRET =
  process.env.PUBLIC_WHITE_PROFILE_SECRET ??
  process.env.WHITE_PROFILE_SECRET ??
  '';
const DAVE_SECRET =
  process.env.PUBLIC_DAVE_PROFILE_SECRET ??
  process.env.DAVE_PROFILE_SECRET ??
  '';

export default defineConfig({
  site: 'https://smallwhite-tw.github.io',
  base: '/english-class-review',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_WORKER_URL': JSON.stringify(WORKER_URL),
      'import.meta.env.PUBLIC_WHITE_PROFILE_SECRET': JSON.stringify(WHITE_SECRET),
      'import.meta.env.PUBLIC_DAVE_PROFILE_SECRET': JSON.stringify(DAVE_SECRET),
    },
  },
});
