# Vercel Publishing

Canonical production domain: `fenrua.ai`

Canonical Vercel project: `fenrua-web`

Node runtime: `24.x`

## Project Settings

Use these settings for the existing Vercel project:

- Project: `fenrua-web`
- Framework preset: `Other`
- Root directory: repository root
- Node.js version: `24.x`
- Install command: `npm ci --omit=dev`
- Build command: `npm run build:release`
- Output directory: `public` (generated deterministically by the release build)
- Production branch: `main`
- Production domain: `fenrua.ai`

The pinned production command passes the checked-out, approved commit as the
`VERCEL_GIT_COMMIT_SHA` build variable. Enable Vercel's system environment
variables as well for Git-triggered builds. The generated public release
manifest binds only the listed public static artifacts to that source commit;
it never prints credentials, project identifiers, or protected operational
data.

## Domain

In Vercel, open the project, go to **Settings -> Domains**, and add:

- `fenrua.ai` as the canonical production domain
- `www.fenrua.ai` as an alias; the committed host-specific redirect sends every
  `www` request permanently to `https://fenrua.ai`

Do not add project IDs, organisation IDs, credentials, tokens, or other project
internals to this repository.

## Notes

`vercel.json` keeps clean URLs, security headers, cache headers, the current
`/audit` route, and redirects for superseded `/genesis` and `/regression`
routes. Release evidence is limited to the public static artifacts listed in
the generated release manifest; it does not attest to protected systems or live
block-card data.

Do not add analytics, pixels, session replay, remote embeds, or third-party
tracking scripts.

The site provides access-only technology services through tiered subscriptions
and client-specific business agreements. See the
[access-only commercial boundary](ACCESS_ONLY_COMMERCIAL_BOUNDARY.md); this
repository must not describe a token, investment, exchange, trading, or
financial-return product.

## Publish From WSL

Use Node 24 from a clean checkout of the owner-approved `main` commit. The
pinned deployment command rejects all other branches:

```bash
npm ci
npm run release:check
npm run deploy:production:node24
```

The script runs the full release gate (including the limited non-live browser
checks), creates and validates the release manifest, then uses the locked
`vercel` CLI version to deploy production to `fenrua-web`. It passes the exact
checked-out commit to the remote build as `VERCEL_GIT_COMMIT_SHA`; browser
testing stays outside the Vercel build because Vercel installs production
dependencies only.

After deployment, observe the public static artifact set without writing to
the deployment:

```bash
npm run audit:live-release -- --url https://fenrua.ai --expected-commit <40-character-commit>
```

Retain that command's receipt with the release record. It is an observation at
a point in time, not an assertion about live cards, APIs, protected systems, or
future alias state.

## Rollback and external cleanup

If the public audit fails, re-promote the last passing production deployment.
The owner has approved removal of every prior deployment and alias associated
with `fenrua.ai` or `www.fenrua.ai`; retain only the audited canonical
production release. Keep `www.fenrua.ai` only as a permanent redirect to
`https://fenrua.ai`, never as a second content site. Do not record credentials,
server-environment values, or other protected project internals in this
repository.
