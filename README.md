# English Class Review

Weekly English class review site for White and Dave. Static site hosted on GitHub Pages, with a Cloudflare Worker handling cross-device progress sync.

- **Site**: https://smallwhite-tw.github.io/english-class-review/ (once deployed)
- **Architecture**: see [docs/adr/](docs/adr/)

## Stack

| Layer | Choice |
|---|---|
| Front-end | Astro (static output) |
| Hosting | GitHub Pages |
| Content | Markdown under `src/content/{pre-study,review}` with Zod frontmatter schema |
| Search | Pagefind (full text) + custom vocabulary extractor |
| Sync API | Cloudflare Worker + KV (`worker/`) |
| CI/CD | GitHub Actions |

## Layout

```
.
├── docs/adr/                  # Architecture Decision Records
├── public/                    # Static assets copied as-is
├── scripts/                   # Build-time scripts (migration, parsing)
├── src/
│   ├── components/
│   ├── content/
│   │   ├── config.ts          # Astro content collection schemas
│   │   ├── pre-study/         # Pre-class markdown
│   │   ├── review/            # Post-class markdown
│   │   └── generated/         # Build-produced JSON (vocabulary, search docs)
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── types/
├── worker/                    # Cloudflare Worker + KV sync API
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Local development

Prerequisites: Node 20+, npm 10+.

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill values (see "Secrets" below)
cp .env.example .env

# 3. One-time: migrate lesson markdown from the local english-courses directory
npm run migrate:lessons

# 4. Start dev server
npm run dev
```

The dev server runs at `http://localhost:4321/english-class-review/` (note the base path — see [ADR-003](docs/adr/003-hosting-and-deployment.md)).

## Secrets

### Local `.env`

Copy `.env.example` to `.env` and fill in the values. This file is gitignored.

| Variable | Used by | Source |
|---|---|---|
| `CF_ACCOUNT_ID` | `wrangler` | Cloudflare dashboard sidebar (32-char hex) |
| `CF_API_TOKEN` | `wrangler` | Cloudflare → My Profile → API Tokens (scope: Edit Workers) |
| `CF_KV_NAMESPACE_ID` | `wrangler.toml` | `wrangler kv namespace create PROGRESS_KV` |
| `CF_WORKER_URL` | Astro build-time | Worker deploy URL |
| `WHITE_PROFILE_SECRET` | front-end + worker | `openssl rand -hex 32` |
| `DAVE_PROFILE_SECRET` | front-end + worker | `openssl rand -hex 32` |
| `PUBLIC_WORKER_URL` | front-end (runtime) | normally mirrors `CF_WORKER_URL` |

### GitHub Actions secrets

Set these in repo Settings → Secrets and variables → Actions. The deploy workflows consume them.

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_KV_NAMESPACE_ID`
- `WHITE_PROFILE_SECRET`
- `DAVE_PROFILE_SECRET`
- `PUBLIC_WORKER_URL`

### Cloudflare Worker secrets

Set with `wrangler secret put <NAME>` from `worker/`:

- `WHITE_PROFILE_SECRET`
- `DAVE_PROFILE_SECRET`

## Content workflow

New lessons land in `src/content/{pre-study,review}/` as markdown with the frontmatter shape defined in `src/content/config.ts`. After adding content:

```bash
npm run validate:content     # lint frontmatter + vocabulary format
npm run extract:vocabulary   # regenerate src/content/generated/vocabulary.json
npm run build                # produce dist/
```

Push to `main` triggers `.github/workflows/deploy-pages.yml`.

## License

Private. Not licensed for external redistribution.
