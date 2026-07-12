# Fenrua Telemetry State Implementation

Status: implemented with declared limitation

## State Model

`api/chain-progress.js` exposes sanitized read-only observations for Chain 978 and Chain N521. Browser UI maps upstream data into terminal public states:

- `Partial` when a primary source confirms a fresh block but no independent source is available.
- `Stale` when the observed head exceeds the freshness policy.
- `Failure` for chain ID mismatch.
- `Unavailable` when no valid observation exists.

## Source Boundary

No RPC endpoint, credential, private host, latency detail, or probe identifier is exposed. The current implementation does not claim independent confirmation.

## Non-Claims

Chain height does not prove contract safety, bytecode identity, reserve state, deployment correctness, or wallet safety.
