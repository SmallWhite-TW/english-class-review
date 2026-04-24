import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://smallwhite-tw.github.io',
  base: '/english-class-review',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_WORKER_URL': JSON.stringify(
        process.env.PUBLIC_WORKER_URL ?? ''
      ),
    },
  },
});
