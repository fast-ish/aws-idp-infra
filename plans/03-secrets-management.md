# Secrets Management

> **Status: PLANNED**

Centralized secrets management using AWS Secrets Manager with External Secrets Operator for Kubernetes integration.

## Overview

Secrets are stored in AWS Secrets Manager and automatically synced to Kubernetes secrets via External Secrets Operator (ESO). This provides:
- Centralized secret storage with audit trails
- Automatic rotation support
- IRSA-based access control
- No secrets in Git

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Secrets Management Flow                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         AWS Secrets Manager                                  ││
│  │                                                                              ││
│  │  /idp/                                                                       ││
│  │  ├── platform/                                                               ││
│  │  │   ├── github-oauth          # Backstage GitHub OAuth                     ││
│  │  │   ├── grafana-cloud         # Grafana Cloud API keys                     ││
│  │  │   └── slack-webhook         # Slack notifications                        ││
│  │  │                                                                           ││
│  │  ├── database/                                                               ││
│  │  │   ├── backstage             # Backstage DB credentials                   ││
│  │  │   └── argo                  # Argo archive DB credentials                ││
│  │  │                                                                           ││
│  │  └── teams/                                                                  ││
│  │      ├── team-alpha/                                                         ││
│  │      │   ├── api-keys                                                        ││
│  │      │   └── external-services                                               ││
│  │      └── team-beta/                                                          ││
│  │          └── ...                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                           │
│                                      │ IRSA                                      │
│                                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                     External Secrets Operator                                ││
│  │                                                                              ││
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         ││
│  │  │ ClusterSecret   │    │ ExternalSecret  │    │ ExternalSecret  │         ││
│  │  │ Store           │    │ (backstage ns)  │    │ (team-alpha ns) │         ││
│  │  │                 │    │                 │    │                 │         ││
│  │  │ AWS SM Provider │───▶│ Sync            │    │ Sync            │         ││
│  │  │ + IRSA Role     │    │ /idp/platform/* │    │ /idp/teams/     │         ││
│  │  └─────────────────┘    │                 │    │ team-alpha/*    │         ││
│  │                         └────────┬────────┘    └────────┬────────┘         ││
│  └──────────────────────────────────┼──────────────────────┼───────────────────┘│
│                                     │                      │                    │
│                                     ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Kubernetes Secrets                                   ││
│  │                                                                              ││
│  │  backstage namespace:              team-alpha namespace:                     ││
│  │  ┌─────────────────────┐           ┌─────────────────────┐                  ││
│  │  │ backstage-github-   │           │ team-alpha-api-keys │                  ││
│  │  │ oauth               │           │                     │                  ││
│  │  │                     │           │ • api_key           │                  ││
│  │  │ • client_id         │           │ • secret            │                  ││
│  │  │ • client_secret     │           └─────────────────────┘                  ││
│  │  └─────────────────────┘                                                    ││
│  │                                                                              ││
│  │  ┌─────────────────────┐                                                    ││
│  │  │ backstage-db-       │           Pods mount secrets as:                   ││
│  │  │ credentials         │           • Environment variables                  ││
│  │  │                     │           • Volume mounts                          ││
│  │  │ • host              │           • CSI driver                             ││
│  │  │ • username          │                                                    ││
│  │  │ • password          │                                                    ││
│  │  └─────────────────────┘                                                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## External Secrets Operator Setup

### 1. ClusterSecretStore

```yaml
# cluster-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: {{region}}
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

### 2. IRSA Role

```java
// IamStack.java
Role externalSecretsRole = Role.Builder.create(this, "ExternalSecretsRole")
    .roleName("idp-external-secrets-sa")
    .assumedBy(new FederatedPrincipal(
        oidcProviderArn,
        Map.of("StringEquals", Map.of(
            oidcIssuer + ":sub", "system:serviceaccount:external-secrets:external-secrets",
            oidcIssuer + ":aud", "sts.amazonaws.com"
        )),
        "sts:AssumeRoleWithWebIdentity"
    ))
    .build();

// Allow reading all IDP secrets
externalSecretsRole.addToPolicy(PolicyStatement.Builder.create()
    .effect(Effect.ALLOW)
    .actions(List.of(
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
    ))
    .resources(List.of(
        "arn:aws:secretsmanager:" + region + ":" + account + ":secret:/idp/*"
    ))
    .build());
```

### 3. ExternalSecret Examples

```yaml
# Platform secrets
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: backstage-github-oauth
  namespace: backstage
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager

  target:
    name: backstage-github-oauth
    creationPolicy: Owner

  data:
    - secretKey: client_id
      remoteRef:
        key: /idp/platform/github-oauth
        property: client_id

    - secretKey: client_secret
      remoteRef:
        key: /idp/platform/github-oauth
        property: client_secret
```

```yaml
# Database credentials with rotation
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: backstage-db-credentials
  namespace: backstage
spec:
  refreshInterval: 5m  # Frequent refresh for rotation
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager

  target:
    name: backstage-db-credentials
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        # Template the connection string
        connection-string: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:5432/backstage"

  dataFrom:
    - extract:
        key: /idp/database/backstage
```

```yaml
# Team-scoped secrets
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: team-alpha-secrets
  namespace: team-alpha
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager

  target:
    name: team-alpha-secrets
    creationPolicy: Owner

  dataFrom:
    - extract:
        key: /idp/teams/team-alpha/api-keys
```

## Secret Rotation

### Aurora Auto-Rotation

```java
// DataStack.java - Aurora with auto-rotation
Secret databaseSecret = Secret.Builder.create(this, "DatabaseSecret")
    .secretName("/idp/database/backstage")
    .generateSecretString(SecretStringGenerator.builder()
        .secretStringTemplate("{\"username\":\"backstage\"}")
        .generateStringKey("password")
        .excludePunctuation(true)
        .passwordLength(32)
        .build())
    .build();

// Enable rotation
databaseSecret.addRotationSchedule("RotationSchedule",
    RotationScheduleOptions.builder()
        .automaticallyAfter(Duration.days(30))
        .hostedRotation(HostedRotation.postgreSqlSingleUser(
            SingleUserHostedRotationOptions.builder()
                .functionName("idp-db-rotation")
                .vpc(vpc)
                .securityGroups(List.of(dbSecurityGroup))
                .build()
        ))
        .build());
```

### ESO Refresh Behavior

```yaml
# Fast refresh for rotated secrets
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: rotated-secret
spec:
  refreshInterval: 5m  # Check every 5 minutes

  # Or use PushSecret for immediate updates
  # (requires ESO webhook)
```

## Secrets Hierarchy

```
/idp/
├── platform/                    # Platform-wide secrets
│   ├── github-oauth             # GitHub OAuth app
│   ├── github-token             # GitHub PAT for Argo CD
│   ├── grafana-cloud            # Grafana Cloud credentials
│   ├── slack-webhook            # Slack notifications
│   └── argocd-admin             # Argo CD admin password
│
├── database/                    # Database credentials
│   ├── backstage                # Backstage PostgreSQL
│   │   ├── host
│   │   ├── port
│   │   ├── username
│   │   └── password
│   └── argo                     # Argo archive PostgreSQL
│
├── certificates/                # TLS certificates (if not using ACM)
│   └── wildcard                 # Wildcard cert
│
└── teams/                       # Team-specific secrets
    ├── team-alpha/
    │   ├── api-keys             # External API keys
    │   ├── database             # Team database credentials
    │   └── ssh-keys             # Deployment keys
    └── team-beta/
        └── ...
```

## Access Control

### IAM Policies per Namespace

```yaml
# Team-scoped SecretStore (optional - for strict isolation)
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: team-alpha-secrets
  namespace: team-alpha
spec:
  provider:
    aws:
      service: SecretsManager
      region: {{region}}
      auth:
        jwt:
          serviceAccountRef:
            name: team-alpha-secrets-sa
            namespace: team-alpha
```

```json
// Team-scoped IAM policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-west-2:*:secret:/idp/teams/team-alpha/*"
      ]
    }
  ]
}
```

## Kyverno Policies for Secrets

```yaml
# Prevent secrets from being created without ESO
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-external-secrets
spec:
  validationFailureAction: enforce
  background: false
  rules:
    - name: check-secret-origin
      match:
        any:
          - resources:
              kinds:
                - Secret
              namespaces:
                - "team-*"
      exclude:
        any:
          - resources:
              annotations:
                reconcile.external-secrets.io/managed: "true"
      validate:
        message: "Secrets must be managed by External Secrets Operator"
        deny: {}
```

```yaml
# Prevent hardcoded secrets in deployments
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: no-hardcoded-secrets
spec:
  validationFailureAction: enforce
  rules:
    - name: check-env-secrets
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
      validate:
        message: "Environment variables must use secretKeyRef, not hardcoded values"
        pattern:
          spec:
            template:
              spec:
                containers:
                  - env:
                      - valueFrom:
                          secretKeyRef:
                            name: "*"
                            key: "*"
```

## Secrets in CI/CD

### Argo Workflows Access

```yaml
# Workflow template with secret access
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: deploy-with-secrets
spec:
  templates:
    - name: deploy
      container:
        image: bitnami/kubectl
        env:
          # From Kubernetes secret (synced from SM)
          - name: API_KEY
            valueFrom:
              secretKeyRef:
                name: team-alpha-secrets
                key: api_key
```

### Direct Secrets Manager Access (for builds)

```yaml
# For workflows that need SM directly
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: build-with-secrets
spec:
  serviceAccountName: argo-workflows-executor  # Has SM access
  templates:
    - name: build
      container:
        image: amazon/aws-cli
        command: [sh, -c]
        args:
          - |
            # Fetch secret directly
            SECRET=$(aws secretsmanager get-secret-value \
              --secret-id /idp/teams/team-alpha/npm-token \
              --query SecretString --output text)

            # Use in build
            echo "//registry.npmjs.org/:_authToken=${SECRET}" > .npmrc
            npm install
```

## Audit & Monitoring

### CloudTrail Events

```json
// Filter for secret access
{
  "eventSource": "secretsmanager.amazonaws.com",
  "eventName": [
    "GetSecretValue",
    "PutSecretValue",
    "DeleteSecret",
    "RotateSecret"
  ]
}
```

### Alerting

```yaml
# Alert on secret access from unexpected sources
# (CloudWatch Alarm or Grafana Alert)
{
  "metric": "secretsmanager:GetSecretValue",
  "filter": {
    "userIdentity.principalId": {
      "$not": {
        "$regex": ".*external-secrets.*"
      }
    }
  },
  "threshold": 1,
  "period": "5m"
}
```

## Disaster Recovery

### Backup Strategy

```bash
# Export all secrets (for DR)
aws secretsmanager list-secrets --filter Key="name",Values="/idp/" \
  | jq -r '.SecretList[].Name' \
  | xargs -I {} aws secretsmanager get-secret-value --secret-id {} \
  > secrets-backup.json

# Encrypt backup
gpg --encrypt --recipient admin@company.com secrets-backup.json
```

### Cross-Region Replication

```java
// Enable replication for critical secrets
Secret.Builder.create(this, "CriticalSecret")
    .secretName("/idp/platform/github-oauth")
    .replicaRegions(List.of(
        ReplicaRegion.builder()
            .region("us-east-1")
            .build()
    ))
    .build();
```

## Implementation Checklist

- [ ] Deploy External Secrets Operator
- [ ] Create ClusterSecretStore with IRSA
- [ ] Migrate existing secrets to Secrets Manager
- [ ] Create ExternalSecrets for platform components
- [ ] Configure secret rotation for databases
- [ ] Set up Kyverno policies
- [ ] Configure CloudTrail logging
- [ ] Set up alerting for secret access
- [ ] Document secret creation process for teams
- [ ] Test disaster recovery procedures
