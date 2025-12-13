# Cost Management

> **Status: IMPLEMENTED**

Implement cost visibility, allocation, and optimization using OpenCost (integrated with Grafana k8s-monitoring) with team-level showback.

> **Implementation**:
> - **CDK (helm/grafana.mustache)**: OpenCost deployed as part of k8s-monitoring stack
>   - `clusterMetrics.opencost` - OpenCost exporter configuration
>   - AWS spot pricing integration for accurate cost allocation
>   - Cluster-level cost attribution with namespace breakdown
>   - Energy monitoring via Kepler for sustainability metrics
> - **GitOps (platform/observability/alerting/)**:
>   - `cost-alerts.yaml` - PrometheusRules using OpenCost metrics:
>     - `opencost_cluster_cost` - Budget threshold alerts per namespace
>     - `opencost_anomaly_detection` - Cost spike detection (>20% daily increase)
>     - `opencost_efficiency_ratio` - Resource efficiency alerts (<50% utilization)
>     - `opencost_spot_coverage` - Spot instance adoption tracking
> - **Kyverno Policies (platform/kyverno/policies/cost/)**:
>   - Required cost allocation labels (app.kubernetes.io/team, cost-center)
>   - Auto-add cost labels via mutation policies
>   - Spot instance tracking via Karpenter labels
> - **VPA (platform/vpa/)**: Right-sizing recommendations for cost optimization
>
> **Note**: Kubecost was replaced by OpenCost since OpenCost is the open-source core
> already included in the Grafana k8s-monitoring helm chart, eliminating redundancy.

## Overview

Cost management provides:
- Real-time cost visibility per namespace/team
- Resource efficiency recommendations
- Showback reports for teams
- Budget alerts and optimization suggestions

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Cost Management Architecture                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                              Data Sources                                    ││
│  │                                                                              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ││
│  │  │ Kubernetes  │  │ AWS Cost    │  │ Prometheus  │  │ Spot Price  │        ││
│  │  │ Metrics     │  │ Explorer    │  │ Metrics     │  │ Feed        │        ││
│  │  │             │  │             │  │             │  │             │        ││
│  │  │ • CPU usage │  │ • EC2       │  │ • Custom    │  │ • Real-time │        ││
│  │  │ • Memory    │  │ • EBS       │  │   metrics   │  │   spot $    │        ││
│  │  │ • Network   │  │ • NAT       │  │ • SLIs      │  │             │        ││
│  │  │ • Storage   │  │ • S3        │  │             │  │             │        ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        ││
│  │         │                │                │                │               ││
│  └─────────┼────────────────┼────────────────┼────────────────┼───────────────┘│
│            │                │                │                │                │
│            ▼                ▼                ▼                ▼                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                            Kubecost                                          ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │                     Cost Allocation Engine                               │││
│  │  │                                                                          │││
│  │  │  • Namespace-level allocation                                           │││
│  │  │  • Label-based grouping (team, app, environment)                        │││
│  │  │  • Shared cost distribution                                              │││
│  │  │  • Idle cost allocation                                                  │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  │                                                                              ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             ││
│  │  │   Dashboards    │  │   Alerts        │  │   Reports       │             ││
│  │  │                 │  │                 │  │                 │             ││
│  │  │ • Cost by team  │  │ • Budget alerts │  │ • Weekly email  │             ││
│  │  │ • Efficiency    │  │ • Anomalies     │  │ • CSV export    │             ││
│  │  │ • Trends        │  │ • Recommendations│ │ • API access    │             ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Cost Breakdown Example                               ││
│  │                                                                              ││
│  │  Total Cluster Cost: $500/month                                             ││
│  │  ├── Compute (EC2):     $350 (70%)                                          ││
│  │  │   ├── team-alpha:    $120                                                ││
│  │  │   ├── team-beta:     $80                                                 ││
│  │  │   ├── platform:      $100                                                ││
│  │  │   └── idle:          $50 (allocated proportionally)                      ││
│  │  ├── Storage (EBS):     $50 (10%)                                           ││
│  │  ├── Network (NAT):     $45 (9%)                                            ││
│  │  ├── Control Plane:     $73 (15%)                                           ││
│  │  └── Other:             $27 (5%)                                            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Kubecost Installation

