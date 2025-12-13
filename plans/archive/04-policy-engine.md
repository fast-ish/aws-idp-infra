# Policy Engine - Kyverno

> **Status: IMPLEMENTED**

Implement Kyverno as the policy engine for admission control, mutation, and policy reporting across the platform.

> **Implementation**:
> - **CDK (addons.mustache)**: Kyverno helm chart deployed with IRSA
> - **GitOps (platform/kyverno/policies/)**: Comprehensive policy library:
>   - `baseline/` - Pod Security Standards (privileged, host namespaces, ports, capabilities)
>   - `best-practices/` - Labels, probes, resource requests/limits
>   - `compliance/` - Liveness probes, PDBs, resource limits
>   - `cost/` - Cost allocation labels (required + auto-add)
>   - `mutations/` - Default security context, tolerations, labels
>   - `security/` - Registry restrictions, seccomp, non-root, readonly-root, image signing
>   - `generators/` - Auto-generate NetworkPolicies, ResourceQuotas
>   - `secrets/` - Enforce ExternalSecrets usage, block hardcoded secrets
> - **Network Policies**: `platform/network-policies/kyverno-netpol.yaml`
>   - Least-privilege policies for admission, background, cleanup, and reports controllers

## Overview

Kyverno is a Kubernetes-native policy engine that uses familiar YAML syntax for policies. It provides:
- Admission control (validate, mutate, generate)
- Background scanning for compliance
- Policy reporting for audit
- No new language to learn (unlike OPA/Rego)

## Why Kyverno

| Feature | Kyverno | OPA/Gatekeeper |
|---------|---------|----------------|
| Language | YAML | Rego |
| Learning Curve | Low | High |
| Mutation | Native | Limited |
| Generation | Native | No |
| Reporting | Built-in | Separate |
| CNCF Status | Incubating | Graduated |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Kyverno Architecture                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Admission Flow                                       ││
│  │                                                                              ││
│  │   kubectl apply    ┌──────────────┐   ┌─────────────────────────────────┐  ││
│  │   ───────────────▶ │ API Server   │──▶│ Kyverno Admission Controller   │  ││
│  │                    │              │   │                                 │  ││
│  │                    │ Webhook      │   │ 1. Validate policies           │  ││
│  │                    │              │◀──│ 2. Mutate resources            │  ││
│  │                    └──────────────┘   │ 3. Generate resources          │  ││
│  │                           │           │                                 │  ││
│  │                           ▼           └─────────────────────────────────┘  ││
│  │                    ┌──────────────┐                                        ││
│  │                    │   etcd       │                                        ││
│  │                    └──────────────┘                                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                       Background Scanning                                    ││
│  │                                                                              ││
│  │  ┌─────────────────────┐        ┌───────────────────────────────────────┐  ││
│  │  │ Kyverno Background  │        │           Policy Reports              │  ││
│  │  │ Controller          │───────▶│                                       │  ││
│  │  │                     │        │  PolicyReport (per namespace)         │  ││
│  │  │ • Scan existing     │        │  ClusterPolicyReport (cluster-wide)   │  ││
│  │  │ • Generate reports  │        │                                       │  ││
│  │  │ • Remediate         │        │  • Pass/Fail/Warn/Error/Skip         │  ││
│  │  └─────────────────────┘        └───────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Policy Categories                                    ││
│  │                                                                              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       ││
│  │  │ Security    │  │ Best        │  │ Resource    │  │ Compliance  │       ││
│  │  │             │  │ Practices   │  │ Management  │  │             │       ││
│  │  │ • No root   │  │ • Labels    │  │ • Quotas    │  │ • PCI-DSS   │       ││
│  │  │ • No privs  │  │ • Probes    │  │ • Limits    │  │ • SOC2      │       ││
│  │  │ • Registry  │  │ • Replicas  │  │ • PDBs      │  │ • HIPAA     │       ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Policy Categories

### 1. Security Policies (Enforce)

```yaml
# Disallow privileged containers
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged-containers
  annotations:
    policies.kyverno.io/title: Disallow Privileged Containers
    policies.kyverno.io/category: Pod Security
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: deny-privileged
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Privileged containers are not allowed"
        pattern:
          spec:
            containers:
              - securityContext:
                  privileged: "!true"
            initContainers:
              - securityContext:
                  privileged: "!true"
```

```yaml
# Disallow running as root
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-non-root
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Containers must not run as root"
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  runAsNonRoot: true
```

