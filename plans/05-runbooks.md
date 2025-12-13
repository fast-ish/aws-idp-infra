# Plan 05: Operational Runbooks

## Objective
Create runbooks for all Prometheus alerts that currently reference placeholder URLs.

## Context
- 60+ Prometheus alerting rules exist in aws-idp-gitops
- Rules have `runbook_url` annotations pointing to non-existent docs
- Runbooks should be accessible via Backstage TechDocs

## Runbook Structure

Each runbook should follow this template:

```markdown
# Alert: <AlertName>

## Overview
Brief description of what this alert means.

## Severity
Critical / Warning / Info

## Impact
What happens if this alert is ignored.

## Investigation Steps
1. First thing to check
2. Second thing to check
3. ...

## Common Causes
- Cause 1
- Cause 2

## Resolution Steps
1. How to fix cause 1
2. How to fix cause 2

## Escalation
When and who to escalate to.

## Related Alerts
Links to related alerts.

## References
- Links to relevant documentation
```

## Runbooks to Create

### Infrastructure Alerts

| Alert | File | Priority |
|-------|------|----------|
| NodeNotReady | node-not-ready.md | P1 |
| NodeHighCPU | node-high-cpu.md | P2 |
| NodeHighMemory | node-high-memory.md | P2 |
| NodeDiskPressure | node-disk-pressure.md | P1 |
| NodeNetworkUnavailable | node-network-unavailable.md | P1 |
| KubeletDown | kubelet-down.md | P1 |

### Pod Alerts

| Alert | File | Priority |
|-------|------|----------|
| PodCrashLooping | pod-crash-looping.md | P1 |
| PodOOMKilled | pod-oom-killed.md | P2 |
| PodNotReady | pod-not-ready.md | P2 |
| PodPending | pod-pending.md | P2 |
| ContainerWaiting | container-waiting.md | P3 |

### Deployment Alerts

| Alert | File | Priority |
|-------|------|----------|
| DeploymentReplicasMismatch | deployment-replicas-mismatch.md | P2 |
| DeploymentGenerationMismatch | deployment-generation-mismatch.md | P2 |
| StatefulSetReplicasMismatch | statefulset-replicas-mismatch.md | P2 |
| DaemonSetNotScheduled | daemonset-not-scheduled.md | P2 |

### Platform Component Alerts

| Alert | File | Priority |
|-------|------|----------|
| ArgoCDSyncFailed | argocd-sync-failed.md | P1 |
| ArgoCDAppDegraded | argocd-app-degraded.md | P2 |
| ArgoWorkflowFailed | argo-workflow-failed.md | P2 |
| KyvernoPolicyViolation | kyverno-policy-violation.md | P2 |
| ExternalSecretSyncFailed | external-secret-sync-failed.md | P1 |
| CertificateExpiringSoon | certificate-expiring-soon.md | P1 |
| CertificateExpired | certificate-expired.md | P1 |

### Security Alerts

| Alert | File | Priority |
|-------|------|----------|
| FalcoAlert | falco-alert.md | P1 |
| TrivyCriticalVulnerability | trivy-critical-vulnerability.md | P1 |
| TrivyHighVulnerability | trivy-high-vulnerability.md | P2 |
| ImageFromUntrustedRegistry | image-untrusted-registry.md | P2 |

### SLO Alerts

| Alert | File | Priority |
|-------|------|----------|
| HighErrorRate | high-error-rate.md | P1 |
| HighLatency | high-latency.md | P2 |
| LowAvailability | low-availability.md | P1 |
| ErrorBudgetBurn | error-budget-burn.md | P2 |

## Directory Structure

```
aws-idp-gitops/docs/
├── runbooks/
│   ├── infrastructure/
│   │   ├── node-not-ready.md
│   │   ├── node-high-cpu.md
│   │   └── ...
│   ├── pods/
│   │   ├── pod-crash-looping.md
│   │   ├── pod-oom-killed.md
│   │   └── ...
│   ├── deployments/
│   │   └── ...
│   ├── platform/
│   │   ├── argocd-sync-failed.md
│   │   ├── kyverno-policy-violation.md
│   │   └── ...
│   ├── security/
│   │   ├── falco-alert.md
│   │   └── ...
│   └── slo/
│       ├── high-error-rate.md
│       └── ...
├── mkdocs.yml
└── index.md
```

