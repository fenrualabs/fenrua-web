# Fenrua Research To Infrastructure Standard

Status: research governance standard  
Last reviewed: 2026-07-12

## Lifecycle

Every research discovery must move through this lifecycle before it is promoted
as infrastructure:

```text
Research observation
-> formal claim
-> explicit non-claims
-> threat or invariant
-> test vector
-> reference implementation
-> multi-tool validation
-> independent verifier
-> machine-readable evidence
-> reusable kernel primitive
-> integration utility
-> regression protection
```

## Public Research Record Fields

Each record must expose:

- Discovery title.
- Problem statement.
- Research question.
- Formal claim.
- Explicit non-claims.
- Threat model.
- Assumptions.
- Implementation artifact.
- Tools used.
- Commands used.
- Test evidence.
- Reproduction instructions.
- Evidence hash.
- Kernel primitive affected.
- Utility derived.
- Maturity.
- Known unresolved issues.
- Last reviewed date.
- Source revision.
- Supersession status.

## Promotion Rule

No research observation becomes a public infrastructure claim until the claim,
non-claim, threat, test vector, implementation artifact, and evidence path are
adjacent.

