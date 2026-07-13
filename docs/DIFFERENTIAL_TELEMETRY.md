# Differential testing telemetry format

`kernel-status.js` contains a generated static snapshot with schema version
`fenrua.web.kernel-telemetry.v1`. It is generated only from allowlisted public
files in a checked-out `fenrua-kernel` commit.

## Provenance

The snapshot always distinguishes two revisions:

- `snapshotCommit`: the immutable kernel commit the sync action checked out.
- `frozenEvidenceRevision`: the source revision declared by the generated
  Genesis evidence report.

They are deliberately separate. A later repository commit must not be presented
as if it were the revision that produced the frozen evidence.

## Public fields

- Genesis suite ID, pass/fail state, and case totals.
- Differential campaign counts, deterministic seed, and sanitizer flags.
- Permanent regression ID, classification, domain, operation, and pass/fail
  state.
- Fixture filename, byte length, SHA-256, public encoding description, and a
  commit-pinned evidence URL.
- Regression report record/file SHA-256 values and a commit-pinned evidence URL.

## Exclusions

The generated surface must never include raw fixture bytes, operand limbs,
expected result limbs, witnesses, proving artifacts, private paths, secrets, or
ephemeral build paths. The website validates byte-level bindings for the
selected public artifacts it displays and links to immutable source revisions.
Those hash and link checks do not prove the artifacts' semantic correctness and
do not replay or interpret binary evidence in the browser.

## Sync contract

The synchronization action independently verifies canonical JSON record hashes,
cross-file SHA-256 and byte bindings, passing suite totals, immutable commit
identifiers, and the build-validation/review evidence revision before it writes
the generated section. Its write-authority job receives only a short-lived,
size-capped patch artifact, verifies that artifact's byte length and SHA-256,
revalidates the complete site, and stages the resulting commit on the
`automation/kernel-telemetry-sync` review branch. It never pushes directly to
protected `main`; publication requires a pull request, the required public-surface
check, and review. Any mismatch fails the action without changing the published
snapshot. The synchronization action does not rerun the cryptographic
campaigns, circuits, differential tests, sanitizer campaigns, or proofs that
produced the source evidence; it validates the publication bindings for the
allowlisted public artifacts only.

## Replay and rollback boundary

The public adapter applies a durable per-chain checkpoint after strict schema
and Ed25519 verification and before a record can reach the public response. A
single atomic Redis script binds the highest accepted sequence, observation
time, confirmed block, key fingerprint, and canonical payload digest. It
rejects rollback, same-sequence equivocation, unannounced key replacement, and
reuse of retired key material across requests and serverless instances.

Production fails closed unless the checkpoint store and stable production
namespace are configured. Authenticated rotation requires a certificate signed
by the previous Ed25519 key and bound to the exact previous checkpoint. The
browser retains its session-local high-water check as an additional independent
defense and accepts a changed key only when the public adapter supplies the
server-validated rotation binding for that browser's exact previous key and
a non-regressing bridge sequence. Clearing browser memory does not clear the
server-side checkpoint.

This control is an application-level continuity check backed by the configured
storage provider. It is not presented as Byzantine consensus, formal
linearizability during provider partitions, or evidence about private systems.
