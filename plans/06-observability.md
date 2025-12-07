# Observability

> **Status: PLANNED**

Comprehensive observability using Grafana Cloud for metrics, logs, and traces with alerting and SLOs.

## Overview

Use Grafana Cloud as the managed observability backend:
- **Metrics**: Prometheus remote-write to Grafana Cloud
- **Logs**: Loki via Grafana Agent
- **Traces**: Tempo via Grafana Agent
- **Dashboards**: Grafana Cloud hosted

This eliminates the operational burden of running Prometheus, Loki, Grafana, and Tempo in-cluster.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Observability Architecture                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                            EKS Cluster                                       ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │                     Grafana Agent (DaemonSet)                           │││
│  │  │                                                                         │││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │││
│  │  │  │   Metrics   │  │    Logs     │  │   Traces    │  │  Profiles   │   │││
│  │  │  │   Scraper   │  │  Collector  │  │  Collector  │  │  (Optional) │   │││
│  │  │  │             │  │             │  │             │  │             │   │││
│  │  │  │ • kubelet   │  │ • Pod logs  │  │ • OTLP      │  │ • pprof     │   │││
│  │  │  │ • cAdvisor  │  │ • Events    │  │ • Jaeger    │  │ • Pyroscope │   │││
│  │  │  │ • kube-state│  │ • Audit     │  │ • Zipkin    │  │             │   │││
│  │  │  │ • App /metr │  │             │  │             │  │             │   │││
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘   │││
│  │  │         │                │                │                           │││
│  │  └─────────┼────────────────┼────────────────┼───────────────────────────┘││
│  │            │                │                │                            ││
│  └────────────┼────────────────┼────────────────┼────────────────────────────┘│
│               │                │                │                             │
│               ▼                ▼                ▼                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                          Grafana Cloud                                       ││
│  │                                                                              ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             ││
│  │  │    Prometheus   │  │      Loki       │  │     Tempo       │             ││
│  │  │    (Metrics)    │  │     (Logs)      │  │    (Traces)     │             ││
│  │  │                 │  │                 │  │                 │             ││
│  │  │ 13 mo retention │  │ 30 day retain   │  │ 30 day retain   │             ││
│  │  │ 10k free series │  │ 50GB free       │  │ 50GB free       │             ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │                        Grafana Dashboards                                │││
│  │  │                                                                          │││
│  │  │  • Kubernetes Overview    • Application Dashboards   • SLO Dashboard   │││
│  │  │  • Node Exporter          • Argo Workflows          • Cost Dashboard   │││
│  │  │  • EKS Control Plane      • Argo CD                 • Security         │││
│  │  │  • Karpenter              • Backstage               • On-Call          │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │                         Alerting                                         │││
│  │  │                                                                          │││
│  │  │  Alert Rules ──▶ Alert Manager ──▶ Slack / PagerDuty / Email           │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Grafana Agent Configuration

### Helm Values

```yaml
# helm/grafana-agent/values.yaml
agent:
  mode: flow

  configMap:
    create: true
    content: |
      // Prometheus metrics
      prometheus.scrape "kubernetes_pods" {
        targets = discovery.kubernetes.pods.targets
        forward_to = [prometheus.remote_write.grafana_cloud.receiver]

        scrape_interval = "30s"

        // Relabel to add namespace and pod labels
        relabel_configs = [
          {
            source_labels = ["__meta_kubernetes_namespace"]
            target_label = "namespace"
          },
          {
            source_labels = ["__meta_kubernetes_pod_name"]
            target_label = "pod"
          },
        ]
      }

      prometheus.remote_write "grafana_cloud" {
        endpoint {
          url = "https://prometheus-{{region}}.grafana.net/api/prom/push"

          basic_auth {
            username = env("GRAFANA_CLOUD_PROMETHEUS_USER")
            password = env("GRAFANA_CLOUD_API_KEY")
          }
        }
      }

      // Loki logs
      loki.source.kubernetes "pods" {
        targets = discovery.kubernetes.pods.targets
        forward_to = [loki.write.grafana_cloud.receiver]
      }

      loki.write "grafana_cloud" {
        endpoint {
          url = "https://logs-{{region}}.grafana.net/loki/api/v1/push"

          basic_auth {
            username = env("GRAFANA_CLOUD_LOKI_USER")
            password = env("GRAFANA_CLOUD_API_KEY")
          }
        }
      }

      // Tempo traces
      otelcol.receiver.otlp "default" {
        grpc {
          endpoint = "0.0.0.0:4317"
        }
        http {
          endpoint = "0.0.0.0:4318"
        }

        output {
          traces = [otelcol.exporter.otlp.grafana_cloud.input]
        }
      }

      otelcol.exporter.otlp "grafana_cloud" {
        client {
          endpoint = "tempo-{{region}}.grafana.net:443"
          auth = otelcol.auth.basic.grafana_cloud.handler
        }
      }

      otelcol.auth.basic "grafana_cloud" {
        username = env("GRAFANA_CLOUD_TEMPO_USER")
        password = env("GRAFANA_CLOUD_API_KEY")
      }

  extraEnv:
    - name: GRAFANA_CLOUD_PROMETHEUS_USER
      valueFrom:
        secretKeyRef:
          name: grafana-cloud-credentials
          key: prometheus_user
    - name: GRAFANA_CLOUD_LOKI_USER
      valueFrom:
        secretKeyRef:
          name: grafana-cloud-credentials
          key: loki_user
    - name: GRAFANA_CLOUD_TEMPO_USER
      valueFrom:
        secretKeyRef:
          name: grafana-cloud-credentials
          key: tempo_user
    - name: GRAFANA_CLOUD_API_KEY
      valueFrom:
        secretKeyRef:
          name: grafana-cloud-credentials
          key: api_key
```

