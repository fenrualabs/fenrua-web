# Fenrua Developer Reproduction Report

Status: clean-checkout command set

Repository: `https://github.com/fenrualabs/fenrua-web.git`  
Node: `>=24 <25`  
Package manager: `npm`

## Commands

```bash
git clone https://github.com/fenrualabs/fenrua-web.git
cd fenrua-web
node --version
npm install
npm run validate
node scripts/test-toolchain-registry.mjs
node scripts/test-verify-examples.mjs
```

## Expected Summary

Validation should report static links OK, chain-progress public feed OK, public discovery OK, kernel telemetry OK, toolchain registry OK, verify result corpus OK, and static routes OK.

## Failure Fixture

`examples/verification-results/fail-closed.example.json` intentionally represents a failure outcome and must not be interpreted as an executable approval.

## Limitations

No hosted verifier, SDK, policy engine, runtime gate, wallet flow, or contract assurance is claimed.
