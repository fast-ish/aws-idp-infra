# Runtime Security

> **Status: IMPLEMENTED**

Implement runtime security with Falco, image signing, and SBOM generation for production-grade security posture.

> **Implementation**:
> - **CDK (addons.mustache)**: Falco and Trivy Operator helm charts deployed
> - **GitOps (platform/falco/)**:
>   - `values.yaml` - Falco rules configuration:
>     - Shell detection, crypto mining, privilege escalation
>     - Reverse shell, container escape, K8s API abuse
>     - Download-and-execute patterns, secret access monitoring
>   - Falcosidekick for Slack/CloudWatch alerting
> - **GitOps (platform/trivy-operator/)**: Continuous vulnerability scanning
> - **CI Pipeline Templates (platform/argo-workflows/templates/)**:
>   - Trivy scan before deploy
>   - Syft SBOM generation
>   - Cosign image signing with AWS KMS
> - **Kyverno Policies (platform/kyverno/policies/security/)**:
>   - `verify-image-signature.yaml` - Cosign signature verification at admission
> - **Network Policies**: `platform/network-policies/falco-netpol.yaml`
>   - Least-privilege policies for Falco, Falcosidekick, and Trivy Operator

## Overview

Runtime security provides defense-in-depth beyond admission control:
- **Falco**: Runtime threat detection
- **Cosign**: Image signing and verification
- **Syft/Grype**: SBOM generation and vulnerability scanning
- **Trivy Operator**: Continuous scanning

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Runtime Security Stack                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Build Time (CI)                                      ││
│  │                                                                              ││
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     ││
│  │  │   Build     │──▶│ Trivy Scan  │──▶│ SBOM Gen    │──▶│ Sign Image  │     ││
│  │  │   (Kaniko)  │   │             │   │ (Syft)      │   │ (Cosign)    │     ││
│  │  └─────────────┘   └─────────────┘   └─────────────┘   └──────┬──────┘     ││
│  │                                                                │            ││
│  │                                          Push to ECR ◀─────────┘            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                              │                                   │
│                                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Deploy Time (Admission)                              ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐   ││
│  │  │                    Kyverno Image Verification                        │   ││
│  │  │                                                                      │   ││
│  │  │  • Verify Cosign signature                                          │   ││
│  │  │  • Check SBOM attestation                                           │   ││
│  │  │  • Validate vulnerability scan passed                               │   ││
│  │  └─────────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                              │                                   │
│                                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Runtime (Detection)                                  ││
│  │                                                                              ││
│  │  ┌─────────────────────┐        ┌─────────────────────────────────────┐    ││
│  │  │       Falco         │        │       Trivy Operator                │    ││
│  │  │                     │        │                                     │    ││
│  │  │  Syscall Monitoring │        │  Continuous Vulnerability Scanning │    ││
│  │  │  • Shell in pod     │        │  • New CVEs detected               │    ││
│  │  │  • File access      │        │  • Image drift                     │    ││
│  │  │  • Network activity │        │  • Config audit                    │    ││
│  │  │  • Privilege escal. │        │                                     │    ││
│  │  └──────────┬──────────┘        └──────────┬──────────────────────────┘    ││
│  │             │                              │                               ││
│  │             ▼                              ▼                               ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐   ││
│  │  │                    Alerting & Response                               │   ││
│  │  │                                                                      │   ││
│  │  │  • Slack/PagerDuty alerts                                           │   ││
│  │  │  • CloudWatch Logs                                                   │   ││
│  │  │  • Grafana dashboards                                                │   ││
│  │  │  • Automated pod termination (optional)                              │   ││
│  │  └─────────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Falco - Runtime Threat Detection

### Installation

```yaml
# helm/falco/values.yaml
falco:
  jsonOutput: true
  jsonIncludeOutputProperty: true
  httpOutput:
    enabled: true
    url: "http://falcosidekick:2801"

falcosidekick:
  enabled: true
  config:
    slack:
      webhookurl: "${SLACK_WEBHOOK_URL}"
      minimumpriority: "warning"

    aws:
      cloudwatchlogs:
        loggroup: "/aws/eks/idp/falco"
        logstream: "alerts"
        region: "us-west-2"

# Use eBPF driver (modern, no kernel module)
driver:
  kind: ebpf
```

### Custom Rules

