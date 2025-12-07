# AI Context: aws-backstage-infra

> **Purpose**: This document helps AI assistants quickly understand the aws-backstage-infra codebase architecture, patterns, and conventions.

## What is aws-backstage-infra?

A **production-ready AWS infrastructure for Backstage** built with AWS CDK that provides:
- Complete EKS deployment infrastructure for Backstage developer portal
- Aurora PostgreSQL database with automated secrets management
- GitHub OAuth integration for authentication
- Karpenter-based autoscaling with dedicated node pools
- Comprehensive observability with Grafana Cloud
- TLS termination with AWS ALB and ACM certificates

**Key Technologies**: Java 21, AWS CDK 2.x, cdk-common library, Kubernetes 1.31, Karpenter, Helm, Aurora PostgreSQL

## Architecture Overview

### Nested Stack Pattern

```
DeploymentStack (main)
├── NetworkNestedStack      # VPC, subnets, NAT gateways
├── DatabaseNestedStack     # Aurora PostgreSQL cluster
├── SecretsNestedStack      # Secrets Manager for credentials
└── HelmNestedStack         # Backstage Helm chart deployment
```

**Infrastructure Flow**:
1. Network stack creates VPC with 3 AZs (public/private subnets)
2. Database stack creates Aurora PostgreSQL in private subnets
3. Secrets stack manages GitHub OAuth and database credentials
4. Helm stack deploys Backstage with all configurations

### Project Structure

```
aws-backstage-infra/
├── src/
│   ├── main/
│   │   ├── java/fasti/sh/backstage/
│   │   │   ├── Launch.java               # CDK App entry point
│   │   │   └── stack/
│   │   │       ├── DeploymentConf.java   # Configuration record
│   │   │       └── DeploymentStack.java  # Main orchestration stack
│   │   └── resources/production/v1/      # Configuration templates
│   │       ├── eks/                      # EKS cluster configs
│   │       │   ├── addons.mustache
│   │       │   ├── node-groups.mustache
│   │       │   └── storage-class.yaml
│   │       ├── helm/                     # Helm chart values
│   │       │   ├── alloy-operator.mustache
│   │       │   ├── aws-load-balancer.mustache
│   │       │   ├── aws-secrets-store.mustache
│   │       │   ├── cert-manager.mustache
│   │       │   ├── grafana.mustache
│   │       │   └── karpenter.mustache
│   │       └── policy/                   # IAM policy templates
│   └── test/
│       └── resources/                    # Test configuration files
│
├── helm/
│   └── chart/
│       └── backstage/                    # Custom Backstage Helm chart
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│               ├── deployment.yaml       # Backstage deployment
│               ├── service.yaml
│               ├── ingress.yaml          # ALB ingress
│               ├── serviceaccount.yaml   # IRSA configuration
│               ├── secretproviderclass.yaml  # CSI secrets
│               ├── configmap.yaml
│               ├── nodepool.yaml         # Karpenter NodePool
│               └── nodeclass.yaml        # Karpenter EC2NodeClass
│
├── .github/
│   ├── workflows/                        # GitHub Actions CI/CD
│   │   ├── codeql.yml
│   │   ├── dependency-management.yml
│   │   ├── dependency-review.yml
│   │   ├── eks-addon-updates.yml
│   │   ├── publish-release.yml
│   │   ├── pull-request-checks.yml
│   │   ├── scheduled-maintenance.yml
│   │   └── test-and-analyze.yml
│   ├── labeler.yml
│   └── AI_CONTEXT.md                     # This file
│
├── docs/                                 # Documentation
│   ├── DEPLOYMENT.md
│   ├── PRE_DEPLOYMENT.md
│   └── POST_DEPLOYMENT.md
│
├── plans/                                # Future implementation plans
│   └── 01-argo-workflows.md              # Argo Workflows integration spec
│
├── cdk.json                              # CDK app configuration
├── cdk.context.template.json             # Context template for deployment
└── pom.xml                               # Maven build configuration
```

