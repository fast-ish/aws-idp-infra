# Plan 08: Cost Management Cleanup

## Objective
Remove redundant KubeCost, configure OpenCost (via k8s-monitoring), and set up cost dashboards.

## Context
- **KubeCost** exists in `aws-idp-gitops/platform/cost-management/` (redundant)
- **OpenCost** is enabled in `grafana.mustache` via k8s-monitoring chart
- Using both is wasteful - choose OpenCost for Grafana integration

## Step 1: Remove KubeCost from GitOps

### Files to Remove
```
aws-idp-gitops/platform/cost-management/
├── kustomization.yaml      # DELETE
├── namespace.yaml          # DELETE
├── values.yaml             # DELETE
├── cost-reports-config.yaml # MIGRATE alerts to Grafana
└── cost-alerts.yaml        # MIGRATE to Prometheus rules
```

### Update References
```bash
# Check for references to kubecost namespace
grep -r "kubecost" aws-idp-gitops/

# Update kustomization.yaml in platform/
# Remove cost-management from resources
```

### Migrate Cost Alerts
Move alerts from `cost-alerts.yaml` to `platform/observability/alerting/`:
```yaml
# cost-alerts.yaml (new location in observability)
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cost-alerts
  namespace: monitoring
spec:
  groups:
    - name: cost.rules
      rules:
        - alert: HighNamespaceCost
          expr: |
            sum by (namespace) (
              container_cpu_usage_seconds_total * on(node) group_left() node_cpu_hourly_cost
            ) > 100
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "High cost in namespace {{ $labels.namespace }}"

        - alert: UnexpectedCostSpike
          expr: |
            sum(rate(container_cpu_usage_seconds_total[1h]))
            / sum(rate(container_cpu_usage_seconds_total[1h] offset 1d)) > 1.5
          for: 2h
          labels:
            severity: warning
          annotations:
            summary: "Cost increased 50% compared to yesterday"
```

## Step 2: Configure OpenCost in k8s-monitoring

### Current Configuration (grafana.mustache)
```yaml
clusterMetrics:
  opencost:
    enabled: true
    metricsSource: grafana-cloud-metrics
    opencost:
      exporter:
        defaultClusterId: "{{deployment:id}}-eks"
        aws:
          spot_data_region: "{{deployment:region}}"
          spot_data_bucket: ""
          spot_data_prefix: ""
          spot_refresh_rate: 3600
```

### Enhanced Configuration
```yaml
clusterMetrics:
  opencost:
    enabled: true
    metricsSource: grafana-cloud-metrics
    opencost:
      exporter:
        defaultClusterId: "{{deployment:id}}-eks"
        aws:
          spot_data_region: "{{deployment:region}}"
          # Configure Spot data feed for accurate pricing
          spot_data_bucket: "{{deployment:id}}-spot-data"
          spot_data_prefix: "spot-pricing"
          spot_refresh_rate: 3600
        # Custom pricing for reserved instances
        customPricing:
          enabled: false
          configPath: /tmp/custom-pricing/pricing.json
        resources:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
      prometheus:
        existingSecretName: grafana-cloud-metrics-k8s-monitoring
        external:
          url: {{deployment:eks:grafana:prometheusHost}}/api/prom
      ui:
        enabled: false  # Use Grafana instead
```

## Step 3: Enable AWS Cost and Usage Report (CUR)

### Create CUR in AWS
```bash
aws cur put-report-definition \
  --report-definition '{
    "ReportName": "eks-cost-report",
    "TimeUnit": "HOURLY",
    "Format": "Parquet",
    "Compression": "Parquet",
    "S3Bucket": "{{deployment:id}}-cost-reports",
    "S3Prefix": "cur",
    "S3Region": "us-west-2",
    "AdditionalArtifacts": ["ATHENA"],
    "RefreshClosedReports": true,
    "ReportVersioning": "OVERWRITE_REPORT"
  }'
```

