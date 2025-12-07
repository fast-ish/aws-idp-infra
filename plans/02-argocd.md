# Argo CD - GitOps Deployment

> **Status: PLANNED**

Deploy Argo CD for GitOps-based continuous deployment with SSO, RBAC, and ApplicationSets for multi-team environments.

## Overview

Argo CD provides declarative GitOps continuous delivery for Kubernetes. All application configurations are stored in Git, and Argo CD automatically syncs the desired state to the cluster.

## Why Argo CD

| Feature | Argo CD | Flux | Jenkins X |
|---------|---------|------|-----------|
| CNCF Status | Graduated | Graduated | Sandbox |
| UI | Full-featured | Basic (Weave) | Limited |
| SSO | Native OIDC/SAML | External | External |
| Multi-tenancy | ApplicationSets | Kustomize | Limited |
| Rollback | One-click | Git revert | Git revert |
| Sync Waves | Native | Limited | No |
| Backstage Plugin | Official | Community | No |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Argo CD Architecture                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐         ┌─────────────────────────────────────────────────┐│
│  │                 │         │                  EKS Cluster                     ││
│  │    GitHub       │         │                                                  ││
│  │                 │         │  ┌─────────────────────────────────────────────┐││
│  │  ┌───────────┐  │         │  │              argocd namespace               │││
│  │  │ app-repo  │  │  sync   │  │                                             │││
│  │  │           │──┼────────────│  ┌─────────────┐  ┌─────────────────────┐  │││
│  │  │ /manifests│  │         │  │  │ argocd-     │  │ argocd-application- │  │││
│  │  └───────────┘  │         │  │  │ server      │  │ controller          │  │││
│  │                 │         │  │  │             │  │                     │  │││
│  │  ┌───────────┐  │         │  │  │ • UI        │  │ • Watch Git repos   │  │││
│  │  │ infra-repo│  │         │  │  │ • API       │  │ • Compare state     │  │││
│  │  │           │──┼────────────│  │ • SSO       │  │ • Sync to cluster   │  │││
│  │  │ /helm     │  │         │  │  │ • RBAC      │  │ • Health checks     │  │││
│  │  └───────────┘  │         │  │  └─────────────┘  └─────────────────────┘  │││
│  │                 │         │  │                                             │││
│  │  ┌───────────┐  │         │  │  ┌─────────────┐  ┌─────────────────────┐  │││
│  │  │ config-   │  │         │  │  │ argocd-     │  │ argocd-             │  │││
│  │  │ repo      │──┼────────────│  │ repo-server │  │ applicationset-     │  │││
│  │  │           │  │         │  │  │             │  │ controller          │  │││
│  │  │ /apps     │  │         │  │  │ • Clone     │  │                     │  │││
│  │  └───────────┘  │         │  │  │ • Generate  │  │ • Generate Apps     │  │││
│  │                 │         │  │  │ • Cache     │  │ • Git generators    │  │││
│  └─────────────────┘         │  │  └─────────────┘  └─────────────────────┘  │││
│                              │  └─────────────────────────────────────────────┘││
│                              │                                                  ││
│  ┌─────────────────┐         │  ┌─────────────────────────────────────────────┐││
│  │   Developers    │         │  │              Team Namespaces                │││
│  │                 │         │  │                                             │││
│  │  • Push to Git  │         │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │││
│  │  • Create PRs   │────────────│  │ team-a   │ │ team-b   │ │ staging  │   │││
│  │  • View in UI   │         │  │  │          │ │          │ │          │   │││
│  │  • Sync apps    │         │  │  │ App 1    │ │ App 3    │ │ Preview  │   │││
│  │                 │         │  │  │ App 2    │ │ App 4    │ │ Apps     │   │││
│  └─────────────────┘         │  │  └──────────┘ └──────────┘ └──────────┘   │││
│                              │  └─────────────────────────────────────────────┘││
│                              └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Argo CD Server