```yaml
# falco-rules.yaml
customRules:
  rules-custom.yaml: |-
    # Detect shell spawned in container
    - rule: Shell Spawned in Container
      desc: Detect shell execution in container
      condition: >
        spawned_process and
        container and
        shell_procs and
        not known_shell_spawn_binaries
      output: >
        Shell spawned in container
        (user=%user.name user_uid=%user.uid container_id=%container.id
        container_name=%container.name image=%container.image.repository
        shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline)
      priority: WARNING
      tags: [container, shell]

    # Detect sensitive file access
    - rule: Read Sensitive File
      desc: Detect reading of sensitive files
      condition: >
        open_read and
        container and
        (fd.name startswith /etc/shadow or
         fd.name startswith /etc/passwd or
         fd.name startswith /root/.ssh)
      output: >
        Sensitive file opened for reading
        (user=%user.name file=%fd.name container=%container.name)
      priority: WARNING
      tags: [container, filesystem]

    # Detect outbound connections to suspicious ports
    - rule: Unexpected Outbound Connection
      desc: Detect unexpected outbound network connections
      condition: >
        outbound and
        container and
        not (fd.sport in (80, 443, 5432, 6379)) and
        not k8s_containers
      output: >
        Unexpected outbound connection
        (user=%user.name connection=%fd.name container=%container.name
        image=%container.image.repository)
      priority: NOTICE
      tags: [container, network]

    # Detect privilege escalation attempts
    - rule: Privilege Escalation
      desc: Detect attempts to escalate privileges
      condition: >
        spawned_process and
        container and
        (proc.name in (sudo, su, setuid) or
         proc.args contains "chmod +s")
      output: >
        Privilege escalation attempt
        (user=%user.name command=%proc.cmdline container=%container.name)
      priority: CRITICAL
      tags: [container, privilege]

    # Detect crypto mining
    - rule: Crypto Mining Activity
      desc: Detect potential crypto mining
      condition: >
        spawned_process and
        container and
        (proc.name in (xmrig, minerd, cpuminer) or
         proc.cmdline contains "stratum+tcp" or
         proc.cmdline contains "pool.")
      output: >
        Crypto mining detected
        (user=%user.name command=%proc.cmdline container=%container.name
        image=%container.image.repository)
      priority: CRITICAL
      tags: [container, cryptomining]
```

### PCI-DSS Rules

```yaml
# pci-falco-rules.yaml
customRules:
  pci-rules.yaml: |-
    # PCI-DSS 10.2.2 - Log all actions by privileged users
    - rule: PCI Root Activity
      desc: Log all root user activity in PCI namespace
      condition: >
        spawned_process and
        container and
        k8s.ns.name startswith "pci-" and
        user.uid = 0
      output: >
        PCI - Root activity detected
        (user=%user.name command=%proc.cmdline
        container=%container.name namespace=%k8s.ns.name)
      priority: WARNING
      tags: [pci, audit]

    # PCI-DSS 10.2.7 - Creation/deletion of system objects
    - rule: PCI System Object Modification
      desc: Detect system object changes in PCI namespace
      condition: >
        (kevt and
         (kactivity in (create, delete, update)) and
         k8s.ns.name startswith "pci-")
      output: >
        PCI - System object modified
        (user=%ka.user.name action=%ka.verb
        resource=%ka.target.resource namespace=%k8s.ns.name)
      priority: NOTICE
      tags: [pci, audit]
```

## Image Signing with Cosign

### Signing in CI

```yaml
# Argo Workflow template for signing
- name: sign-image
  inputs:
    parameters:
      - name: image
  container:
    image: gcr.io/projectsigstore/cosign:v2.2.0
    command: [sh, -c]
    args:
      - |
        # Sign with AWS KMS key
        cosign sign \
          --key awskms:///arn:aws:kms:us-west-2:{{account}}:key/{{key-id}} \
          --tlog-upload=false \
          {{inputs.parameters.image}}
    env:
      - name: AWS_REGION
        value: us-west-2
      # IRSA provides credentials
```

### SBOM Generation

```yaml
# Generate and attach SBOM
- name: generate-sbom
  inputs:
    parameters:
      - name: image
  container:
    image: anchore/syft:v0.98.0
    command: [sh, -c]
    args:
      - |
        # Generate SBOM
        syft {{inputs.parameters.image}} \
          -o spdx-json=/tmp/sbom.spdx.json

        # Attach as attestation
        cosign attest \
          --key awskms:///arn:aws:kms:us-west-2:{{account}}:key/{{key-id}} \
          --predicate /tmp/sbom.spdx.json \
          --type spdxjson \
          {{inputs.parameters.image}}
```

### Kyverno Signature Verification

```yaml
# Verify image signature before admission
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "{{account}}.dkr.ecr.{{region}}.amazonaws.com/*"
          attestors:
            - entries:
                - keys:
                    kms: "awskms:///arn:aws:kms:us-west-2:{{account}}:key/{{key-id}}"
          attestations:
            - predicateType: https://spdx.dev/Document
              conditions:
                - all:
                    - key: "{{ creationInfo.created }}"
                      operator: NotEquals
                      value: ""
```

## Trivy Operator - Continuous Scanning

