# AWS Internal Developer Platform Infrastructure

CDK infrastructure for deploying a complete Internal Developer Platform (IDP) on AWS EKS.

## Overview

This project provides infrastructure-as-code for a production-ready IDP featuring:

- **Backstage** - Developer portal for service catalog and documentation
- **Argo CD** - GitOps continuous delivery
- **Argo Workflows** - Workflow automation and CI pipelines
- **Argo Events** - Event-driven automation
- **Argo Rollouts** - Progressive delivery with canary/blue-green deployments

## Architecture

```
                                    +-----------------+
                                    |    Internet     |
                                    +--------+--------+
                                             |
                                    +--------v--------+
                                    |   ALB Ingress   |
                                    +--------+--------+
                                             |
+---------------------------------------------|-------------------------------------------+
|  VPC                                        |                                           |
|                                   +---------v---------+                                 |
|                                   |  Private Subnets  |                                 |
|                                   |                   |                                 |
|   +---------------------------+   |  +-------------+  |   +---------------------------+ |
|   |      Backstage            |   |  |  EKS Nodes  |  |   |      Argo CD              | |
|   |   Developer Portal        |   |  | (Karpenter) |  |   |   GitOps Engine           | |
|   +---------------------------+   |  +-------------+  |   +---------------------------+ |
|                                   |                   |                                 |
|   +---------------------------+   |  +-------------+  |   +---------------------------+ |
|   |    Argo Workflows         |   |  |     RDS     |  |   |    Argo Events            | |
|   |   CI/CD Pipelines         |   |  | PostgreSQL  |  |   |  Event Automation         | |
|   +---------------------------+   |  +-------------+  |   +---------------------------+ |
|                                   |                   |                                 |
|   +---------------------------+   +-------------------+   +---------------------------+ |
|   |    Argo Rollouts          |                           |     Observability         | |
|   | Progressive Delivery      |                           |  Grafana + Alloy          | |
|   +---------------------------+                           +---------------------------+ |
+-----------------------------------------------------------------------------------------+
```

## Components

### Nested Stacks

| Stack                          | Description                                                |
|--------------------------------|------------------------------------------------------------|
| NetworkNestedStack             | VPC with public/private subnets, NAT gateways              |
| EksNestedStack                 | EKS cluster with managed node groups                       |
| AddonsNestedStack              | Core add-ons (Karpenter, cert-manager, external-dns, etc.) |
| ObservabilityAddonsNestedStack | Grafana, Alloy for monitoring                              |
| IdpSetupNestedStack            | Shared certificates and component configuration            |
| BackstageNestedStack           | Developer portal deployment                                |
| ArgoCdNestedStack              | GitOps continuous delivery                                 |
| ArgoWorkflowsNestedStack       | Workflow automation                                        |
| ArgoEventsNestedStack          | Event-driven triggers                                      |
| ArgoRolloutsNestedStack        | Progressive delivery                                       |

### Core Add-ons

- **Karpenter** - Kubernetes node autoscaling
- **cert-manager** - TLS certificate management
- **external-dns** - Automatic DNS record management
- **external-secrets** - AWS Secrets Manager integration
- **AWS Load Balancer Controller** - ALB/NLB ingress
- **Kyverno** - Policy enforcement
- **Velero** - Backup and disaster recovery
- **Metrics Server** - Resource metrics
- **Reloader** - ConfigMap/Secret change detection

## Prerequisites

- Java 21+
- Maven 3.8+
- AWS CDK CLI
- cdk-common library (built locally)
- AWS credentials configured

## Pre-deployment Setup

Before deploying, you must create AWS Secrets Manager secrets for GitHub OAuth. Use the provided script:

```bash
./scripts/pre-deploy.sh \
  --domain idp.example.com \
  --prefix myidp \
  --backstage-client-id Ov23li... \
  --backstage-client-secret abc123... \
  --argocd-client-id Ov23li... \
  --argocd-client-secret def456...
```

### Required Secrets

The IDP requires two AWS Secrets Manager secrets for GitHub OAuth authentication:

#### Backstage Secret (`{prefix}-backstage-github-oauth`)

