# AWS Internal Developer Platform - Implementation Plan

> **Last Updated:** 2025-12-07
> **Status:** Initial deployment debugging phase

---

## Current State Summary

### Infrastructure (aws-idp-infra) - CDK
| Component | Status | Notes |
|-----------|--------|-------|
| EKS Cluster | Ready | Managed node groups, IRSA configured |
| Helm Addons | Ready | 12 charts with enterprise configs |
| ServiceAccounts | Ready | CDK creates SA, Helm uses `create: false` |
| IAM Roles | Ready | IRSA for all platform components |
| Karpenter | Ready | Pod identity, interruption queue |

### GitOps (aws-idp-gitops) - ArgoCD Managed
| Component | Status | Files |
|-----------|--------|-------|
| Kyverno Policies | **Complete** | 31 policies across 8 categories |
| Network Policies | **Complete** | 7 policy files for all components |
| Prometheus Rules | **Complete** | 60+ rules (infra, pods, security, SLOs) |
| Argo Workflows | **Complete** | 6 CI/CD templates |
| Argo Rollouts | **Complete** | Canary + analysis templates |
| Argo Events | **Complete** | GitHub webhooks, SQS, sensors |
| Team Management | **Complete** | ApplicationSets for namespaces/projects |
| External Secrets | **Complete** | AWS Secrets Manager ClusterSecretStore |
| Falco + Trivy | **Complete** | Runtime security + vuln scanning |
| OpenCost | **Complete** | Via k8s-monitoring chart (KubeCost in GitOps is redundant - remove) |
| VPA | **Complete** | Resource optimization |

### Backstage (backstage-ext) - Developer Portal
| Feature | Status | Notes |
|---------|--------|-------|
| Service Catalog | **Complete** | All entity types supported |
| Scaffolder | **Complete** | GitHub integration |
| TechDocs | **Complete** | Local MkDocs builder |
| Search | **Complete** | Catalog + docs search |
| Kubernetes Plugin | **Complete** | Multi-cluster + Argo CRDs |
| ArgoCD Plugin | **Complete** | Roadiehq integration |
| GitHub Auth | **Complete** | OAuth with entity resolver |
| Notifications | **Complete** | Real-time signals |
| Custom Theme | **Complete** | IBM Plex + Inter fonts |

### Software Templates
| Template | template.yaml | skeleton/ | Completeness |
|----------|---------------|-----------|--------------|
| java-service | Complete | Full | **100%** |
| python-service | Complete | Basic | 70% |
| rails-api | Complete | Basic | 70% |
| react-frontend | Complete | Basic | 70% |
| data-pipeline | Complete | Basic | 70% |

---

## Gaps & Next Steps

### Priority 1: Complete Current Deployment
- [ ] Fix any remaining helm chart deployment errors
- [ ] Validate all ServiceAccounts resolve correctly
- [ ] Verify Grafana Cloud connectivity (metrics/logs/traces)
- [ ] Test ArgoCD can sync from aws-idp-gitops repo

### Priority 2: Template Skeleton Completion
The Java template is production-ready. Others need fleshing out:

**python-service-template:**
- [ ] Add FastAPI CRUD example with database models
- [ ] Add Celery task examples with Redis broker
- [ ] Add OpenTelemetry instrumentation examples
- [ ] Add Alembic migration examples

**rails-api-template:**
- [ ] Add Rails API resource scaffolding
- [ ] Add Sidekiq job examples
- [ ] Add Action Cable websocket example
- [ ] Add ActiveRecord migration examples

**react-frontend-template:**
- [ ] Add page routing examples
- [ ] Add API client with React Query
- [ ] Add authentication flow with Cognito
- [ ] Add Sentry/PostHog initialization

**data-pipeline-template:**
- [ ] Add Druid ingestion spec examples
- [ ] Add Argo Workflow DAG examples
- [ ] Add dbt model examples with tests
- [ ] Add Kafka/Kinesis consumer examples

