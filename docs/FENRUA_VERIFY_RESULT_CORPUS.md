# Fenrua Verify Result Corpus

Status: implemented

The verify corpus lives in `examples/verification-results/` and is linked from `/verify/`.

Required results:

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

Each fixture identifies input fixture, trigger, supplied evidence, absent evidence, safety consequence, execution decision, and human-review requirement. `scripts/test-verify-examples.mjs` enforces corpus completeness.
