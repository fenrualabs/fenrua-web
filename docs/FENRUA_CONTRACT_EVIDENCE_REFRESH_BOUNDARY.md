# Fenrua Contract Evidence Refresh Boundary

Status: active public contract boundary  
Last reviewed: 2026-07-12

## Controlled Placeholder

Contract evidence refresh in progress. Exact source, invariant, deployment,
bytecode, and runtime details will be published from the next frozen contract
evidence bundle.

## Prohibited Until Refresh

The public website must not finalize:

- Contract addresses.
- Deployment state.
- Bytecode identity.
- Invariants.
- Reserve state.
- Wallet flows.
- Presale or swap interfaces.
- Transaction controls.
- Chain safety claims.
- Runtime equivalence claims.

## Contract Boundary Register

| Content Class | Status | Public Handling |
| --- | --- | --- |
| Current verified contract evidence | Pending refreshed bundle | Do not publish exact claims |
| Current but incomplete contract evidence | Pending refreshed bundle | Placeholder only |
| Stale contract evidence | Superseded | Do not copy |
| Prototype contract UI | Deferred | Do not build controls |
| Chain observation | Read-only live | Label as observation only |
| Bytecode identity | Pending refreshed bundle | No inference from source |

## Re-Entry Condition

Exact contract claims may be reintroduced only when the refreshed bundle supplies
source, invariant, deployment, bytecode, runtime, toolchain, and reproduction
evidence from a frozen evidence revision.