```yaml
# Restrict container registries to ECR only
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-registries
spec:
  validationFailureAction: Enforce
  rules:
    - name: validate-registries
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Images must come from ECR: {{account}}.dkr.ecr.{{region}}.amazonaws.com"
        pattern:
          spec:
            containers:
              - image: "{{account}}.dkr.ecr.{{region}}.amazonaws.com/*"
            initContainers:
              - image: "{{account}}.dkr.ecr.{{region}}.amazonaws.com/*"

    # Exception for system namespaces
    - name: exclude-system
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - kube-system
                - karpenter
                - argocd
      validate:
        message: "System namespaces can use any registry"
        deny: {}
```

```yaml
# Require read-only root filesystem
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-ro-rootfs
spec:
  validationFailureAction: Audit  # Start with Audit, move to Enforce
  rules:
    - name: require-ro-rootfs
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Root filesystem must be read-only"
        pattern:
          spec:
            containers:
              - securityContext:
                  readOnlyRootFilesystem: true
```

### 2. Best Practices (Enforce/Audit)

```yaml
# Require resource requests and limits
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-requests-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: validate-resources
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "CPU and memory requests/limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  requests:
                    memory: "?*"
                    cpu: "?*"
                  limits:
                    memory: "?*"
```

```yaml
# Require liveness and readiness probes
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-probes
spec:
  validationFailureAction: Audit
  rules:
    - name: validate-probes
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
      validate:
        message: "Liveness and readiness probes are required"
        pattern:
          spec:
            template:
              spec:
                containers:
                  - livenessProbe:
                      periodSeconds: ">0"
                    readinessProbe:
                      periodSeconds: ">0"
```

```yaml
# Require standard labels
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-labels
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
                - Service
              namespaces:
                - "team-*"
      validate:
        message: "Required labels: app.kubernetes.io/name, app.kubernetes.io/team"
        pattern:
          metadata:
            labels:
              app.kubernetes.io/name: "?*"
              app.kubernetes.io/team: "?*"
```

### 3. Resource Management

```yaml
# Limit replica count
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: limit-replicas
spec:
  validationFailureAction: Enforce
  rules:
    - name: limit-replicas
      match:
        any:
          - resources:
              kinds:
                - Deployment
              namespaces:
                - "team-*"
      validate:
        message: "Replicas must be between 1 and 10"
        pattern:
          spec:
            replicas: "1-10"
```

```yaml
# Require PodDisruptionBudget for production
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-pdb
spec:
  validationFailureAction: Audit
  rules:
    - name: check-pdb-exists
      match:
        any:
          - resources:
              kinds:
                - Deployment
              namespaces:
                - "team-*"
      preconditions:
        all:
          - key: "{{request.object.spec.replicas}}"
            operator: GreaterThan
            value: 1
      validate:
        message: "Deployments with >1 replica require a PodDisruptionBudget"
        deny:
          conditions:
            - key: "{{request.object.metadata.name}}"
              operator: AnyNotIn
              value: "{{pdbs}}"
        # Note: This requires a context variable lookup
```

### 4. Mutation Policies

```yaml
# Add default labels
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-labels
spec:
  rules:
    - name: add-labels
      match:
        any:
          - resources:
              kinds:
                - Pod
                - Deployment
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              +(platform.io/managed-by): kyverno
              +(platform.io/environment): "{{request.namespace}}"
```

```yaml
# Add default security context
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-securitycontext
spec:
  rules:
    - name: add-security-context
      match:
        any:
          - resources:
              kinds:
                - Pod
      mutate:
        patchStrategicMerge:
          spec:
            securityContext:
              +(runAsNonRoot): true
              +(seccompProfile):
                +(type): RuntimeDefault
            containers:
              - (name): "*"
                securityContext:
                  +(allowPrivilegeEscalation): false
                  +(capabilities):
                    +(drop):
                      - ALL
```

```yaml
# Add resource defaults
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-resources
spec:
  rules:
    - name: add-default-resources
      match:
        any:
          - resources:
              kinds:
                - Pod
      mutate:
        patchStrategicMerge:
          spec:
            containers:
              - (name): "*"
                resources:
                  requests:
                    +(memory): "128Mi"
                    +(cpu): "100m"
                  limits:
                    +(memory): "256Mi"
```

### 5. Generation Policies

```yaml
# Auto-create NetworkPolicy for new namespaces
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-network-policy
spec:
  rules:
    - name: generate-default-deny
      match:
        any:
          - resources:
              kinds:
                - Namespace
              names:
                - "team-*"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
```