### Priority 3: TechDocs for All Templates
- [ ] Add `docs/` directory with mkdocs.yml to each template
- [ ] Document architecture decisions per template
- [ ] Add getting started guides
- [ ] Add infrastructure provisioning docs

### Priority 4: Observability Stack Deployment
The alerting rules exist but the stack needs helm deployments:
- [ ] Deploy Prometheus via k8s-monitoring (already in grafana.mustache)
- [ ] Verify Loki log aggregation
- [ ] Verify Tempo trace collection
- [ ] Import Grafana dashboards (currently no JSONs)
- [ ] Create dashboards for: Platform health, Team costs, SLO tracking

### Priority 5: Operational Runbooks
Prometheus rules reference runbook URLs that don't exist:
- [ ] Create runbook for `NodeNotReady`
- [ ] Create runbook for `PodCrashLooping`
- [ ] Create runbook for `HighErrorRate`
- [ ] Create runbook for `CertificateExpiry`
- [ ] Create runbook for `KyvernoPolicyViolation`
- [ ] Add runbooks to Backstage TechDocs

### Priority 6: Missing Infrastructure
- [ ] **Ingress Resources**: Platform services need ALB ingress manifests
- [ ] **DNS Management**: Route53 records for internal services
- [ ] **Secrets Rotation**: Define rotation policies in External Secrets
- [ ] **Backup Strategy**: Add Velero for cluster backup

### Priority 7: Developer Self-Service Enhancements
- [ ] **Database Provisioning**: Backstage action to create Aurora/DynamoDB
- [ ] **Cache Provisioning**: Backstage action to create ElastiCache
- [ ] **Queue Provisioning**: Backstage action to create SQS/SNS
- [ ] **Secret Creation**: Backstage action to create AWS Secrets

### Priority 8: Cost Management Cleanup
**Issue:** Duplicate cost tooling - KubeCost in GitOps AND OpenCost in k8s-monitoring
**Decision:** Use OpenCost (already in grafana.mustache) - lighter, OSS, Grafana integrated

- [ ] **Remove KubeCost from GitOps** (`platform/cost-management/` directory)
- [ ] Configure OpenCost AWS integration (spot pricing, CUR)
- [ ] Set up team budget alerts via Grafana
- [ ] Create cost allocation dashboards in Grafana Cloud
- [ ] Implement showback reports per team

### Priority 9: Policy Testing & Validation
- [ ] Add Kyverno policy unit tests (chainsaw or kuttl)
- [ ] Add GitOps validation in CI (kubeconform)
- [ ] Add helm chart linting
- [ ] Add pre-commit hooks for YAML validation

### Priority 10: Disaster Recovery
- [ ] Document RTO/RPO targets
- [ ] Configure Velero backup schedules
- [ ] Test restore procedures
- [ ] Set up cross-region secret replication

---

## Architecture Decisions (Reference)

### ServiceAccount Pattern
```
CDK creates ServiceAccount with IRSA annotation
  → Helm uses serviceAccount.create: false
  → Prevents ownership conflicts
```

### Node Strategy
```
Core Node Group (managed)
  → Platform components via nodeSelector
  → Predictable, stable workloads

Karpenter Nodes (dynamic)
  → Team workloads
  → Spot for non-critical, on-demand for critical
```

### GitOps Split
```
aws-idp-infra (CDK)
  → EKS cluster
  → Helm chart installations
  → IAM roles & service accounts
  → KMS keys, S3 buckets

aws-idp-gitops (ArgoCD)
  → Kyverno policies
  → Network policies
  → Prometheus rules
  → Team namespaces & quotas
  → Application deployments
```

### Observability Flow
```
App → OpenTelemetry SDK
    → Alloy Receiver (OTLP)
    → Grafana Cloud (Prometheus/Loki/Tempo/Pyroscope)

Cluster → k8s-monitoring chart
       → Alloy collectors (metrics/logs/profiles)
       → Grafana Cloud
```

