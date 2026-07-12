# Fenrua Security Kernel Spec

Status: public kernel specification foundation  
Last reviewed: 2026-07-12

## Responsibilities

The Fenrua security kernel is responsible for:

- Identity.
- Authority.
- Integrity.
- Policy.
- Evidence.
- Verification.
- Containment.
- Recovery.

## Non-Responsibilities

The kernel does not:

- Replace AI applications, agents, models, tools, cloud infrastructure, or chains.
- Certify production safety by itself.
- Infer deployment bytecode from source code.
- Authorize financial actions without explicit policy and human-control
  boundaries.
- Treat chain observation as chain safety.

## Primitive Model

| Primitive | Scope | Current Maturity |
| --- | --- | --- |
| Identity | Entity, artifact, build, model, tool, operator, deployment, evidence | Specification |
| Authority | Allow, deny, approval, scope, expiry, delegation, revocation | Specification |
| Integrity | Source, build, dependency, image, runtime, policy, manifest | Reference implementation |
| Policy | Filesystem, network, tool, repo, secret, database, signing, deployment | Specification |
| Evidence | Inputs, outputs, decisions, approvals, tests, builds, findings | Implemented surface |
| Verification | Hashes, signatures, manifests, completeness, lineage | Reference implementation |
| Containment | Fail-closed behavior for unsafe state | Specification |
| Recovery | Revocation, quarantine, rollback, key rotation, re-entry | Doctrine |

## State Transitions

```text
unregistered
  -> registered
  -> policy_bound
  -> evidence_required
  -> verified_with_limitations
  -> active
  -> revoked | quarantined | superseded
  -> recovered
```

## Fail-Closed Conditions

The kernel must fail closed for:

- Missing identity.
- Invalid identity.
- Stale evidence.
- Invalid signature.
- Runtime drift.
- Policy violation.
- Scope violation.
- Missing approval.
- Untrusted dependency.
- Revoked artifact.
- Unsupported environment.
- Incomplete evidence.

## Compatibility

Schemas are versioned. Unsupported schema versions must return
`UNSUPPORTED_SCHEMA` rather than accepting partial interpretation.