```yaml
# Auto-create ResourceQuota for team namespaces
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-resource-quota
spec:
  rules:
    - name: generate-quota
      match:
        any:
          - resources:
              kinds:
                - Namespace
              names:
                - "team-*"
      generate:
        apiVersion: v1
        kind: ResourceQuota
        name: default-quota
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            hard:
              requests.cpu: "4"
              requests.memory: "8Gi"
              limits.cpu: "8"
              limits.memory: "16Gi"
              pods: "20"
              services: "10"
```

## Policy Reports

```yaml
# Example PolicyReport
apiVersion: wgpolicyk8s.io/v1alpha2
kind: PolicyReport
metadata:
  name: polr-ns-team-alpha
  namespace: team-alpha
results:
  - message: "validation rule 'require-labels' passed"
    policy: require-labels
    result: pass
    source: kyverno
    timestamp:
      nanos: 0
      seconds: 1699900000

  - message: "validation rule 'require-probes' failed"
    policy: require-probes
    result: fail
    source: kyverno
    resources:
      - apiVersion: apps/v1
        kind: Deployment
        name: my-app
        namespace: team-alpha
```

### Viewing Reports

```bash
# List all policy reports
kubectl get policyreport -A

# Get failures in a namespace
kubectl get policyreport -n team-alpha -o jsonpath='{.results[?(@.result=="fail")]}'

# Cluster-wide report
kubectl get clusterpolicyreport
```

## Monitoring & Alerting

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kyverno-metrics
  namespace: kyverno
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kyverno
  endpoints:
    - port: metrics
      interval: 30s
```

Key metrics:
- `kyverno_policy_results_total{rule_result="pass|fail|warn"}`
- `kyverno_admission_requests_total`
- `kyverno_policy_execution_duration_seconds`

### Grafana Dashboard

```json
{
  "panels": [
    {
      "title": "Policy Violations by Namespace",
      "type": "piechart",
      "targets": [
        {
          "expr": "sum by (policy_namespace) (kyverno_policy_results_total{rule_result='fail'})"
        }
      ]
    },
    {
      "title": "Admission Latency",
      "type": "graph",
      "targets": [
        {
          "expr": "histogram_quantile(0.99, sum(rate(kyverno_admission_review_duration_seconds_bucket[5m])) by (le))"
        }
      ]
    }
  ]
}
```

## Exception Handling

```yaml
# Policy exception for specific workload
apiVersion: kyverno.io/v2alpha1
kind: PolicyException
metadata:
  name: allow-privileged-for-csi
  namespace: kube-system
spec:
  exceptions:
    - policyName: disallow-privileged-containers
      ruleNames:
        - deny-privileged
  match:
    any:
      - resources:
          kinds:
            - Pod
          namespaces:
            - kube-system
          names:
            - "ebs-csi-*"
```

## Policy Testing

```yaml
# Kyverno CLI test
# kyverno test ./policies/

# test.yaml
name: require-labels-test
policies:
  - require-labels.yaml
resources:
  - resources/deployment-with-labels.yaml
  - resources/deployment-without-labels.yaml
results:
  - policy: require-labels
    rule: require-team-label
    resource: deployment-with-labels
    result: pass
  - policy: require-labels
    rule: require-team-label
    resource: deployment-without-labels
    result: fail
```

## Policy Library Structure

```
policies/
├── baseline/                    # Always enforced
│   ├── disallow-privileged.yaml
│   ├── require-non-root.yaml
│   ├── restrict-registries.yaml
│   └── require-requests-limits.yaml
│
├── best-practices/              # Audit → Enforce over time
│   ├── require-labels.yaml
│   ├── require-probes.yaml
│   └── require-pdb.yaml
│
├── mutations/                   # Auto-apply defaults
│   ├── add-default-labels.yaml
│   ├── add-default-security.yaml
│   └── add-default-resources.yaml
│
├── generators/                  # Auto-create resources
│   ├── generate-network-policy.yaml
│   └── generate-resource-quota.yaml
│
├── pci/                         # PCI-DSS specific
│   ├── require-encryption.yaml
│   ├── audit-logging.yaml
│   └── network-segmentation.yaml
│
└── exceptions/                  # Approved exceptions
    └── csi-drivers.yaml
```

## Implementation Checklist

- [ ] Deploy Kyverno via Helm
- [ ] Apply baseline security policies (Audit mode first)
- [ ] Monitor PolicyReports for violations
- [ ] Fix violations or create exceptions
- [ ] Move policies to Enforce mode
- [ ] Add mutation policies for defaults
- [ ] Configure generation policies
- [ ] Set up Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Document exception process
- [ ] Integrate with CI (kyverno test)