```yaml
# helm/argocd/values.mustache
server:
  replicas: 2

  ingress:
    enabled: true
    ingressClassName: alb
    hostname: argocd.{{deployment:domain}}
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: "{{certificate.arn}}"
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS": 443}]'
      alb.ingress.kubernetes.io/backend-protocol: HTTPS

  config:
    # GitHub SSO
    oidc.config: |
      name: GitHub
      issuer: https://token.actions.githubusercontent.com
      clientID: $argocd-github-oauth:client_id
      clientSecret: $argocd-github-oauth:client_secret
      requestedScopes:
        - openid
        - profile
        - email

    # Repository credentials
    repositories: |
      - url: https://github.com/{{deployment:organization}}
        type: git
        passwordSecret:
          name: argocd-github-token
          key: token

  rbacConfig:
    policy.default: role:readonly
    policy.csv: |
      # Platform admins
      g, {{deployment:organization}}:platform-team, role:admin

      # Team access (read + sync own apps)
      p, role:team-developer, applications, get, */*, allow
      p, role:team-developer, applications, sync, */*, allow
      p, role:team-developer, logs, get, */*, allow

      # Map GitHub teams to roles
      g, {{deployment:organization}}:developers, role:team-developer

    scopes: '[groups, email]'
```

### 2. ApplicationSets for Multi-Tenancy

```yaml
# applicationsets/team-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-applications
  namespace: argocd
spec:
  generators:
    # Generate an Application for each team directory in the config repo
    - git:
        repoURL: https://github.com/{{organization}}/platform-config
        revision: HEAD
        directories:
          - path: teams/*/apps/*

  template:
    metadata:
      name: '{{path.basename}}'
      namespace: argocd
      labels:
        team: '{{path[1]}}'
        app: '{{path.basename}}'
    spec:
      project: '{{path[1]}}'  # Team name = project name
      source:
        repoURL: https://github.com/{{organization}}/platform-config
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: 'team-{{path[1]}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=false
          - PruneLast=true
```

### 3. AppProjects for Isolation

```yaml
# projects/team-project-template.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-{{name}}
  namespace: argocd
spec:
  description: "Project for team {{name}}"

  # Only allow deploying to team namespace
  destinations:
    - namespace: team-{{name}}
      server: https://kubernetes.default.svc
    - namespace: team-{{name}}-staging
      server: https://kubernetes.default.svc

  # Only allow specific sources
  sourceRepos:
    - https://github.com/{{organization}}/{{name}}-*
    - https://github.com/{{organization}}/platform-config

  # Cluster resources teams can create
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace

  # Namespace resources teams can create
  namespaceResourceWhitelist:
    - group: '*'
      kind: '*'

  # Deny dangerous resources
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
    - group: ''
      kind: LimitRange
    - group: networking.k8s.io
      kind: NetworkPolicy

  # Sync windows (optional - restrict when syncs can happen)
  syncWindows:
    - kind: allow
      schedule: '* * * * *'
      duration: 24h
      applications:
        - '*'
      namespaces:
        - team-{{name}}
```

### 4. Sync Waves for Ordered Deployments

```yaml
# Example: Database before app
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-database
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  # ... database deployment

---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-migrations
  annotations:
    argocd.argoproj.io/sync-wave: "2"
    argocd.argoproj.io/hook: Sync
spec:
  # ... migration job

---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  annotations:
    argocd.argoproj.io/sync-wave: "3"
spec:
  # ... application deployment
```

## Notifications

```yaml
# argocd-notifications-cm
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.slack: |
    token: $slack-token

  template.app-sync-succeeded: |
    message: |
      Application {{.app.metadata.name}} sync succeeded
      Revision: {{.app.status.sync.revision}}
    slack:
      attachments: |
        [{
          "color": "#18be52",
          "title": "{{.app.metadata.name}}",
          "title_link": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "fields": [
            {"title": "Sync Status", "value": "{{.app.status.sync.status}}", "short": true},
            {"title": "Health", "value": "{{.app.status.health.status}}", "short": true}
          ]
        }]

  template.app-sync-failed: |
    message: |
      Application {{.app.metadata.name}} sync failed
      Error: {{.app.status.operationState.message}}
    slack:
      attachments: |
        [{
          "color": "#E96D76",
          "title": "{{.app.metadata.name}} - Sync Failed",
          "title_link": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "fields": [
            {"title": "Error", "value": "{{.app.status.operationState.message}}", "short": false}
          ]
        }]

  trigger.on-sync-succeeded: |
    - when: app.status.sync.status == 'Synced'
      send: [app-sync-succeeded]

  trigger.on-sync-failed: |
    - when: app.status.sync.status == 'Unknown' && app.status.operationState.phase == 'Failed'
      send: [app-sync-failed]
```