### Installation

```yaml
# helm/trivy-operator/values.yaml
trivy:
  ignoreUnfixed: true
  severity: "HIGH,CRITICAL"

operator:
  scanJobsConcurrentLimit: 3
  vulnerabilityScannerScanOnlyCurrentRevisions: true
  configAuditScannerScanOnlyCurrentRevisions: true

# Store reports in cluster
trivyOperator:
  reportResourceLabels: "app.kubernetes.io/name,app.kubernetes.io/team"
```

### Vulnerability Reports

```yaml
# Generated by Trivy Operator
apiVersion: aquasecurity.github.io/v1alpha1
kind: VulnerabilityReport
metadata:
  name: deployment-myapp-myapp
  namespace: team-alpha
  labels:
    trivy-operator.resource.kind: Deployment
    trivy-operator.resource.name: myapp
spec:
  registry:
    server: 351619759866.dkr.ecr.us-west-2.amazonaws.com
  artifact:
    repository: team-alpha/myapp
    tag: v1.2.3
  scanner:
    name: Trivy
    version: 0.48.0
  report:
    vulnerabilities:
      - vulnerabilityID: CVE-2023-12345
        severity: CRITICAL
        resource: libssl
        installedVersion: "1.1.1k"
        fixedVersion: "1.1.1l"
```

### Alerting on New Vulnerabilities

```yaml
# PrometheusRule for vulnerability alerts
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: trivy-vulnerability-alerts
spec:
  groups:
    - name: vulnerabilities
      rules:
        - alert: CriticalVulnerabilityDetected
          expr: |
            trivy_image_vulnerabilities{severity="Critical"} > 0
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Critical vulnerability in {{ $labels.image_repository }}"
            description: "Image {{ $labels.image_repository }}:{{ $labels.image_tag }} has {{ $value }} critical vulnerabilities"
```

## Response Automation

### Auto-Kill Compromised Pods

```yaml
# Falco response engine
apiVersion: v1
kind: ConfigMap
metadata:
  name: falco-response
data:
  rules.yaml: |
    - action: KillPod
      match:
        - rule: "Crypto Mining Activity"
        - priority: CRITICAL

    - action: Quarantine
      match:
        - rule: "Shell Spawned in Container"
        - priority: WARNING
```

### Slack Alert Format

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Security Alert"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Rule:*\nShell Spawned in Container"},
        {"type": "mrkdwn", "text": "*Priority:*\nWARNING"},
        {"type": "mrkdwn", "text": "*Container:*\nmyapp-abc123"},
        {"type": "mrkdwn", "text": "*Namespace:*\nteam-alpha"},
        {"type": "mrkdwn", "text": "*Command:*\n/bin/bash"},
        {"type": "mrkdwn", "text": "*User:*\nroot"}
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View in Grafana"},
          "url": "https://grafana.example.com/d/falco/alerts"
        }
      ]
    }
  ]
}
```

## Metrics & Dashboards

### Key Metrics

```promql
# Falco alerts by severity
sum by (priority, rule) (rate(falco_events_total[5m]))

# Trivy vulnerabilities by severity
sum by (severity) (trivy_image_vulnerabilities)

# Unsigned images in cluster
count(kyverno_policy_results_total{policy="verify-image-signature", rule_result="fail"})

# Images without SBOM
count(trivy_image_sbom{status="missing"})
```

### Grafana Dashboard

```json
{
  "title": "Runtime Security",
  "panels": [
    {
      "title": "Falco Alerts (Last 24h)",
      "type": "stat",
      "targets": [{"expr": "sum(increase(falco_events_total[24h]))"}]
    },
    {
      "title": "Critical Vulnerabilities",
      "type": "gauge",
      "targets": [{"expr": "sum(trivy_image_vulnerabilities{severity='Critical'})"}]
    },
    {
      "title": "Alerts by Rule",
      "type": "piechart",
      "targets": [{"expr": "sum by (rule) (falco_events_total)"}]
    },
    {
      "title": "Alert Timeline",
      "type": "graph",
      "targets": [{"expr": "sum by (priority) (rate(falco_events_total[5m]))"}]
    }
  ]
}
```

## Implementation Checklist

- [ ] Deploy Falco with eBPF driver
- [ ] Configure Falcosidekick for Slack/CloudWatch
- [ ] Add custom Falco rules for platform
- [ ] Set up KMS key for Cosign
- [ ] Add image signing to CI pipeline
- [ ] Implement SBOM generation
- [ ] Configure Kyverno image verification
- [ ] Deploy Trivy Operator
- [ ] Set up vulnerability alerting
- [ ] Create Grafana dashboard
- [ ] Document incident response procedures
- [ ] Add PCI-specific rules for compliance namespaces