```yaml
# helm/kubecost/values.yaml
kubecostProductConfigs:
  clusterName: idp-production
  currencyCode: USD

  # AWS integration for accurate pricing
  awsSpotDataRegion: us-west-2
  awsSpotDataBucket: idp-kubecost-spot-data
  spotLabel: karpenter.sh/capacity-type
  spotLabelValue: spot

  # Cost allocation settings
  sharedNamespaces: "kube-system,karpenter,argocd,monitoring"
  shareTenancyCosts: true

prometheus:
  enabled: false  # Use existing Grafana Agent

networkCosts:
  enabled: true

# IRSA for AWS Cost Explorer access
serviceAccount:
  create: true
  name: kubecost
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::{{account}}:role/idp-kubecost-sa
```

### IRSA Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "ec2:DescribeSpotPriceHistory",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::idp-kubecost-spot-data/*"
    }
  ]
}
```

## Cost Allocation Labels

### Required Labels

```yaml
# Kyverno policy to enforce cost labels
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-cost-labels
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-team-label
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
              namespaces:
                - "team-*"
      validate:
        message: "Required labels for cost allocation: app.kubernetes.io/team, app.kubernetes.io/cost-center"
        pattern:
          metadata:
            labels:
              app.kubernetes.io/team: "?*"
              app.kubernetes.io/cost-center: "?*"
```

### Label Schema

```yaml
# Standard cost allocation labels
metadata:
  labels:
    # Team ownership
    app.kubernetes.io/team: "alpha"

    # Cost center for billing
    app.kubernetes.io/cost-center: "engineering"

    # Environment for filtering
    app.kubernetes.io/environment: "production"

    # Application name
    app.kubernetes.io/name: "api-gateway"

    # Optional: project code
    app.kubernetes.io/project: "project-x"
```

## Showback Reports

### Team Cost Report

```
┌─────────────────────────────────────────────────────────────────┐
│                 Monthly Cost Report - Team Alpha                 │
│                      December 2024                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total Cost: $285.43                                            │
│  Budget: $300.00                                                │
│  Status: ✅ Under Budget (95%)                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Breakdown by Resource                                      │  │
│  │                                                            │  │
│  │ Compute (CPU/Memory)          $220.00  (77%)              │  │
│  │ ├── api-gateway               $85.00                      │  │
│  │ ├── worker-service            $65.00                      │  │
│  │ ├── cache                     $40.00                      │  │
│  │ └── other                     $30.00                      │  │
│  │                                                            │  │
│  │ Storage (PVCs)                $35.00   (12%)              │  │
│  │ Network (egress)              $20.00   (7%)               │  │
│  │ Shared Costs (allocated)      $10.43   (4%)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Efficiency Metrics                                         │  │
│  │                                                            │  │
│  │ CPU Efficiency:     65% (requested vs used)               │  │
│  │ Memory Efficiency:  78% (requested vs used)               │  │
│  │ Idle Resources:     $45.00 (could be optimized)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Recommendations                                            │  │
│  │                                                            │  │
│  │ 1. Reduce api-gateway CPU request from 1000m to 650m     │  │
│  │    Potential savings: $12/month                           │  │
│  │                                                            │  │
│  │ 2. Enable spot instances for worker-service              │  │
│  │    Potential savings: $25/month                           │  │
│  │                                                            │  │
│  │ 3. Right-size cache memory (4Gi → 2Gi)                   │  │
│  │    Potential savings: $8/month                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Trend: ↓ 5% from last month                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Automated Report Delivery

```yaml
# Kubecost report configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: kubecost-reports
data:
  reports.yaml: |
    reports:
      - name: team-weekly
        schedule: "0 9 * * 1"  # Monday 9am
        window: 7d
        aggregation: namespace
        filter:
          namespaces: "team-*"
        recipients:
          - type: slack
            channel: "#platform-costs"
          - type: email
            address: "platform-team@company.com"
        format: markdown

      - name: team-monthly
        schedule: "0 9 1 * *"  # 1st of month
        window: lastMonth
        aggregation: label:app.kubernetes.io/team
        recipients:
          - type: email
            address: "finance@company.com"
        format: csv
```

## Budget Alerts

