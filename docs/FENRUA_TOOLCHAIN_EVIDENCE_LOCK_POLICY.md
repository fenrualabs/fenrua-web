# Fenrua Toolchain Evidence Lock Policy

Status: evidence integrity policy  
Last reviewed: 2026-07-12

## Principle

Integrity means the public toolchain registry matches the audited evidence
environment. It does not mean changing tools to the newest available version
after evidence has already been captured.

## Current Rule

No toolchain, package, OS, or container update is performed as part of the
website refoundation. The registry preserves detected versions so the public
surface does not drift away from the evidence state.

## Dependency Drift Review

| Surface | Result | Public Handling |
| --- | --- | --- |
| `fenrua-web` package dependencies | No package dependency drift observed; no dependencies are declared | Preserve current site package state |
| Inspected `fenrua-kernel` direct pnpm dependencies | No direct dependency drift observed | Preserve audited/evidence-aligned dependency state |
| Global tools | Exact versions captured | Publish detected versions, not guessed updates |
| Containers | Local image identities captured where relevant | Do not infer freshness or security from image presence |

## Future Change Rule

If a dependency or tool is intentionally updated later, Fenrua must:

1. Capture the exact new version.
2. Re-run the relevant audit/evidence pipeline.
3. Freeze a new evidence bundle.
4. Update `data/toolchain-registry.json`.
5. Update `docs/FENRUA_TOOLCHAIN_LOCK.md`.
6. Reconcile public claims against the new evidence.

Until then, the existing evidence-aligned versions remain canonical for this
public lock.