## Core Concepts

### 1. Configuration-Driven Infrastructure

All infrastructure is defined through YAML configuration files processed by Mustache templates:

```yaml
# resources/production/v1/helm/backstage.mustache
deployment:
  image: {{backstage:image}}
  tag: {{backstage:tag}}
database:
  host: {{database:host}}
  port: {{database:port}}
```

**Template Variables**:
- `{{platform:*}}` - AWS account/region context
- `{{deployment:*}}` - Application context
- `{{backstage:*}}` - Backstage-specific configuration
- `{{database:*}}` - Database configuration

### 2. cdk-common Dependency

This project uses the `cdk-common` library which provides:
- High-level AWS constructs (`VpcConstruct`, `DatabaseConstruct`, etc.)
- Template processing (`Template.java`, `Mapper.java`)
- Common models (`Common`, `NetworkConf`, `DatabaseConf`)
- Naming conventions (`Format.java`)

### 3. Helm Chart Architecture

The Backstage deployment uses a custom Helm chart with:

**Key Components**:
- **Deployment**: Single replica Backstage container
- **Service**: ClusterIP service on port 7007
- **Ingress**: AWS ALB with TLS termination
- **ServiceAccount**: IRSA-enabled for AWS access
- **SecretProviderClass**: CSI driver for Secrets Manager
- **NodePool/NodeClass**: Karpenter resources for dedicated nodes

**Secrets Management**:
```yaml
# Secrets from AWS Secrets Manager via CSI driver
- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_USER
- POSTGRES_PASSWORD
- AUTH_GITHUB_CLIENT_ID
- AUTH_GITHUB_CLIENT_SECRET
```

### 4. Database Architecture

**Aurora PostgreSQL**:
- Engine: Aurora PostgreSQL 15.x
- Instance: db.t4g.medium (burstable)
- Storage: Aurora I/O-Optimized
- Encryption: KMS customer-managed key
- Backup: 7-day retention, automated snapshots

**Connection**:
- Endpoint stored in Secrets Manager
- Pod Identity for IAM authentication
- Private subnet access only

## Key Components

### 1. Backstage Application

**Container Configuration**:
- Image: Custom Backstage image from ECR
- Port: 7007
- Health checks: `/healthcheck`
- Resources: 512Mi-1Gi memory, 250m-500m CPU

**Environment Variables**:
```yaml
APP_BASE_URL: https://backstage.stxkxs.io
BACKEND_BASE_URL: https://backstage.stxkxs.io
POSTGRES_HOST: <from-secrets>
AUTH_GITHUB_CLIENT_ID: <from-secrets>
```

### 2. Ingress Configuration

**AWS ALB**:
- Scheme: internet-facing
- Target type: IP
- SSL policy: ELBSecurityPolicy-TLS13-1-2-2021-06
- Certificate: ACM certificate for domain
- Health check: HTTP on /healthcheck

### 3. Karpenter Integration

**NodePool**:
- Instance families: t3a, t3, m5a, m5
- Sizes: medium, large
- Capacity type: spot (with on-demand fallback)
- Architecture: amd64

**EC2NodeClass**:
- AMI family: Bottlerocket
- Subnets: Private subnets with Karpenter discovery tag
- Security groups: EKS node security group

### 4. Observability

**Grafana Cloud Integration**:
- Metrics via Alloy collector
- Logs via Fluent Bit
- Pre-built Backstage dashboards

**Key Metrics**:
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database connection pool stats
- Catalog entity counts

## Configuration Records

All configuration is defined as Java records:

```java
public record DeploymentConf(
  String vpc,              // Path to VPC config
  String database,         // Path to database config
  String helm,             // Path to Helm values
  String secrets           // Path to secrets config
) {}
```

## Testing Strategy

