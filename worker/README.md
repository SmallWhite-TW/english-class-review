# Cloudflare Worker: english-class-progress

Progress sync API for the English Class Review site. See [ADR-004](../docs/adr/004-profile-and-sync.md) and [ADR-005](../docs/adr/005-progress-model.md).

## Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| GET | `/progress/:profile` | `x-profile-secret` | Fetch latest progress for a profile |
| PUT | `/progress/:profile` | `x-profile-secret` | Merge-upload progress document |

CORS is locked to `ALLOWED_ORIGIN` (set in `wrangler.toml`).

## Local development

From the repo root (`..`):

```bash
# One-time: install dependencies (root package.json)
npm install

# Replace id in wrangler.toml with your real KV namespace id first.
# Create local secrets:
(cd worker && wrangler secret put WHITE_PROFILE_SECRET)
(cd worker && wrangler secret put DAVE_PROFILE_SECRET)

# Start a local dev session
npm run worker:dev
```

## Deployment

Deploy is handled by `.github/workflows/deploy-worker.yml` on push to `main` that touches `worker/**`. For manual deploy:

```bash
(cd worker && wrangler deploy)
```

The GitHub Actions secrets required are documented in the root `README.md`.
