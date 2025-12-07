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

## Step 2: Update GitHub OAuth Secret

The CDK creates a placeholder secret. Update it with your GitHub OAuth credentials.

```bash
aws secretsmanager put-secret-value \
  --secret-id <deployment:id>-backstage-github-oauth \
  --secret-string '{
    "client_id": "your-github-client-id",
    "client_secret": "your-github-client-secret"
  }'
```

Restart Backstage to pick up the credentials:
```bash
kubectl rollout restart deployment -n backstage
kubectl rollout status deployment -n backstage
```

## Step 3: Configure DNS

### Get ALB Address

```bash
kubectl get ingress -n backstage
```

Output:
```
NAME        CLASS   HOSTS                   ADDRESS                                                              READY
backstage   alb     backstage.example.com   k8s-backstag-backstag-xxxxxx-xxxxxxxx.us-west-2.elb.amazonaws.com   True
```

### Route53 (Recommended)

1. Go to [Route53 Console](https://console.aws.amazon.com/route53) > Hosted zones > your domain
2. Click **Create record**
3. Configure:

| Field | Value |
|-------|-------|
| Record name | `backstage` |
| Record type | `A` |
| Alias | ON |
| Route traffic to | Alias to Application and Classic Load Balancer |
| Region | Your region |
| Load balancer | Select ALB from dropdown |

4. Click **Create records**

### Other DNS Providers

Create a CNAME record pointing to the ALB address.

## Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n backstage

# View logs
kubectl logs -n backstage -l app.kubernetes.io/name=backstage -f
```

Access `https://backstage.YOUR_DOMAIN` and sign in with GitHub.

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
