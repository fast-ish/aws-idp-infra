# Usage Guide

This guide covers how to use aws-backstage-infra to deploy Backstage on AWS EKS.

## Quick Start

### 1. Prerequisites

Ensure you have the following installed:
- Java 21+
- Maven 3.8+
- AWS CLI 2.x (configured)
- CDK CLI 2.x
- kubectl 1.28+
- Helm 3.x

### 2. Bootstrap CDK

If not already done:
```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

### 3. Build

```bash
# Build cdk-common first (if not already)
mvn -f ../cdk-common/pom.xml clean install

# Build this project
mvn clean install
```

### 4. Configure

```bash
cp cdk.context.template.json cdk.context.json
```

Edit `cdk.context.json` with your values:
```json
{
  "deployment:name": "backstage",
  "deployment:environment": "production",
  "deployment:domain": "your-domain.com",
  "deployment:organization": "Your Org",
  ...
}
```

### 5. Deploy

```bash
cdk deploy --all
```

## Configuration Reference

### Core Settings

| Key | Description | Example |
|-----|-------------|---------|
| `deployment:name` | Application name | `backstage` |
| `deployment:environment` | Environment name | `production` |
| `deployment:domain` | Base domain | `example.com` |
| `deployment:region` | AWS region | `us-west-2` |

### Database Settings

| Key | Description | Default |
|-----|-------------|---------|
| `database:instance-class` | Aurora instance type | `db.t4g.medium` |
| `database:backup-retention` | Backup retention days | `7` |
| `database:deletion-protection` | Enable deletion protection | `true` |

### Backstage Settings

| Key | Description | Example |
|-----|-------------|---------|
| `backstage:image` | Docker image | `123456789.dkr.ecr.us-west-2.amazonaws.com/backstage` |
| `backstage:tag` | Image tag | `latest` |
| `backstage:replicas` | Number of replicas | `1` |

## Deployment Commands

### Full Deployment
```bash
cdk deploy --all
```

### Specific Stack
```bash
cdk deploy BackstageDeploymentStack
```

### With Approval
```bash
cdk deploy --all --require-approval broadening
```

### Dry Run
```bash
cdk diff
```

## Post-Deployment

### Update Kubeconfig
```bash
aws eks update-kubeconfig \
  --name backstage-eks \
  --region us-west-2
```

### Verify Deployment
```bash
kubectl get pods -n backstage
kubectl get svc -n backstage
kubectl get ingress -n backstage
```

### View Logs
```bash
kubectl logs -n backstage -l app=backstage -f
```

### Access Backstage
```bash
# Get ALB URL
kubectl get ingress -n backstage -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'

# Or use your configured domain
open https://backstage.your-domain.com
```

## Operations

### Scaling

Modify replicas in Helm values or apply HPA:
```bash
kubectl scale deployment backstage -n backstage --replicas=3
```

### Updating Backstage

1. Build and push new image
2. Update image tag:
   ```bash
   helm upgrade backstage helm/chart/backstage \
     --namespace backstage \
     --set image.tag=new-tag
   ```

### Database Operations

#### Connect to Database
```bash
# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id backstage/database \
  --query SecretString --output text | jq

# Port forward (for local access)
kubectl port-forward svc/backstage-db 5432:5432 -n backstage
```

#### Create Backup
```bash
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier backstage-db \
  --db-cluster-snapshot-identifier backstage-manual-$(date +%Y%m%d)
```

### Secrets Management

#### Update GitHub OAuth Credentials
```bash
aws secretsmanager update-secret \
  --secret-id backstage/github-oauth \
  --secret-string '{"clientId":"xxx","clientSecret":"yyy"}'

# Restart pods to pick up new secrets
kubectl rollout restart deployment/backstage -n backstage
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n backstage -l app=backstage

# Check events
kubectl get events -n backstage --sort-by='.lastTimestamp'
```

### Database Connection Failed

```bash
# Verify database endpoint
kubectl exec -n backstage deploy/backstage -- \
  nc -zv $POSTGRES_HOST 5432

# Check security groups
aws ec2 describe-security-groups \
  --group-ids sg-xxx \
  --query 'SecurityGroups[0].IpPermissions'
```

### Ingress Not Working

```bash
# Check ALB status
kubectl describe ingress -n backstage

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

### Secrets Not Mounting

```bash
# Check SecretProviderClass
kubectl get secretproviderclass -n backstage

# Check CSI driver pods
kubectl get pods -n kube-system -l app=secrets-store-csi-driver
```

## Cleanup

### Destroy All Resources

```bash
cdk destroy --all
```

**Warning**: This will delete:
- EKS resources
- Aurora database (if deletion protection disabled)
- All secrets
- Network resources

### Partial Cleanup

```bash
# Delete Helm release only
helm uninstall backstage -n backstage

# Delete namespace
kubectl delete namespace backstage
```

## Integration

### With CI/CD

```yaml
# GitHub Actions example
- name: Deploy Backstage
  run: |
    cdk deploy --all --require-approval never
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### With Terraform

If using Terraform for other resources, you can reference CDK outputs:

```hcl
data "aws_eks_cluster" "backstage" {
  name = "backstage-eks"
}
```

## Support

- [GitHub Issues](https://github.com/stxkxs/aws-backstage-infra/issues)
- [Documentation](docs/)
- [Backstage Docs](https://backstage.io/docs)