```yaml
# alerts/cost-alerts.yaml
groups:
  - name: cost-alerts
    rules:
      - alert: TeamBudgetExceeded
        expr: |
          sum by (namespace) (
            kubecost_cluster_costs{namespace=~"team-.*"}
          ) > 300
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Team {{ $labels.namespace }} exceeded $300 budget"
          description: "Current spend: ${{ $value }}"

      - alert: UnexpectedCostSpike
        expr: |
          (
            sum(kubecost_cluster_costs) -
            sum(kubecost_cluster_costs offset 1d)
          ) / sum(kubecost_cluster_costs offset 1d) > 0.2
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "20% cost increase detected"
          description: "Cluster costs increased by {{ $value | humanizePercentage }}"

      - alert: HighIdleCost
        expr: |
          sum(kubecost_cluster_idle_costs) / sum(kubecost_cluster_costs) > 0.3
        for: 24h
        labels:
          severity: info
        annotations:
          summary: "High idle cost detected ({{ $value | humanizePercentage }})"
          description: "Consider right-sizing or consolidating workloads"
```

## Optimization Recommendations

### Right-Sizing

```yaml
# VPA for automatic right-sizing recommendations
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-gateway-vpa
  namespace: team-alpha
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  updatePolicy:
    updateMode: "Off"  # Recommendation only, no auto-apply
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 4
          memory: 8Gi
```

### Spot Instance Optimization

```yaml
# Karpenter NodePool for spot optimization
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: spot-workloads
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ["t3a.medium", "t3a.large", "m6a.large"]
      nodeClassRef:
        name: default

  disruption:
    consolidationPolicy: WhenEmpty
    consolidateAfter: 10m

  # Prefer spot, fallback to on-demand
  weight: 100
```

### Scheduled Scaling

```yaml
# Scale down non-prod at night
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: night-scale-down
  namespace: staging
spec:
  scaleTargetRef:
    name: staging-apps
  minReplicaCount: 0
  maxReplicaCount: 5
  triggers:
    - type: cron
      metadata:
        timezone: "America/Los_Angeles"
        start: "0 20 * * 1-5"  # 8pm weekdays
        end: "0 7 * * 1-5"    # 7am weekdays
        desiredReplicas: "0"
```

## Grafana Dashboard

```json
{
  "title": "Platform Costs",
  "panels": [
    {
      "title": "Total Monthly Cost",
      "type": "stat",
      "targets": [{"expr": "sum(kubecost_cluster_costs)"}]
    },
    {
      "title": "Cost by Team",
      "type": "piechart",
      "targets": [{"expr": "sum by (namespace) (kubecost_cluster_costs{namespace=~\"team-.*\"})"}]
    },
    {
      "title": "Cost Trend (30d)",
      "type": "graph",
      "targets": [{"expr": "sum(kubecost_cluster_costs)"}]
    },
    {
      "title": "Efficiency Score",
      "type": "gauge",
      "targets": [{"expr": "1 - (sum(kubecost_cluster_idle_costs) / sum(kubecost_cluster_costs))"}]
    },
    {
      "title": "Top 10 Expensive Workloads",
      "type": "table",
      "targets": [{"expr": "topk(10, sum by (namespace, pod) (kubecost_pod_costs))"}]
    },
    {
      "title": "Spot vs On-Demand",
      "type": "piechart",
      "targets": [{"expr": "sum by (capacity_type) (kubecost_node_costs)"}]
    }
  ]
}
```

## API Access for Automation

```bash
# Get cost allocation by namespace
curl -s "http://kubecost.monitoring:9090/model/allocation?window=30d&aggregate=namespace" \
  | jq '.data[0] | to_entries | sort_by(.value.totalCost) | reverse | .[0:10]'

# Get savings recommendations
curl -s "http://kubecost.monitoring:9090/model/savings" \
  | jq '.rightSizing + .abandonedWorkloads'

# Export to S3 for finance
aws s3 cp - s3://idp-cost-reports/$(date +%Y-%m)/costs.json <<< \
  $(curl -s "http://kubecost.monitoring:9090/model/allocation?window=lastMonth")
```

## Implementation Checklist

- [ ] Deploy Kubecost via Helm
- [ ] Configure IRSA for AWS Cost Explorer
- [ ] Set up spot price data bucket
- [ ] Apply cost label requirements via Kyverno
- [ ] Configure shared cost allocation
- [ ] Create team-level dashboards
- [ ] Set up budget alerts
- [ ] Configure weekly/monthly reports
- [ ] Deploy VPA for right-sizing recommendations
- [ ] Document cost optimization procedures
- [ ] Train teams on cost visibility tools
