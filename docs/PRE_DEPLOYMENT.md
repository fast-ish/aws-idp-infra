# Pre-Deployment Checklist

Complete these steps **before** running `cdk deploy`.

## Prerequisites

| Requirement | Version | Installation |
|-------------|---------|--------------|
| **Java** | 21+ | [SDKMAN](https://sdkman.io/) |
| **Maven** | 3.8+ | [Maven Download](https://maven.apache.org/download.cgi) |
| **AWS CLI** | 2.x | [AWS CLI Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| **AWS CDK CLI** | Latest | [CDK Getting Started](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html) |
| **kubectl** | 1.28+ | [kubectl Install](https://kubernetes.io/docs/tasks/tools/) |

Verify installations:
```bash
java --version
mvn --version
cdk --version
kubectl version --client
aws --version
```

## Step 1: Build cdk-common

```bash
cd ../cdk-common
mvn clean install -DskipTests
cd ../aws-backstage-infra
```

## Step 2: Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://<account-id>/<region>
```

See: [CDK Bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)

## Step 3: Create Grafana Cloud Secret

The EKS observability stack requires a pre-existing AWS Secrets Manager secret containing Grafana Cloud credentials. This secret **must exist before deployment**.

### Get Credentials from Grafana Cloud

1. Log in to [Grafana Cloud](https://grafana.com/auth/sign-in)
2. Select your stack
3. Collect credentials from each service's **Details** page:

| Service | Values Needed |
|---------|---------------|
| Instance | `instanceId` from URL or dashboard |
| Access Policies | Create token with write scopes → `key` |
| Loki | `lokiHost`, `lokiUsername` |
| Prometheus | `prometheusHost`, `prometheusUsername` |
| Tempo | `tempoHost`, `tempoUsername` |
| Profiles | `pyroscopeHost` |
| Fleet Management | `fleetManagementHost` |

### Create the Secret

```bash
aws secretsmanager create-secret \
  --name "your-org-grafana" \
  --description "Grafana Cloud credentials for EKS observability" \
  --secret-string '{
    "instanceId": "YOUR_INSTANCE_ID",
    "key": "glc_YOUR_API_KEY",
    "lokiHost": "https://logs-prod-XXX.grafana.net",
    "lokiUsername": "YOUR_LOKI_USERNAME",
    "prometheusHost": "https://prometheus-prod-XX-prod-us-west-0.grafana.net",
    "prometheusUsername": "YOUR_PROMETHEUS_USERNAME",
    "tempoHost": "https://tempo-prod-XX-prod-us-west-0.grafana.net/tempo",
    "tempoUsername": "YOUR_TEMPO_USERNAME",
    "pyroscopeHost": "https://profiles-prod-XXX.grafana.net:443",
    "fleetManagementHost": "https://fleet-management-prod-XXX.grafana.net"
  }'
```

### Secret Structure

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

**Required API Key Permissions**:

| Permission | Access | Purpose |
|------------|--------|---------|
| `metrics` | Read/Write | Prometheus metrics ingestion |
| `logs` | Read/Write | Loki log ingestion |
| `traces` | Read/Write | Tempo trace ingestion |
| `profiles` | Read/Write | Pyroscope profiling data |

See: [Grafana Cloud Kubernetes Monitoring](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/)

## Step 4: Create GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Backstage`
   - **Homepage URL**: `https://backstage.YOUR_DOMAIN`
   - **Authorization callback URL**: `https://backstage.YOUR_DOMAIN/api/auth/github/handler/frame`
4. Click **Register application**
5. Note the **Client ID**
6. Click **Generate a new client secret** and note the **Client Secret**

Save these credentials - you'll need them after deployment.

## Step 5: Configure cdk.context.json

Create from template:
```bash
cp cdk.context.template.json cdk.context.json
```

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `platform:id` | Platform identifier | `myplatform` |
| `platform:organization` | Organization name | `myorg` |
| `platform:account` | AWS account ID (12-digit) | `123456789012` |
| `platform:region` | AWS region | `us-west-2` |
| `platform:domain` | Root domain | `example.com` |
| `deployment:id` | Deployment identifier | `backstage-prod` |
| `deployment:organization` | Team/org name | `platform-team` |
| `deployment:account` | AWS account ID | `123456789012` |
| `deployment:region` | AWS region | `us-west-2` |
| `deployment:team:name` | Team name | `platform` |
| `deployment:team:alias` | Team alias | `backstage` |
| `deployment:domain` | Backstage domain | `backstage.example.com` |
| `deployment:eks:grafana:secret` | Grafana secret name | `your-org-grafana` |

### Cluster Access

```json
"deployment:eks:administrators": [
  {
    "username": "admin",
    "role": "arn:aws:iam::123456789012:role/YourAdminRole",
    "email": "admin@example.com"
  }
],
"deployment:eks:users": []
```

**Finding your IAM role ARN (AWS SSO)**:
```bash
aws iam list-roles --query "Roles[?contains(RoleName, 'AWSReservedSSO')].Arn" --output table
```

See: [EKS Access Entries](https://docs.aws.amazon.com/eks/latest/userguide/access-entries.html)

## Step 6: Verify Configuration

```bash
mvn clean compile
cdk synth
```

Review output for errors before proceeding.

## Checklist

- [ ] Java 21+ installed
- [ ] Maven 3.8+ installed
- [ ] AWS CDK CLI installed
- [ ] AWS credentials configured
- [ ] cdk-common built (`mvn clean install -DskipTests`)
- [ ] CDK bootstrapped in target account/region
- [ ] Grafana Cloud secret created in AWS Secrets Manager
- [ ] GitHub OAuth application created (credentials saved)
- [ ] `cdk.context.json` configured
- [ ] `cdk synth` runs without errors

## Deploy

```bash
cdk deploy
```

Deployment takes ~30-45 minutes.

After deployment completes, see [POST_DEPLOYMENT.md](POST_DEPLOYMENT.md).
