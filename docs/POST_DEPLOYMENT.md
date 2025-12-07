# Post-Deployment Steps

Complete these steps **after** `cdk deploy` finishes successfully.

## Step 1: Configure kubectl

```bash
aws eks update-kubeconfig --name <deployment:id>-eks --region <region>
```

Verify access:
```bash
kubectl get nodes
kubectl get pods -A
```

## Step 2: Configure DNS

All platform components share the same ALB using ingress groups. You need to create DNS records for each component.

### Get ALB Address

```bash
kubectl get ingress -A
```

Output:
```
NAMESPACE   NAME                    CLASS   HOSTS                           ADDRESS                                                       PORTS
argo        argo-workflows-server   alb     workflows.backstage.example.com k8s-argo-argo-xxxxxx-xxxxxxxx.us-west-2.elb.amazonaws.com    80
argocd      argocd-server           alb     argocd.backstage.example.com    k8s-argo-argo-xxxxxx-xxxxxxxx.us-west-2.elb.amazonaws.com    80
backstage   backstage               alb     backstage.example.com           k8s-backstag-backstag-xxxxxx-xxxxxxxx.us-west-2.elb.amazonaws.com   80
```

### Route53 (Recommended)

Create **A records** for each component pointing to the ALB:

1. Go to [Route53 Console](https://console.aws.amazon.com/route53) > Hosted zones > your domain
2. Create records for each hostname:

| Record name              | Record type | Alias | Route traffic to                               |
|--------------------------|-------------|-------|------------------------------------------------|
| `backstage`              | A           | Yes   | Select Backstage ALB from dropdown             |
| `argocd.backstage`       | A           | Yes   | Select Argo ALB from dropdown                  |
| `workflows.backstage`    | A           | Yes   | Select Argo ALB from dropdown (same as argocd) |
| `rollouts.backstage`     | A           | Yes   | Select Argo ALB from dropdown (same as argocd) |

**Note**: Argo CD, Argo Workflows, and Argo Rollouts share the same ALB (ingress group `argo`). Backstage uses a separate ALB.

### Other DNS Providers

Create CNAME records pointing to the respective ALB addresses:
- `backstage.YOUR_DOMAIN` → Backstage ALB address
- `argocd.backstage.YOUR_DOMAIN` → Argo ALB address
- `workflows.backstage.YOUR_DOMAIN` → Argo ALB address
- `rollouts.backstage.YOUR_DOMAIN` → Argo ALB address

## Step 3: Verify Deployment

```bash
# Check pod status
kubectl get pods -n backstage

# View logs
kubectl logs -n backstage -l app.kubernetes.io/name=backstage -f
```

Access `https://backstage.YOUR_DOMAIN` and sign in with GitHub.

## Step 4: Access Platform Components

### Backstage (Developer Portal)

URL: `https://backstage.YOUR_DOMAIN`

Sign in with GitHub OAuth to access the developer portal.

### Argo CD (GitOps)

URL: `https://argocd.YOUR_DOMAIN`

**GitHub SSO Login** (recommended):
Click "Log in via GitHub" to authenticate with your GitHub organization.

**Admin Login** (fallback):
Get the initial admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Login:
- **Username**: `admin`
- **Password**: (output from command above)

After first login, change the admin password in Settings > Accounts > admin.

### Argo Workflows

URL: `https://workflows.YOUR_DOMAIN`

#### SSO Login (Recommended)

Argo Workflows uses ArgoCD's Dex for SSO authentication. Click "LOGIN" under "single sign-on" to authenticate via GitHub (same OAuth flow as ArgoCD).

#### Token Login (Alternative)

For service accounts or automation, you can use token-based authentication:

1. Create a service account token:
   ```bash
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: admin.service-account-token
     namespace: argo
     annotations:
       kubernetes.io/service-account.name: argo-server
   type: kubernetes.io/service-account-token
   EOF
   ```

2. Get the token:
   ```bash
   kubectl get secret admin.service-account-token -n argo -o jsonpath='{.data.token}' | base64 -d
   ```

3. Paste the token in the "client authentication" box on the login page and click LOGIN.

#### Test Workflow

Submit a test workflow:
```bash
kubectl create -n argo -f https://raw.githubusercontent.com/argoproj/argo-workflows/main/examples/hello-world.yaml
```

View workflows:
```bash
kubectl get workflows -n argo
```

### Argo Rollouts (Progressive Delivery)

URL: `https://rollouts.YOUR_DOMAIN`

Argo Rollouts uses ArgoCD's Dex for SSO authentication via ALB OIDC. Click "LOGIN" to authenticate via GitHub (same OAuth flow as ArgoCD).

#### Test Rollout

Create a sample rollout:
```bash
kubectl apply -n argo-rollouts -f https://raw.githubusercontent.com/argoproj/argo-rollouts/master/docs/getting-started/basic/rollout.yaml
kubectl apply -n argo-rollouts -f https://raw.githubusercontent.com/argoproj/argo-rollouts/master/docs/getting-started/basic/service.yaml
```

View rollouts:
```bash
kubectl argo rollouts list rollouts -n argo-rollouts
kubectl argo rollouts get rollout rollouts-demo -n argo-rollouts
```

## Troubleshooting

### Pods Not Starting

```bash
kubectl describe pod -n backstage <pod-name>
kubectl logs -n backstage <pod-name>
```

### GitHub OAuth Not Working

1. Verify callback URL: `https://backstage.YOUR_DOMAIN/api/auth/github/handler/frame`
2. Check secret:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id <deployment:id>-backstage-github-oauth \
     --query SecretString --output text | jq .
   ```

### Database Issues

```bash
aws secretsmanager get-secret-value \
  --secret-id <deployment:id>-backstage-db-credentials \
  --query SecretString --output text | jq .
```

### Ingress Not Ready

```bash
kubectl describe ingress -n backstage
```

## Useful Commands

```bash
# All resources
kubectl get all -n backstage

# Events
kubectl get events -n backstage --sort-by='.lastTimestamp'

# Restart
kubectl rollout restart deployment -n backstage

# Port forward (local access)
kubectl port-forward svc/backstage 7007:7007 -n backstage
```

## Cleanup

```bash
cdk destroy
```

**Warning**: Deletes all resources including database.