| Key             | Description                        |
|-----------------|------------------------------------|
| `client_id`     | GitHub OAuth App client ID         |
| `client_secret` | GitHub OAuth App client secret     |

#### ArgoCD Secret (`{prefix}-argocd-github-oauth`)

| Key               | Description                                    |
|-------------------|------------------------------------------------|
| `client_id`       | GitHub OAuth App client ID                     |
| `client_secret`   | GitHub OAuth App client secret                 |
| `server_secretkey`| Random key for signing tokens (auto-generated) |

### Troubleshooting Secrets

If ExternalSecrets fail to sync, check:

```bash
# Check ExternalSecret status
kubectl get externalsecrets -A

# View sync errors
kubectl describe externalsecret -n argocd argocd-github-oauth
```

**Common errors:**

- `SecretSyncedError: could not get secret data from provider` - The AWS secret is missing required keys. Verify all keys exist:
  ```bash
  aws secretsmanager get-secret-value --secret-id {prefix}-argocd-github-oauth \
    --query 'SecretString' --output text | jq 'keys'
  ```

- Missing `server_secretkey` for ArgoCD will cause the ExternalSecret to fail. Add it manually:
  ```bash
  # Get current secret
  CURRENT=$(aws secretsmanager get-secret-value --secret-id {prefix}-argocd-github-oauth \
    --query 'SecretString' --output text)

  # Add server_secretkey
  UPDATED=$(echo "$CURRENT" | jq --arg key "$(openssl rand -base64 32)" \
    '. + {server_secretkey: $key}')

  # Update secret
  aws secretsmanager put-secret-value --secret-id {prefix}-argocd-github-oauth \
    --secret-string "$UPDATED"

  # Force ExternalSecret refresh
  kubectl annotate externalsecret -n argocd argocd-github-oauth \
    force-sync=$(date +%s) --overwrite
  ```

## Quick Start

1. **Build cdk-common dependency:**
   ```bash
   cd ../cdk-common
   mvn clean install -DskipTests
   ```

2. **Build this project:**
   ```bash
   mvn clean compile
   ```

3. **Synthesize CloudFormation:**
   ```bash
   cdk synth
   ```

4. **Deploy:**
   ```bash
   cdk deploy
   ```

## Configuration

Configuration is managed via Mustache templates in `src/main/resources/production/v1/`:

- `conf.mustache` - Main configuration
- `eks/addons.mustache` - EKS add-on versions
- `argocd/values.mustache` - Argo CD Helm values
- `argo-workflows/values.mustache` - Argo Workflows Helm values
- `argo-events/values.mustache` - Argo Events Helm values
- `argo-rollouts/values.mustache` - Argo Rollouts Helm values
- `backstage/values.mustache` - Backstage Helm values

### Context Variables

| Variable                  | Description            |
|---------------------------|------------------------|
| `platform:id`             | Platform identifier    |
| `deployment:id`           | Deployment-specific ID |
| `deployment:account`      | AWS account ID         |
| `deployment:region`       | AWS region             |
| `deployment:domain`       | Domain name            |
| `deployment:organization` | Organization name      |

## Smoke Tests

Run infrastructure validation:

```bash
cd scripts/smoke-test
go run main.go
```

## Development

```bash
# Run tests
mvn test

# Format code
mvn spotless:apply

# Compile
mvn compile
```

## Project Structure

```
aws-idp-infra/
├── src/main/java/fasti/sh/idp/
│   ├── Launch.java                    # CDK app entry point
│   ├── model/                         # Configuration records
│   └── stack/
│       ├── IdpStack.java              # Main orchestrating stack
│       ├── IdpSetupNestedStack.java   # Shared setup
│       ├── BackstageNestedStack.java  # Developer portal
│       ├── ArgoCdNestedStack.java     # GitOps
│       ├── ArgoWorkflowsNestedStack.java
│       ├── ArgoEventsNestedStack.java
│       └── ArgoRolloutsNestedStack.java
├── src/main/resources/production/v1/
│   ├── conf.mustache
│   ├── eks/addons.mustache
│   └── */values.mustache              # Helm values
├── scripts/smoke-test/                # Infrastructure tests
└── helm/                              # Helm charts
```

## License

Apache 2.0