## Backstage Integration

### Plugin Configuration

```typescript
// packages/app/src/App.tsx
import { ArgocdPage } from '@roadiehq/backstage-plugin-argo-cd';

// Add to routes
<Route path="/argocd" element={<ArgocdPage />} />
```

```yaml
# app-config.yaml
argocd:
  baseUrl: https://argocd.{{domain}}
  appLocatorMethods:
    - type: 'config'
      instances:
        - name: main
          url: https://argocd.{{domain}}
          token: ${ARGOCD_AUTH_TOKEN}
```

### Entity Annotations

```yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    argocd/app-name: my-service
    argocd/app-namespace: team-alpha
spec:
  type: service
  owner: team-alpha
```

## Repository Structure

```
platform-config/
├── argocd/
│   ├── base/
│   │   ├── argocd-cm.yaml
│   │   ├── argocd-rbac-cm.yaml
│   │   └── argocd-notifications-cm.yaml
│   └── overlays/
│       └── production/
│           └── kustomization.yaml
│
├── projects/
│   ├── platform.yaml           # Platform team project
│   ├── team-alpha.yaml
│   └── team-beta.yaml
│
├── applicationsets/
│   ├── team-apps.yaml          # Generate apps from team dirs
│   ├── pr-previews.yaml        # PR preview environments
│   └── cluster-addons.yaml     # Cluster-wide addons
│
└── teams/
    ├── team-alpha/
    │   └── apps/
    │       ├── service-a/
    │       │   ├── kustomization.yaml
    │       │   ├── deployment.yaml
    │       │   └── service.yaml
    │       └── service-b/
    │           └── ...
    └── team-beta/
        └── apps/
            └── ...
```

## IRSA Configuration

```yaml
# Service account for Argo CD to access ECR, S3
apiVersion: v1
kind: ServiceAccount
metadata:
  name: argocd-application-controller
  namespace: argocd
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::{{account}}:role/idp-argocd-sa
```

```json
// IAM Policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::{{bucket}}-helm-charts",
        "arn:aws:s3:::{{bucket}}-helm-charts/*"
      ]
    }
  ]
}
```

## Rollback Strategy

```yaml
# Automatic rollback on failed sync
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: critical-service
spec:
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  # Rollback settings
  revisionHistoryLimit: 10
```

### Manual Rollback

```bash
# List revisions
argocd app history myapp

# Rollback to specific revision
argocd app rollback myapp <revision>

# Or via UI: Applications → myapp → History → Rollback
```

## Health Checks

```yaml
# Custom health check for CRDs
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  resource.customizations.health.argoproj.io_Workflow: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.phase == "Succeeded" then
        hs.status = "Healthy"
        hs.message = "Workflow completed successfully"
      elseif obj.status.phase == "Failed" or obj.status.phase == "Error" then
        hs.status = "Degraded"
        hs.message = obj.status.message
      else
        hs.status = "Progressing"
        hs.message = "Workflow is running"
      end
    end
    return hs
```

## Metrics & Monitoring

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: argocd-metrics
  namespace: argocd
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-server
  endpoints:
    - port: metrics
      interval: 30s
```

Key metrics:
- `argocd_app_sync_total` - Sync operations count
- `argocd_app_health_status` - Application health
- `argocd_git_request_total` - Git operations
- `argocd_cluster_api_resource_objects` - Cluster resources

## Security Considerations

1. **RBAC**: Use AppProjects to isolate team access
2. **Git Credentials**: Store in Secrets, reference via External Secrets
3. **SSO**: Enforce MFA via GitHub/OIDC provider
4. **Audit Logs**: All operations logged with user identity
5. **Network Policy**: Restrict egress to Git repos only

## Implementation Checklist

- [ ] Deploy Argo CD via Helm
- [ ] Configure GitHub SSO
- [ ] Create AppProjects for each team
- [ ] Create ApplicationSet for team apps
- [ ] Configure notifications (Slack)
- [ ] Integrate with Backstage
- [ ] Set up IRSA for ECR/S3 access
- [ ] Configure health checks
- [ ] Set up monitoring/alerting
- [ ] Document rollback procedures
