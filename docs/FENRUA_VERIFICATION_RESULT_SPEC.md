# Fenrua Verification Result Spec

Status: schema foundation  
Last reviewed: 2026-07-12

## Deterministic Result Codes

- `PASS`
- `PASS_WITH_LIMITATIONS`
- `INCOMPLETE`
- `STALE`
- `POLICY_VIOLATION`
- `INTEGRITY_MISMATCH`
- `SIGNATURE_INVALID`
- `RUNTIME_UNVERIFIED`
- `REVOKED`
- `FAIL_CLOSED`
- `UNSUPPORTED_SCHEMA`
- `ERROR`

## Required Shape

```json
{
  "schema": "fenrua.verification-result.v1",
  "result": "PASS_WITH_LIMITATIONS",
  "manifestSchema": "valid",
  "identity": "verified",
  "signatures": "verified",
  "artifactIntegrity": "verified",
  "policyIntegrity": "verified",
  "evidenceCompleteness": "partial",
  "runtimeConformity": "unverified",
  "revocationStatus": "active",
  "findings": {
    "critical": 0,
    "high": 0,
    "medium": 1,
    "low": 0
  },
  "limitations": [
    "Production runtime attestation was not supplied"
  ]
}
```

## Verification Rule

No verifier result may claim more than the supplied artifacts prove.

