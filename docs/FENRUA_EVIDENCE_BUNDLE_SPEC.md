# Fenrua Evidence Bundle Spec

Status: schema foundation  
Last reviewed: 2026-07-12

## Required Shape

```json
{
  "schema": "fenrua.evidence-bundle.v1",
  "bundleId": "<stable-bundle-id>",
  "artifactId": "<artifact-id>",
  "producer": "<producer-id>",
  "createdAt": "<iso-8601>",
  "sourceRevision": "<git-sha-or-null>",
  "toolVersions": [],
  "commands": [],
  "inputs": [],
  "outputs": [],
  "hashes": [],
  "signatures": [],
  "findings": [],
  "limitations": [],
  "environment": {
    "publicLabel": "<safe-label>",
    "privateDetailsRedacted": true
  },
  "anchoring": [],
  "supersession": {
    "supersedes": null,
    "supersededBy": null
  },
  "revocation": {
    "state": "active|revoked|quarantined",
    "reason": null
  }
}
```

## Public Safety

Evidence bundles must not expose:

- Tokens or credentials.
- Private endpoints.
- Private IPs.
- Usernames.
- Home-directory paths.
- Signing material.
- Raw fixture bytes unless explicitly designed for public release.

