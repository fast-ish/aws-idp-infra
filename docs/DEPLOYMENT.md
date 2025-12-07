# Deployment Guide

This guide walks through deploying Backstage on AWS using this CDK template.

For a streamlined experience, see:
- **[PRE_DEPLOYMENT.md](PRE_DEPLOYMENT.md)** - Checklist of everything needed before deployment
- **[POST_DEPLOYMENT.md](POST_DEPLOYMENT.md)** - Steps to complete after deployment finishes

## Prerequisites

Before deploying, ensure you have:

- **Java 21+** installed
- **Maven 3.8+** installed
- **AWS CDK CLI** installed (`npm install -g aws-cdk`)
- **AWS credentials** configured with appropriate permissions
- **cdk-common library** built locally (see [Build Dependencies](#1-build-dependencies))

## Configuration

### 1. Build Dependencies

The project depends on the `cdk-common` library. Build it first:

```bash
cd ../cdk-common
mvn clean install -DskipTests
```

### 2. Configure `cdk.context.json`

Copy the template and update with your values:

```bash
cp cdk.context.json.example cdk.context.json
```

Edit `cdk.context.json` with your configuration:

#### Platform Configuration

These identify your organization and platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `platform:id` | Short identifier for the platform | `myplatform` |
| `platform:organization` | Organization name | `myorg` |
| `platform:account` | AWS account ID (12 digits) | `123456789012` |
| `platform:region` | AWS region | `us-west-2` |
| `platform:name` | Platform display name | `backstage` |
| `platform:alias` | Platform alias | `idp` |
| `platform:environment` | Environment name | `production` |
| `platform:version` | Configuration version | `v1` |
| `platform:domain` | Root domain | `example.com` |

#### Deployment Configuration

These configure the specific Backstage deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `deployment:id` | Unique deployment identifier | `backstage-prod` |
| `deployment:organization` | Team/org owning this deployment | `platform-team` |
| `deployment:account` | AWS account ID | `123456789012` |
| `deployment:region` | AWS region | `us-west-2` |
| `deployment:team:name` | Team name | `platform` |
| `deployment:team:alias` | Team alias | `backstage` |
| `deployment:environment` | Environment | `production` |
| `deployment:version` | Deployment version | `v1` |
| `deployment:domain` | Backstage domain | `backstage.example.com` |

#### EKS Administrator Access

Configure IAM roles that should have admin access to the EKS cluster:

```json
"deployment:eks:administrators": [
  {
    "username": "admin",
    "role": "arn:aws:iam::123456789012:role/YourAdminRole",
    "email": "admin@example.com"
  }
]
```

**Finding your IAM role ARN:**

- For AWS SSO users: Check IAM > Roles > search for `AWSReservedSSO_`
- For IAM users: Use the role ARN associated with your user/group

#### Grafana Cloud Configuration (Required for Observability)

The EKS addons deploy Grafana Alloy for observability, which requires a pre-existing AWS Secrets Manager secret containing your Grafana Cloud credentials.

**This secret must be created before deployment.**

##### Step 1: Create the Grafana Cloud Secret in AWS Secrets Manager

Create a secret in AWS Secrets Manager with your Grafana Cloud credentials. The secret name should follow your organization's naming convention (e.g., `myorg-grafana` or `platform-grafana-cloud`).

**Using AWS CLI:**

```bash
aws secretsmanager create-secret \
  --name "your-grafana-secret-name" \
  --description "Grafana Cloud credentials for EKS observability" \
  --secret-string '{
    "instanceId": "876368",
    "key": "glc_your_grafana_cloud_api_key",
    "lokiHost": "https://logs-prod-021.grafana.net",
    "lokiUsername": "834150",
    "prometheusHost": "https://prometheus-prod-36-prod-us-west-0.grafana.net",
    "prometheusUsername": "1465349",
    "tempoHost": "https://tempo-prod-15-prod-us-west-0.grafana.net/tempo",
    "tempoUsername": "828466",
    "pyroscopeHost": "https://profiles-prod-008.grafana.net:443",
    "fleetManagementHost": "https://fleet-management-prod-014.grafana.net"
  }'
```

**Using AWS Console:**

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager)
2. Click **Store a new secret**
3. Select **Other type of secret**
4. Choose **Plaintext** and paste the JSON structure below
5. Name the secret (e.g., `myorg-grafana`)
6. Complete the wizard

##### Secret Structure

The secret must contain the following JSON structure:

```json
{
  "instanceId": "your-grafana-instance-id",
  "key": "glc_your_grafana_cloud_api_key",
  "lokiHost": "https://logs-prod-XXX.grafana.net",
  "lokiUsername": "your-loki-username",
  "prometheusHost": "https://prometheus-prod-XX-prod-us-west-0.grafana.net",
  "prometheusUsername": "your-prometheus-username",
  "tempoHost": "https://tempo-prod-XX-prod-us-west-0.grafana.net/tempo",
  "tempoUsername": "your-tempo-username",
  "pyroscopeHost": "https://profiles-prod-XXX.grafana.net:443",
  "fleetManagementHost": "https://fleet-management-prod-XXX.grafana.net"
}
```

| Field | Description | Where to Find |
|-------|-------------|---------------|
| `instanceId` | Your Grafana Cloud instance ID | Grafana Cloud Portal > Instance details |
| `key` | Grafana Cloud API key (starts with `glc_`) | Grafana Cloud Portal > Access Policies > Create token |
| `lokiHost` | Loki push endpoint | Grafana Cloud > Loki > Details |
| `lokiUsername` | Loki instance user ID | Grafana Cloud > Loki > Details |
| `prometheusHost` | Prometheus remote write endpoint | Grafana Cloud > Prometheus > Details |
| `prometheusUsername` | Prometheus instance user ID | Grafana Cloud > Prometheus > Details |
| `tempoHost` | Tempo endpoint (with `/tempo` suffix) | Grafana Cloud > Tempo > Details |
| `tempoUsername` | Tempo instance user ID | Grafana Cloud > Tempo > Details |
| `pyroscopeHost` | Pyroscope endpoint (with port `:443`) | Grafana Cloud > Profiles > Details |
| `fleetManagementHost` | Fleet management endpoint | Grafana Cloud > Fleet Management |

##### Step 2: Reference the Secret in `cdk.context.json`

Add the secret name to your context configuration:

```json
"deployment:eks:grafana:secret": "your-grafana-secret-name"
```

##### Getting Grafana Cloud Credentials

1. Log in to [Grafana Cloud](https://grafana.com/auth/sign-in)
2. Select your stack
3. For each service (Loki, Prometheus, Tempo, Profiles):
   - Click on the service
   - Go to **Details** to find the host URL and username
4. For the API key:
   - Go to **Access Policies**
   - Create a new access token with appropriate scopes (metrics:write, logs:write, traces:write, profiles:write)
   - Copy the generated key (starts with `glc_`)

### 3. Create GitHub OAuth Application

Backstage uses GitHub OAuth for authentication.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)

2. Click **New OAuth App**

3. Fill in the application details:
   - **Application name**: `Backstage` (or your preferred name)
   - **Homepage URL**: `https://backstage.YOUR_DOMAIN` (e.g., `https://backstage.example.com`)
   - **Application description**: (optional)
   - **Authorization callback URL**: `https://backstage.YOUR_DOMAIN/api/auth/github/handler/frame`

4. Click **Register application**

5. On the next page:
   - Note the **Client ID**
   - Click **Generate a new client secret**
   - Note the **Client Secret** (you won't see it again)

**Important**: Keep these credentials secure. You'll need them after deployment.

## Deployment

### 1. Bootstrap CDK (First Time Only)

If this is your first CDK deployment in this account/region:

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

Replace `ACCOUNT_ID` and `REGION` with your values (e.g., `aws://123456789012/us-west-2`).

### 2. Build the Project

```bash
mvn clean compile
```

### 3. Synthesize CloudFormation

Verify the configuration by synthesizing:

```bash
cdk synth
```

This generates CloudFormation templates in `cdk.out/`. Review for any errors.

### 4. Deploy

```bash
cdk deploy
```

This will:
- Create a VPC with public and private subnets
- Deploy an EKS cluster with Karpenter for autoscaling
- Create an Aurora PostgreSQL database
- Create secrets in AWS Secrets Manager
- Create an ACM certificate for TLS
- Deploy Backstage via Helm chart

Deployment typically takes 30-45 minutes.

#### ACM Certificate DNS Validation (Action Required During Deployment)

During deployment, CloudFormation will create an ACM certificate for your domain and **pause waiting for DNS validation**. You must manually create the DNS validation records in Route 53:

1. **Watch for the pause**: The deployment will appear to hang at the certificate creation step. This is expected.

2. **Open the ACM Console**: Go to [AWS Certificate Manager](https://console.aws.amazon.com/acm) in your deployment region.

3. **Find the pending certificate**: Look for a certificate with status **Pending validation** for your domain (e.g., `backstage.example.com`).

4. **Create DNS records**:
   - Click on the certificate to view details
   - In the **Domains** section, click **Create records in Route 53**
   - If your Route 53 hosted zone is in the same account, AWS will automatically create the CNAME validation records
   - If Route 53 is in a different account, manually create the CNAME record shown in ACM in your DNS provider

5. **Wait for validation**: DNS validation typically completes within a few minutes. Once validated, CloudFormation will automatically continue the deployment.

**Note**: If you don't complete DNS validation, the deployment will eventually time out (after ~30 minutes) and roll back.

### 5. Update GitHub OAuth Secret

After deployment, update the GitHub OAuth secret in AWS Secrets Manager:

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager)

2. Find the secret named `{deployment:id}-backstage-github-oauth`

3. Click **Retrieve secret value** > **Edit**

4. Update the secret value to:
   ```json
   {
     "client_id": "your-github-client-id",
     "client_secret": "your-github-client-secret"
   }
   ```

5. Click **Save**

6. Restart the Backstage pods to pick up the new credentials:
   ```bash
   kubectl rollout restart deployment -n backstage
   ```

### 6. Configure DNS

After deployment, create a DNS record pointing your domain to the ALB.

#### Get the ALB DNS Name

```bash
kubectl get ingress -n backstage
```

You'll see output like:
```
NAME        CLASS   HOSTS                   ADDRESS                                                              READY
backstage   alb     backstage.example.com   k8s-backstag-backstag-xxxxxx-xxxxxxxx.us-west-2.elb.amazonaws.com   True
```

#### Route53 (Recommended for AWS)

1. Go to [Route53 Console](https://console.aws.amazon.com/route53) > Hosted zones > your domain
2. Click **Create record**
3. Configure:
   - **Record name**: `backstage` (or your subdomain)
   - **Record type**: `A`
   - **Alias**: Toggle ON
   - **Route traffic to**: Alias to Application and Classic Load Balancer
   - **Region**: Select your region (e.g., `us-west-2`)
   - **Load balancer**: Select the ALB from the dropdown (matches the ADDRESS from kubectl output)
4. Click **Create records**

Using an A record with Alias is preferred for Route53 because there's no extra DNS lookup, no charge for alias queries, and it works at zone apex.

#### Other DNS Providers

Create a CNAME record:
- **Name**: `backstage` (or your subdomain)
- **Type**: `CNAME`
- **Value**: The ALB DNS name from the kubectl output

DNS propagation may take a few minutes.

## Verification

Once DNS is configured, verify the deployment:

1. Open `https://backstage.YOUR_DOMAIN` in a browser
2. Click **Sign In** and authenticate with GitHub
3. You should see the Backstage home page

## Troubleshooting

### View Backstage Logs

```bash
kubectl logs -n backstage -l app.kubernetes.io/name=backstage -f
```

### Check Pod Status

```bash
kubectl get pods -n backstage
kubectl describe pod -n backstage <pod-name>
```

### Database Connectivity Issues

Verify the database secret has the correct endpoint:

```bash
aws secretsmanager get-secret-value \
  --secret-id {deployment:id}-backstage-db-credentials \
  --query SecretString --output text | jq .
```

### GitHub OAuth Issues

1. Verify callback URL matches exactly: `https://backstage.YOUR_DOMAIN/api/auth/github/handler/frame`
2. Check the secret contains valid `client_id` and `client_secret`
3. Ensure the GitHub OAuth app is not suspended

## Cleanup

To destroy all resources:

```bash
cdk destroy
```

**Warning**: This will delete all resources including the database. Ensure you have backups if needed.

## Cost Considerations

This deployment creates:
- EKS cluster (~$0.10/hour for control plane)
- Aurora PostgreSQL Serverless v2 (pay per ACU-hour)
- NAT Gateways (~$0.045/hour each, 2 by default)
- EC2 instances via Karpenter (varies by workload)
- Application Load Balancer (~$0.0225/hour + data processing)

Estimated minimum cost: ~$150-200/month for a minimal deployment.

To reduce costs for non-production:
- Reduce NAT gateways to 1 in `conf.mustache`
- Use smaller instance types in Karpenter NodePool
- Scale down replicas when not in use