---

## Known Issues & Workarounds

### Kyverno v3.6.x Webhook Config Change
```yaml
# Old format (v3.3.x) - WRONG
config:
  webhooks:
    - namespaceSelector: ...

# New format (v3.6.x) - CORRECT
config:
  webhooks:
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values: [kube-system]
```

### External-DNS v1.19.0 Provider Format
```yaml
# Old format - WRONG
provider: aws

# New format - CORRECT
provider:
  name: aws
```

### ArgoCD v9.x Ingress Controller
```yaml
# Required for AWS ALB
server:
  ingress:
    controller: aws  # New in v9.x
    ingressClassName: alb
```

---

## Repository Map

```
fastish/v2/
├── aws-idp-infra/           # CDK infrastructure
│   └── src/main/resources/production/v1/
│       ├── eks/addons.mustache      # All addon configs
│       ├── helm/*.mustache          # Helm values per chart
│       └── policy/*.mustache        # IAM policies
│
├── aws-idp-gitops/          # ArgoCD managed
│   ├── platform/
│   │   ├── argo-workflows/templates/   # CI/CD templates
│   │   ├── argo-rollouts/              # Progressive delivery
│   │   ├── argo-events/                # Event triggers
│   │   ├── kyverno/policies/           # 31 policies
│   │   ├── external-secrets/           # Secret sync
│   │   ├── observability/alerting/     # Prometheus rules
│   │   ├── network-policies/           # Segmentation
│   │   ├── falco/                      # Runtime security
│   │   ├── trivy-operator/             # Vuln scanning
│   │   └── cost-management/            # KubeCost
│   └── clusters/production/            # Cluster config
│
├── backstage-ext/           # Developer portal
│   └── packages/
│       ├── app/src/         # Frontend (React)
│       └── backend/src/     # Backend (Node.js)
│
├── java-service-template/   # 100% complete
├── python-service-template/ # 70% - needs skeleton
├── rails-api-template/      # 70% - needs skeleton
├── react-frontend-template/ # 70% - needs skeleton
└── data-pipeline-template/  # 70% - needs skeleton
```

---

## Team Configuration (6 Teams)

| Team | Namespace | CPU Quota | Memory Quota |
|------|-----------|-----------|--------------|
| Platform | team-platform | 20 cores | 40Gi |
| Backend | team-backend | 20 cores | 40Gi |
| Frontend | team-frontend | 20 cores | 40Gi |
| Data | team-data | 40 cores | 80Gi |
| ML | team-ml | 40 cores | 80Gi |
| Integrations | team-integrations | 20 cores | 40Gi |

Each team namespace includes:
- ResourceQuota (CPU, memory, pods, services, PVCs)
- LimitRange (default container resources)
- NetworkPolicy (ingress/egress controls)
- RBAC (developer, viewer roles)
- ArgoCD AppProject (scoped permissions)

---

## Metrics & Statistics

- **Kyverno Policies:** 31 (4 baseline, 3 best-practices, 6 security, 3 compliance, 2 cost, 2 mutations, 2 generators, 1 secrets)
- **Prometheus Rules:** 60+ (infrastructure, pods, deployments, platform, security, SLOs)
- **Workflow Templates:** 6 (test, build, secure-build, sign, deploy, argocd-sync)
- **Network Policy Files:** 7
- **Platform Components:** 16 (all HA configured)
- **Backstage Entity Types:** 9

---

## Session Recovery Notes

If resuming this session:
1. Check `git status` in aws-idp-infra - there are uncommitted helm value changes
2. Deployment was failing on ServiceAccount conflicts - fixed with `create: false`
3. Kyverno webhook config was wrong for v3.6.1 - fixed
4. External-DNS provider format was wrong for v1.19.0 - fixed
5. alloy-operator removed - bundled in k8s-monitoring v3.x

Current state: Ready to retry `cdk deploy` after helm value fixes.
