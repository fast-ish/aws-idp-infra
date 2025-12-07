# Addons Reference

This document describes the Kubernetes addons deployed with aws-backstage-infra.

## AWS Managed Addons

These addons are installed via EKS managed addon API.

| Addon | Version | Purpose |
|-------|---------|---------|
| vpc-cni | Latest | Pod networking with AWS VPC |
| coredns | Latest | Cluster DNS resolution |
| kube-proxy | Latest | Network proxy |
| aws-ebs-csi-driver | Latest | EBS persistent volumes |
| eks-pod-identity-agent | Latest | IAM roles for service accounts |

### VPC CNI

Provides native VPC networking for pods.

**Configuration**:
- ENI-based pod networking
- Security groups for pods
- Custom networking mode supported

### CoreDNS

Cluster DNS service for service discovery.

**Configuration**:
- Deployed on managed node group
- Horizontal pod autoscaling enabled

### EBS CSI Driver

Enables EBS volume provisioning for persistent storage.

**Configuration**:
- Default storage class: gp3
- Encryption enabled via KMS
- Volume expansion supported

### Pod Identity Agent

Enables IAM roles for Kubernetes service accounts.

**Configuration**:
- Replaces IRSA for new deployments
- Automatic token refresh
- Cross-account access supported

## Helm Chart Addons

These addons are installed via Helm charts.

### cert-manager

**Purpose**: TLS certificate management

**Version**: Latest

**Configuration**:
```yaml
installCRDs: true
prometheus:
  enabled: true
```

**Usage**:
- Automatic certificate issuance
- Let's Encrypt integration
- Certificate rotation

### AWS Load Balancer Controller

**Purpose**: Manage AWS ALB/NLB for Kubernetes services

**Version**: Latest

**Configuration**:
```yaml
clusterName: backstage-eks
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: <role-arn>
```

**Usage**:
- Ingress creates ALB
- Service type LoadBalancer creates NLB
- Target group binding

### Secrets Store CSI Driver

**Purpose**: Mount AWS Secrets Manager secrets as volumes

**Version**: Latest

**Configuration**:
```yaml
syncSecret:
  enabled: true
enableSecretRotation: true
```

**Usage**:
- SecretProviderClass resources
- Environment variables from secrets
- Automatic rotation support

### Karpenter

**Purpose**: Kubernetes node autoscaling

**Version**: Latest

**Configuration**:
```yaml
settings:
  clusterName: backstage-eks
  interruptionQueue: backstage-karpenter
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: <role-arn>
```

**Components**:
- **NodePool**: Defines instance requirements
- **EC2NodeClass**: Defines AMI, subnets, security groups

### Grafana Alloy

**Purpose**: Observability data collection

**Version**: Latest

**Configuration**:
```yaml
alloy:
  clustering:
    enabled: true
```

**Usage**:
- Prometheus metrics scraping
- Log collection
- Trace forwarding

### K8s Monitoring (Grafana)

**Purpose**: Full-stack Kubernetes monitoring

**Version**: Latest

**Configuration**:
```yaml
cluster:
  name: backstage-eks
externalServices:
  prometheus:
    host: <grafana-cloud-host>
  loki:
    host: <grafana-cloud-host>
```

**Features**:
- Pre-built dashboards
- Kubernetes metrics
- Application logs
- Container insights

## Addon Dependencies

```
cert-manager
    └── (none)

aws-load-balancer-controller
    └── cert-manager (for webhook certs)

secrets-store-csi-driver
    └── (none)

karpenter
    └── (none)

grafana-alloy
    └── (none)

k8s-monitoring
    └── grafana-alloy
```

## Updating Addons

### AWS Managed Addons

```bash
# Check available versions
aws eks describe-addon-versions \
  --addon-name vpc-cni \
  --kubernetes-version 1.31

# Update addon
aws eks update-addon \
  --cluster-name backstage-eks \
  --addon-name vpc-cni \
  --addon-version v1.x.x
```

### Helm Chart Addons

```bash
# Update Helm repo
helm repo update

# Check for updates
helm search repo cert-manager

# Upgrade chart
helm upgrade cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --version vX.Y.Z
```

## Troubleshooting

### Addon Pod Issues

```bash
# Check addon pods
kubectl get pods -n kube-system
kubectl get pods -n cert-manager
kubectl get pods -n karpenter

# Check logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

### Certificate Issues

```bash
# Check cert-manager
kubectl get certificates -A
kubectl describe certificate <name> -n <namespace>

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### Karpenter Issues

```bash
# Check NodePool status
kubectl get nodepool
kubectl describe nodepool default

# Check Karpenter logs
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter
```

### Secrets Issues

```bash
# Check SecretProviderClass
kubectl get secretproviderclass -A
kubectl describe secretproviderclass <name>

# Check CSI driver
kubectl get pods -n kube-system -l app=secrets-store-csi-driver
```
