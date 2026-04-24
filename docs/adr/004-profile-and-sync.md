# ADR-004: Profile Model and Multi-Device Sync

- **Status**: Accepted
- **Date**: 2026-04-24

## Context

The site has exactly two users: White and Dave — two fellow students in the same English class. White owns and maintains the site; Dave uses it as a learner. Each user wants their own progress to sync across their own devices. Users do **not** need to see each other's progress.

We want the lightest possible approach that still gives cross-device sync. Full OAuth is overkill. Pure client-side localStorage cannot sync across devices.

## Decision

**Two hardcoded profiles (`white`, `dave`) selected via a front-end profile switcher. Each profile has an independent shared secret used to authenticate sync requests to a Cloudflare Worker backed by KV storage.**

Flow:

1. On first visit, the site prompts the user to pick a profile.
2. The choice is stored in `localStorage` together with that profile's secret (shipped in the front-end bundle).
3. All sync calls go to the worker with header `x-profile-secret: <secret>`.
4. The worker verifies the secret matches the profile before reading or writing KV.
5. CORS is locked to `https://smallwhite-tw.github.io`.

## Consequences

### Good

- No OAuth flow, no session state, no database user table.
- Adding a third profile is a config change (secret + worker env var + front-end constant), not a rewrite.
- Supports cross-device sync for each profile without sharing data between profiles.

### Bad

- Shared secrets shipped in the front-end bundle are **not strong authentication**. Anyone who can read the bundle can forge a sync request. The data being protected is low-value (personal study progress), so this is accepted.
- Secret rotation means a coordinated deploy: rotate CF worker secret → update GitHub Actions secret → redeploy front-end.
- CORS restriction to the Pages domain is a UX guard, not a security boundary — a direct HTTP client with a known secret still succeeds.

## Alternatives Considered

### Pure localStorage, no sync

- **Pros**: Zero backend.
- **Cons**: No cross-device sync. Conflicts with stated requirement.
- **Rejected because**: The requirement explicitly calls for sync.

### GitHub OAuth

- **Pros**: Real identity; both users already have GitHub accounts.
- **Cons**: OAuth callback, token storage, refresh handling — all for two users.
- **Rejected because**: Massively disproportionate.

### Cloudflare Access or Zero Trust

- **Pros**: Proper auth at the edge.
- **Cons**: Pulls the app into an SSO flow; probably requires additional CF plan.
- **Rejected because**: Same — too heavy.