### Create S3 Bucket for CUR (CDK)
Add to aws-idp-infra:
```typescript
const curBucket = new s3.Bucket(this, 'CostReportsBucket', {
  bucketName: `${deploymentId}-cost-reports`,
  encryption: s3.BucketEncryption.S3_MANAGED,
  lifecycleRules: [{
    expiration: cdk.Duration.days(365),
  }],
});

// Allow CUR to write
curBucket.addToResourcePolicy(new iam.PolicyStatement({
  actions: ['s3:PutObject', 's3:GetBucketAcl', 's3:GetBucketPolicy'],
  principals: [new iam.ServicePrincipal('billingreports.amazonaws.com')],
  resources: [curBucket.bucketArn, `${curBucket.bucketArn}/*`],
}));
```

## Step 4: Create Grafana Cost Dashboards

### Dashboard 1: Cluster Cost Overview
```json
{
  "title": "Cluster Cost Overview",
  "panels": [
    {
      "title": "Total Daily Cost",
      "type": "stat",
      "targets": [{
        "expr": "sum(node_total_hourly_cost) * 24"
      }]
    },
    {
      "title": "Cost by Namespace",
      "type": "piechart",
      "targets": [{
        "expr": "sum by (namespace) (container_memory_working_set_bytes / 1024 / 1024 / 1024 * on(node) group_left() node_ram_hourly_cost + rate(container_cpu_usage_seconds_total[1h]) * on(node) group_left() node_cpu_hourly_cost)",
        "legendFormat": "{{namespace}}"
      }]
    },
    {
      "title": "Cost Trend (7 days)",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(node_total_hourly_cost) * 24"
      }]
    }
  ]
}
```

### Dashboard 2: Team Cost Breakdown
```json
{
  "title": "Team Cost Breakdown",
  "templating": {
    "list": [{
      "name": "team",
      "query": "label_values(kube_namespace_labels, label_app_kubernetes_io_team)"
    }]
  },
  "panels": [
    {
      "title": "Team: $team - Monthly Cost",
      "type": "stat"
    },
    {
      "title": "Team: $team - Cost by Service",
      "type": "table"
    },
    {
      "title": "Team: $team - Cost Trend",
      "type": "timeseries"
    }
  ]
}
```

## Step 5: Set Up Budget Alerts

### Grafana Alerting Rules
```yaml
apiVersion: 1
groups:
  - name: cost-alerts
    folder: Platform
    interval: 1h
    rules:
      - name: TeamBudgetExceeded
        condition: C
        data:
          - refId: A
            queryType: prometheus
            expr: |
              sum by (label_app_kubernetes_io_team) (
                namespace_cost_hourly
              ) * 24 * 30 > 1000
        annotations:
          summary: "Team {{ $labels.label_app_kubernetes_io_team }} exceeding $1000/month budget"

      - name: ClusterCostSpike
        condition: C
        data:
          - refId: A
            queryType: prometheus
            expr: |
              sum(node_total_hourly_cost) * 24 >
              avg_over_time(sum(node_total_hourly_cost)[7d:1d]) * 24 * 1.3
        annotations:
          summary: "Cluster cost 30% higher than 7-day average"
```

## Step 6: Implement Showback Reports

### Weekly Cost Report (Argo Workflow)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: weekly-cost-report
  namespace: argo
spec:
  schedule: "0 9 * * MON"  # Every Monday 9am
  workflowSpec:
    entrypoint: generate-report
    templates:
      - name: generate-report
        script:
          image: python:3.11-slim
          command: [python]
          source: |
            import requests
            import json
            from datetime import datetime, timedelta

            # Query Prometheus for cost data
            # Generate report
            # Send to Slack/Email
```

## Implementation Checklist

### Remove KubeCost
- [ ] Delete `platform/cost-management/` directory
- [ ] Remove from `platform/kustomization.yaml`
- [ ] Remove kubecost namespace references
- [ ] Migrate cost alerts to observability

### Configure OpenCost
- [ ] Verify OpenCost pods running in monitoring namespace
- [ ] Configure AWS spot data feed
- [ ] Verify metrics in Grafana Cloud

### AWS Integration
- [ ] Create CUR S3 bucket
- [ ] Enable Cost and Usage Report
- [ ] (Optional) Set up Athena for CUR queries

### Dashboards
- [ ] Create Cluster Cost Overview dashboard
- [ ] Create Team Cost Breakdown dashboard
- [ ] Add cost panel to team dashboards

### Alerting
- [ ] Configure team budget alerts
- [ ] Configure cost spike alerts
- [ ] Test alert routing

### Reporting
- [ ] Implement weekly cost report workflow
- [ ] Configure Slack/Email delivery
- [ ] Create team cost allocation views

## Success Criteria
- [ ] KubeCost removed, no orphaned resources
- [ ] OpenCost metrics visible in Grafana
- [ ] Cost dashboards accessible
- [ ] Budget alerts firing correctly
- [ ] Weekly reports delivered

## Notes
- OpenCost pricing may differ from AWS bill by ~5-10%
- For accurate RI/Savings Plans pricing, consider AWS-native tools
- Cost allocation requires consistent labeling (enforce via Kyverno)
- Consider FinOps best practices for ongoing optimization