## Key Dashboards

### 1. Kubernetes Overview

```json
{
  "title": "Kubernetes Overview",
  "panels": [
    {
      "title": "Cluster CPU Usage",
      "expr": "sum(rate(container_cpu_usage_seconds_total{namespace!=\"\"}[5m]))"
    },
    {
      "title": "Cluster Memory Usage",
      "expr": "sum(container_memory_working_set_bytes{namespace!=\"\"})"
    },
    {
      "title": "Pod Count by Namespace",
      "expr": "sum by (namespace) (kube_pod_info)"
    },
    {
      "title": "Node Status",
      "expr": "sum by (node) (kube_node_status_condition{condition=\"Ready\", status=\"true\"})"
    }
  ]
}
```

### 2. Application Dashboard Template

```json
{
  "title": "Application: ${app}",
  "templating": {
    "list": [
      {"name": "app", "type": "query", "query": "label_values(kube_deployment_labels, app)"},
      {"name": "namespace", "type": "query", "query": "label_values(kube_deployment_labels{app=\"$app\"}, namespace)"}
    ]
  },
  "panels": [
    {
      "title": "Request Rate",
      "expr": "sum(rate(http_requests_total{app=\"$app\", namespace=\"$namespace\"}[5m]))"
    },
    {
      "title": "Error Rate",
      "expr": "sum(rate(http_requests_total{app=\"$app\", namespace=\"$namespace\", status=~\"5..\"}[5m])) / sum(rate(http_requests_total{app=\"$app\", namespace=\"$namespace\"}[5m]))"
    },
    {
      "title": "Latency P99",
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{app=\"$app\", namespace=\"$namespace\"}[5m])) by (le))"
    },
    {
      "title": "Pod CPU",
      "expr": "sum by (pod) (rate(container_cpu_usage_seconds_total{namespace=\"$namespace\", pod=~\"$app.*\"}[5m]))"
    },
    {
      "title": "Pod Memory",
      "expr": "sum by (pod) (container_memory_working_set_bytes{namespace=\"$namespace\", pod=~\"$app.*\"})"
    },
    {
      "title": "Logs",
      "type": "logs",
      "expr": "{app=\"$app\", namespace=\"$namespace\"}"
    }
  ]
}
```

### 3. SLO Dashboard

```json
{
  "title": "SLOs",
  "panels": [
    {
      "title": "Availability SLO (99.9%)",
      "type": "gauge",
      "expr": "1 - (sum(rate(http_requests_total{status=~\"5..\"}[30d])) / sum(rate(http_requests_total[30d])))",
      "thresholds": [
        {"value": 0.999, "color": "green"},
        {"value": 0.995, "color": "yellow"},
        {"value": 0, "color": "red"}
      ]
    },
    {
      "title": "Latency SLO (P99 < 500ms)",
      "type": "gauge",
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[30d])) by (le))",
      "thresholds": [
        {"value": 0.5, "color": "green"},
        {"value": 1, "color": "yellow"},
        {"value": null, "color": "red"}
      ]
    },
    {
      "title": "Error Budget Remaining",
      "type": "stat",
      "expr": "((1 - 0.999) - (sum(rate(http_requests_total{status=~\"5..\"}[30d])) / sum(rate(http_requests_total[30d])))) / (1 - 0.999) * 100"
    }
  ]
}
```

## Alerting Rules

### Critical Alerts

```yaml
# alerts/critical.yaml
groups:
  - name: critical
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (>5%)"

      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"
          description: "Pod has restarted {{ $value }} times in 15 minutes"

      - alert: NodeNotReady
        expr: |
          kube_node_status_condition{condition="Ready", status="true"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Node {{ $labels.node }} is not ready"

      - alert: PersistentVolumeFillingUp
        expr: |
          kubelet_volume_stats_available_bytes / kubelet_volume_stats_capacity_bytes < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "PV {{ $labels.persistentvolumeclaim }} is almost full"
          description: "Only {{ $value | humanizePercentage }} space remaining"
```

