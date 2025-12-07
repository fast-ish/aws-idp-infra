# Plan 04: Grafana Dashboards

## Objective
Create Grafana dashboards for platform health, team costs, SLO tracking, and application observability.

## Context
- k8s-monitoring chart sends metrics to Grafana Cloud
- Prometheus rules exist (60+ rules) but no dashboards
- OpenCost metrics available for cost tracking
- Need dashboards in Grafana Cloud (not local Grafana)

## Dashboard Categories

### 1. Platform Health Dashboard
**Purpose:** Overview of all platform components

**Panels:**
- Node status (Ready/NotReady count)
- Pod status by namespace (Running/Pending/Failed)
- Platform component health:
  - ArgoCD sync status
  - Kyverno policy status
  - cert-manager certificate expiry
  - external-secrets sync status
- Resource utilization (CPU/Memory by namespace)
- Karpenter node provisioning activity

**Queries:**
```promql
# Nodes ready
sum(kube_node_status_condition{condition="Ready",status="true"})

# Pods by status
sum by (namespace, phase) (kube_pod_status_phase)

# ArgoCD app health
sum by (health_status) (argocd_app_info)

# Certificate expiry
certmanager_certificate_expiration_timestamp_seconds - time()
```

### 2. Team Cost Dashboard
**Purpose:** Cost allocation per team using OpenCost

**Panels:**
- Total cluster cost (daily/weekly/monthly)
- Cost by team (pie chart)
- Cost by namespace (table)
- Cost trend over time
- Idle cost percentage
- Spot vs On-Demand breakdown

**Queries:**
```promql
# Namespace cost
sum by (namespace) (
  container_cpu_allocation * on(node) group_left() node_cpu_hourly_cost
  + container_memory_allocation_bytes / 1024 / 1024 / 1024 * on(node) group_left() node_ram_hourly_cost
)

# Team cost (via labels)
sum by (label_app_kubernetes_io_team) (
  namespace_cpu_usage_seconds_total * on(node) group_left() node_cpu_hourly_cost
)
```

### 3. SLO Dashboard
**Purpose:** Service Level Objectives tracking (Four Golden Signals)

**Panels:**
- Error budget remaining (gauge)
- Request latency P50/P90/P99
- Request rate (RPS)
- Error rate percentage
- Availability (uptime)
- SLO burn rate alerts

**Queries (using existing recording rules):**
```promql
# Latency P99
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Availability
1 - (sum(increase(http_requests_total{status=~"5.."}[30d])) / sum(increase(http_requests_total[30d])))
```

### 4. Application Overview Dashboard
**Purpose:** Per-service observability

**Panels:**
- Service topology (from traces)
- Request rate by endpoint
- Error rate by endpoint
- Latency heatmap
- Active pods/replicas
- Resource usage (CPU/Memory)
- Recent deployments (from ArgoCD)

### 5. Security Dashboard
**Purpose:** Security posture overview

**Panels:**
- Falco alerts by severity
- Trivy vulnerabilities by severity
- Kyverno policy violations
- Failed pod security admission
- Image registry usage (ECR vs external)

**Queries:**
```promql
# Falco alerts
sum by (rule, priority) (falco_events_total)

# Trivy vulnerabilities
sum by (severity) (trivy_vulnerability_id)

# Kyverno violations
sum by (policy, rule) (kyverno_policy_results_total{result="fail"})
```

### 6. Argo Workflows Dashboard
**Purpose:** CI/CD pipeline observability

**Panels:**
- Workflow status (Running/Succeeded/Failed)
- Workflow duration histogram
- Step success rate
- Queue depth
- Resource usage by workflow

## Implementation Steps

### 1. Export Dashboard JSON
Create dashboards in Grafana Cloud UI, then export JSON.

### 2. Store in GitOps
```
aws-idp-gitops/platform/observability/dashboards/
├── platform-health.json
├── team-costs.json
├── slo-tracking.json
├── application-overview.json
├── security-posture.json
└── argo-workflows.json
```

### 3. Configure Grafana Provisioning
In k8s-monitoring values or via API:
```yaml
grafana:
  dashboardProviders:
    - name: 'platform'
      folder: 'Platform'
      type: file
      options:
        path: /var/lib/grafana/dashboards/platform
```

### 4. Alternative: Grafana Cloud API
```bash
# Upload dashboard via API
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @dashboard.json \
  https://<instance>.grafana.net/api/dashboards/db
```

## Success Criteria
- [ ] 6 dashboards created and accessible
- [ ] Dashboards load without query errors
- [ ] Variables work (namespace, team, service selection)
- [ ] Alerts link to dashboards
- [ ] Dashboards stored in GitOps for version control

## Notes
- Use Grafana Cloud dashboard-as-code if available
- Consider Grafonnet for dashboard generation
- Add annotations for deployments
- Link dashboards from Backstage service pages
