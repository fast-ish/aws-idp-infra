# Plan 01: Complete Current Deployment

## Objective
Successfully deploy the EKS cluster with all platform addons via CDK.

## Context
- CDK deploy was failing on ServiceAccount conflicts
- Fixed helm values with `serviceAccount.create: false`
- Fixed Kyverno webhook config for v3.6.1
- Fixed external-dns provider format for v1.19.0
- Removed redundant alloy-operator (bundled in k8s-monitoring)

## Steps

### 1. Verify Uncommitted Changes
```bash
cd /Users/bs/codes/fastish/v2/aws-idp-infra
git status
git diff --stat
```

### 2. Run CDK Deploy
```bash
cdk deploy --all --require-approval never
```

### 3. Validate Core Components
```bash
# Check nodes are ready
kubectl get nodes

# Check core node group
kubectl get nodes -l eks.amazonaws.com/nodegroup=<deployment-id>-core-node

# Check all pods in kube-system
kubectl get pods -n kube-system
```

### 4. Validate Platform Addons
```bash
# cert-manager
kubectl get pods -n cert-manager
kubectl get certificates -A

# external-secrets
kubectl get pods -n external-secrets
kubectl get clustersecretstores

# external-dns
kubectl get pods -n external-dns

# karpenter
kubectl get pods -n kube-system -l app.kubernetes.io/name=karpenter
kubectl get nodepools
kubectl get ec2nodeclasses

# aws-load-balancer-controller
kubectl get pods -n aws-load-balancer
kubectl get ingressclasses

# kyverno
kubectl get pods -n kyverno
kubectl get clusterpolicies

# argo-workflows
kubectl get pods -n argo

# argocd
kubectl get pods -n argocd
```

### 5. Validate Grafana Cloud Connectivity
```bash
# Check k8s-monitoring pods
kubectl get pods -n monitoring

# Check alloy collectors are running
kubectl get pods -n monitoring -l app.kubernetes.io/name=alloy

# Verify metrics are flowing (check Grafana Cloud UI)
```

### 6. Test ArgoCD Sync
```bash
# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward to ArgoCD
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Verify can sync from aws-idp-gitops repo
```

## Success Criteria
- [ ] All nodes in Ready state
- [ ] All platform addon pods Running
- [ ] No CrashLoopBackOff or Error states
- [ ] Kyverno policies applied (kubectl get clusterpolicies shows policies)
- [ ] ArgoCD accessible and can connect to GitOps repo
- [ ] Metrics visible in Grafana Cloud

## Rollback
```bash
cdk destroy --all
```

## Notes
- If ServiceAccount errors occur, check the specific addon's helm values
- If webhook errors occur, check Kyverno/cert-manager pod logs
- Karpenter needs SQS queue created before pods will be healthy