## Example Runbook: PodCrashLooping

```markdown
# Alert: PodCrashLooping

## Overview
A pod is repeatedly crashing and being restarted by Kubernetes.

## Severity
**Critical** - Service degradation likely

## Impact
- Reduced capacity for the affected deployment
- Potential service outage if all replicas crash
- Resource waste from restart cycles

## Investigation Steps

### 1. Identify the crashing pod
```bash
kubectl get pods -A | grep CrashLoopBackOff
kubectl get pods -n <namespace> -l app=<app-name>
```

### 2. Check pod events
```bash
kubectl describe pod <pod-name> -n <namespace>
```

### 3. Check container logs
```bash
# Current container logs
kubectl logs <pod-name> -n <namespace>

# Previous container logs (before crash)
kubectl logs <pod-name> -n <namespace> --previous
```

### 4. Check resource limits
```bash
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A 10 resources
```

## Common Causes

1. **Application error** - Bug in application code causing crash
2. **OOM Kill** - Container exceeds memory limits
3. **Missing dependencies** - Database/cache/secret not available
4. **Configuration error** - Invalid environment variables
5. **Liveness probe failure** - Probe too aggressive or misconfigured
6. **Image pull error** - Container image not found or auth failed

## Resolution Steps

### Application Error
1. Check logs for stack trace
2. Roll back to previous working version:
   ```bash
   kubectl rollout undo deployment/<name> -n <namespace>
   ```

### OOM Kill
1. Check if OOMKilled in pod events
2. Increase memory limits in deployment
3. Investigate memory leak in application

### Missing Dependencies
1. Check external service connectivity
2. Verify secrets exist: `kubectl get secrets -n <namespace>`
3. Check ExternalSecret sync status

### Configuration Error
1. Verify ConfigMap/Secret values
2. Check environment variable injection

## Escalation
- If application bug: Escalate to owning team (check `app.kubernetes.io/team` label)
- If infrastructure: Escalate to Platform team
- P1 during business hours: Slack #platform-oncall
- P1 after hours: PagerDuty

## Related Alerts
- PodOOMKilled
- PodNotReady
- DeploymentReplicasMismatch

## References
- [Kubernetes Debugging Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Platform Troubleshooting Guide](../troubleshooting.md)
```

## Implementation Steps

### 1. Create runbooks directory structure
```bash
mkdir -p aws-idp-gitops/docs/runbooks/{infrastructure,pods,deployments,platform,security,slo}
```

### 2. Create mkdocs.yml for runbooks
```yaml
site_name: Platform Runbooks
nav:
  - Home: index.md
  - Infrastructure:
    - Node Not Ready: runbooks/infrastructure/node-not-ready.md
    # ...
  - Pods:
    - Pod Crash Looping: runbooks/pods/pod-crash-looping.md
    # ...
```

### 3. Update Prometheus rules with correct URLs
```yaml
annotations:
  runbook_url: https://backstage.internal/docs/default/component/platform-runbooks/runbooks/pods/pod-crash-looping
```

### 4. Add to Backstage catalog
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: platform-runbooks
  annotations:
    backstage.io/techdocs-ref: dir:.
spec:
  type: documentation
  lifecycle: production
  owner: platform
```

## Success Criteria
- [ ] Runbook exists for every alert rule
- [ ] Runbook URLs in Prometheus rules are valid
- [ ] Runbooks accessible via Backstage TechDocs
- [ ] Each runbook has actionable steps
- [ ] Escalation paths are defined

## Notes
- Keep runbooks concise and actionable
- Include actual kubectl commands
- Link to Grafana dashboards where relevant
- Review and update runbooks quarterly
