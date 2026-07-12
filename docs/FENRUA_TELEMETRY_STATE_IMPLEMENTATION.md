# Fenrua Telemetry State Implementation

Status: implemented with declared limitation

## State Model

`api/chain-progress.js` exposes sanitized, signed read-only observations for
Chain 978 and Chain N521 through separate bounded gateways and verification
keys. Until N521's independently signed path is configured, it is represented
as `Awaiting signed observation`, not as a fabricated live head. Browser UI
maps the bounded observations into terminal public states:

- `Live` when a two-source signed observation is fresh.
- `Partial` when the private watcher has not reached quorum.
- `Stale` when a previously confirmed observation exceeds the freshness policy.
- `Awaiting signed observation` when a chain has no configured independent
  evidence path.
- `Unavailable` when a configured path has no valid observation.

## Source Boundary

The gateway name is **Public Observation Gateway over Encrypted Private-Mesh
Transport**. No RPC endpoint, credential, private host, peer, validator
identity, latency detail, or probe identifier is exposed. The public adapter
accepts only one fixed response schema, verifies its Ed25519 signature against
the configured public key, rejects oversized responses and query requests, and
cannot proxy generic JSON-RPC. Signed records carry a visible sequence/activity
field, and can be checked independently using the fixed Chain 978 or Chain
N521 public-key endpoint.

## Non-Claims

Chain height does not prove contract safety, bytecode identity, reserve state, deployment correctness, or wallet safety.