### Warning Alerts

```yaml
# alerts/warning.yaml
groups:
  - name: warning
    rules:
      - alert: HighMemoryUsage
        expr: |
          container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage in {{ $labels.pod }}"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: HighCPUUsage
        expr: |
          sum(rate(container_cpu_usage_seconds_total[5m])) by (pod, namespace)
          / sum(container_spec_cpu_quota / container_spec_cpu_period) by (pod, namespace) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage in {{ $labels.pod }}"

      - alert: DeploymentReplicasMismatch
        expr: |
          kube_deployment_spec_replicas != kube_deployment_status_replicas_available
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Deployment {{ $labels.deployment }} has replica mismatch"
          description: "Desired: {{ $labels.spec_replicas }}, Available: {{ $labels.status_replicas }}"
```

### Platform Alerts

```yaml
# alerts/platform.yaml
groups:
  - name: platform
    rules:
      - alert: BackstageDown
        expr: up{job="backstage"} == 0
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Backstage is down"

      - alert: ArgoWorkflowsFailed
        expr: |
          increase(argo_workflows_count{status="Failed"}[1h]) > 5
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Multiple Argo Workflows failed in the last hour"

      - alert: ArgoCDSyncFailed
        expr: |
          argocd_app_info{sync_status="OutOfSync"} == 1
        for: 30m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "ArgoCD app {{ $labels.name }} is out of sync"

      - alert: CertificateExpiringSoon
        expr: |
          certmanager_certificate_expiration_timestamp_seconds - time() < 86400 * 14
        for: 1h
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Certificate {{ $labels.name }} expires in < 14 days"
```

## Log Aggregation

### Structured Logging Standard

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Request processed",
  "service": "api-gateway",
  "trace_id": "abc123",
  "span_id": "def456",
  "user_id": "user-789",
  "duration_ms": 45,
  "status_code": 200,
  "path": "/api/v1/users",
  "method": "GET"
}
```

### Loki Queries

```logql
# Error logs from specific app
{app="myapp", namespace="team-alpha"} |= "error"

# Slow requests (>1s)
{app="myapp"} | json | duration_ms > 1000

# Logs correlated with trace
{app="myapp"} | json | trace_id="abc123"

# Error rate by service
sum by (service) (rate({app=~".+"} | json | level="error" [5m]))
```

## Distributed Tracing

### Application Instrumentation

```yaml
# OpenTelemetry sidecar for auto-instrumentation
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: auto-instrumentation
  namespace: team-alpha
spec:
  exporter:
    endpoint: http://grafana-agent.monitoring:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.1"  # 10% sampling

  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest

  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest

  python:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-python:latest
```

### Trace-Log-Metrics Correlation

```yaml
# Grafana data source correlations
correlations:
  - source: prometheus
    target: loki
    config:
      field: trace_id
      target_field: trace_id

  - source: loki
    target: tempo
    config:
      field: trace_id
      target_field: traceID
```

## On-Call Integration

### PagerDuty

```yaml
# Grafana alerting contact point
apiVersion: 1
contactPoints:
  - orgId: 1
    name: pagerduty-critical
    receivers:
      - uid: pagerduty
        type: pagerduty
        settings:
          integrationKey: ${PAGERDUTY_INTEGRATION_KEY}
          severity: critical
          class: infrastructure
          component: kubernetes

  - orgId: 1
    name: slack-warnings
    receivers:
      - uid: slack
        type: slack
        settings:
          url: ${SLACK_WEBHOOK_URL}
          recipient: "#platform-alerts"
```

### Notification Policies

```yaml
# Route alerts to appropriate teams
apiVersion: 1
policies:
  - orgId: 1
    receiver: slack-warnings
    group_by: ['alertname', 'namespace']
    routes:
      - receiver: pagerduty-critical
        matchers:
          - severity = critical
        continue: true

      - receiver: slack-team-alpha
        matchers:
          - namespace = team-alpha

      - receiver: slack-team-beta
        matchers:
          - namespace = team-beta
```

## Implementation Checklist

- [ ] Create Grafana Cloud account (free tier)
- [ ] Generate API keys for Prometheus, Loki, Tempo
- [ ] Store credentials in Secrets Manager
- [ ] Deploy Grafana Agent via Helm
- [ ] Configure ServiceMonitors for platform components
- [ ] Import Kubernetes dashboards
- [ ] Create application dashboard template
- [ ] Configure alerting rules
- [ ] Set up PagerDuty/Slack integration
- [ ] Document on-call procedures
- [ ] Create SLO dashboards
- [ ] Set up trace correlation
