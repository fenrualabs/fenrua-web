# Fenrua Authority Policy Spec

Status: schema foundation  
Last reviewed: 2026-07-12

## Required Shape

```json
{
  "schema": "fenrua.authority-policy.v1",
  "policyId": "<stable-policy-id>",
  "subject": "<entity-id>",
  "issuedBy": "<operator-or-organization-id>",
  "issuedAt": "<iso-8601>",
  "expiresAt": "<iso-8601-or-null>",
  "rules": [
    {
      "effect": "allow|deny|human_approval",
      "action": "<action>",
      "tool": "<tool-or-wildcard>",
      "resource": "<resource>",
      "scope": {
        "filesystem": [],
        "network": [],
        "repository": [],
        "database": [],
        "infrastructure": [],
        "wallet": []
      },
      "environment": "<environment-or-wildcard>",
      "evidenceRequired": [],
      "failureMode": "fail_closed"
    }
  ],
  "delegation": {
    "allowed": false,
    "maxDepth": 0
  },
  "revocation": {
    "state": "active|revoked",
    "reason": null
  }
}
```

## Evaluation Rules

- Deny rules override allow rules.
- Human approval rules require explicit approval evidence before execution.
- Expired policies fail closed.
- Missing evidence requirements fail closed.
- Revoked policies fail closed.

