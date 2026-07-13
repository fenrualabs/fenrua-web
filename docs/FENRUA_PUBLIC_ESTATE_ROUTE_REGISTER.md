# Fenrua Public Estate Route Register

Status: current public route register

## Current Canonical

`/`, `/architecture`, `/kernel`, `/utilities`, `/research`, `/research/pn521-cross-limb-borrow`, `/research/toolchain-evidence-lock`, `/research/read-only-chain-observation`, `/verify`, `/developers`, `/toolchain`, `/evidence`, `/audit`, `/status`, `/legal`, `/support`, `/security`, `/accessibility`

## Retired Public Routes

`/nexus`, `/explorer`, `/fenswap`, `/fenpresale`, `/wallet`, `/register`,
`/login`, `/account`, `/codex`, `/labs`, `/privacy`, `/terms`, `/cookies`,
`/manifest.webmanifest`, `/v2`, and their retired child/API surfaces

Retired pages are no longer generated or deployed. Routes with an honest current
successor use a permanent redirect: `/nexus` and `/nexus/protocol` consolidate to
`/architecture`; the former chain explorers and monitoring routes consolidate to
`/status`; the N521 research route consolidates to
`/research/pn521-cross-limb-borrow`; and the former trust, audit, and release
routes consolidate to `/evidence` or `/audit` as appropriate.

Routes without an honest current successor—including `/fenswap`, `/fenpresale`,
`/wallet`, `/privacy`, and `/terms`—return HTTP 410 with a search-retirement
header. They do not redirect to the Legal and Company Centre. All retired routes
are excluded from the sitemap and static artifact set but remain crawlable so
search engines can observe the permanent redirect or 410 response.

Superseded documents are separately recorded under `docs/archive/2026-07-13/`; use `/audit` for the current public release scope.