### Configuration Tests
- Template parsing validation
- YAML schema validation
- Required field checks
- Default value verification

### What We Don't Test
- CDK synth tests (covered by deployment)
- Integration tests (manual verification)

## Common Tasks

### Adding a New Secret

1. Add secret to AWS Secrets Manager
2. Update `SecretProviderClass` in Helm templates
3. Add environment variable to deployment
4. Update app-config.yaml in backstage-ext

### Updating Backstage Version

1. Build new Docker image in backstage-ext
2. Push to ECR
3. Update image tag in Helm values
4. Deploy: `cdk deploy`

### Scaling Configuration

1. Edit NodePool limits in `helm/chart/backstage/templates/nodepool.yaml`
2. Adjust deployment replicas in values.yaml
3. Consider HPA for auto-scaling

### Database Maintenance

1. Aurora handles automatic patching
2. Manual snapshots: AWS Console or CLI
3. Point-in-time recovery available

## Deployment Workflow

### Prerequisites

```bash
# Install tools
java 21+, maven, aws-cli, cdk-cli, kubectl, helm

# Bootstrap CDK
cdk bootstrap aws://ACCOUNT-ID/REGION

# Build cdk-common dependency
mvn -f cdk-common/pom.xml clean install
```

### Configure

```bash
# Copy template
cp cdk.context.template.json cdk.context.json

# Edit with your settings:
# - AWS account and region
# - Domain name
# - GitHub OAuth credentials
# - Database configuration
```

### Build & Deploy

```bash
# Build project
mvn clean install

# Synthesize CloudFormation
cdk synth

# Deploy to AWS
cdk deploy
```

### Post-Deployment

```bash
# Verify deployment
kubectl get pods -n backstage
kubectl logs -n backstage -l app=backstage

# Check Backstage UI
open https://backstage.your-domain.com
```

## Dependencies

### Core Dependencies
- **AWS CDK**: 2.x (via cdk-common)
- **Java**: 21+
- **cdk-common**: 1.0.0-SNAPSHOT
- **Jackson**: 2.x (YAML/JSON processing)
- **Lombok**: 1.18.x

### Helm Chart Dependencies
- cert-manager
- aws-load-balancer-controller
- secrets-store-csi-driver
- karpenter

## Troubleshooting

### Backstage Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n backstage -l app=backstage

# Check secrets mounting
kubectl get secretproviderclass -n backstage

# Verify database connectivity
kubectl exec -n backstage <pod> -- nc -zv <db-host> 5432
```

### Database Connection Issues

- Verify security group rules
- Check Secrets Manager secret values
- Validate IRSA role permissions
- Test DNS resolution from pod

### Ingress Not Working

- Check ALB provisioning in AWS Console
- Verify ACM certificate status
- Check target group health
- Review ALB logs in CloudWatch

### Karpenter Not Scaling

- Check NodePool and EC2NodeClass status
- Verify IAM permissions
- Review Karpenter controller logs
- Check subnet tags for discovery

## Related Projects

| Project | Purpose |
|---------|---------|
| cdk-common | Shared CDK constructs library |
| aws-eks-infra | Base EKS cluster infrastructure |
| backstage-ext | Backstage application source code |

## Resources

- [README.md](../README.md) - Overview and quickstart
- [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Deployment guide
- [docs/PRE_DEPLOYMENT.md](../docs/PRE_DEPLOYMENT.md) - Prerequisites
- [docs/POST_DEPLOYMENT.md](../docs/POST_DEPLOYMENT.md) - Post-deployment steps
- [Backstage Documentation](https://backstage.io/docs)

## Version Info

- **Java**: 21+
- **AWS CDK**: 2.x
- **Kubernetes**: 1.31
- **Maven**: 3.8+
- **Package**: `fasti.sh.backstage`
- **Current Version**: 1.0.0-SNAPSHOT

---

**Last Updated**: 2025-12
**Build Status**: All dependencies updated to latest versions
