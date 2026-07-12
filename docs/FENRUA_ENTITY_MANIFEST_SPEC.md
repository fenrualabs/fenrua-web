# Fenrua Entity Manifest Spec

Status: schema foundation  
Last reviewed: 2026-07-12

## Required Shape

```json
{
  "schema": "fenrua.entity-manifest.v1",
  "entity": {
    "id": "fenrua-entity:<stable-id>",
    "type": "agent|model|tool|workflow|operator|organization|deployment",
    "name": "<public-name>",
    "owner": "<operator-or-organization-id>"
  },
  "artifact": {
    "sourceRevision": "<git-sha-or-null>",
    "buildDigest": "<digest-or-null>",
    "dependencyLockDigest": "<digest-or-null>",
    "containerDigest": "<digest-or-null>"
  },
  "model": {
    "provider": "<provider-or-null>",
    "modelId": "<model-id-or-null>",
    "policyRevision": "<revision-or-null>"
  },
  "tools": [],
  "authorityPolicy": "<policy-id>",
  "evidenceBundles": [],
  "runtime": {
    "environment": "<environment-label>",
    "attestation": "<attestation-id-or-null>"
  },
  "revocation": {
    "state": "active|revoked|quarantined|superseded",
    "reason": null
  }
}
```

## Required Behavior

- Unknown fields may be retained but must not be used for authorization.
- Missing required identity or authority fields must produce `INCOMPLETE`.
- Unsupported schema versions must produce `UNSUPPORTED_SCHEMA`.
- Revoked manifests must produce `REVOKED`.

