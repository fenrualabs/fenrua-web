# Fenrua Performance Report

Status: static performance closure report

Controls:

- static HTML routes
- one small site stylesheet
- no wallet libraries
- no remote analytics
- no client framework hydration
- toolchain table server-rendered
- immutable caching for assets
- no-store caching for live chain telemetry

Budgets:

- HTML route: keep human-readable and static
- CSS: single shared file
- JavaScript: `kernel-status.js` only on overview, `toolchain.js` only on toolchain/evidence
- Registry JSON: downloadable evidence, not required for baseline table rendering

Field LCP, INP, and CLS require independent measurement after deployment.
