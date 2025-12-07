# AWS Backstage Infrastructure

CDK infrastructure template for deploying [Backstage.io](https://backstage.io/) developer portal on AWS.

## Overview

This project provides a complete infrastructure-as-code solution for deploying Backstage on AWS using:

- **Amazon EKS** - Kubernetes cluster for running Backstage
- **Amazon RDS PostgreSQL** - Managed database for Backstage metadata
- **AWS Secrets Manager** - Secure storage for GitHub OAuth credentials
- **Helm Chart** - Kubernetes deployment of Backstage application

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
|  +----------------+               +---------v---------+                                 |
|  | Public Subnet  |               |  Private Subnet   |                                 |
|  |                |               |                   |                                 |
|  |  NAT Gateway   |               |  +-------------+  |                                 |
|  |                |               |  |  EKS Nodes  |  |                                 |
|  +----------------+               |  | (Backstage) |  |                                 |
|                                   |  +------+------+  |                                 |
|                                   |         |         |                                 |
|                                   |  +------v------+  |                                 |
|                                   |  |   RDS       |  |                                 |
|                                   |  | PostgreSQL  |  |                                 |
|                                   |  +-------------+  |                                 |
|                                   +-------------------+                                 |
+-----------------------------------------------------------------------------------------+
```

## Prerequisites

- Java 21+
- Maven 3.8+
- AWS CDK CLI
- cdk-common library (built locally)
- AWS credentials configured

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

- `conf.mustache` - Main configuration including VPC, EKS, RDS, and Helm settings
- `backstage/values.mustache` - Helm chart values for Backstage deployment

### Context Variables

Configuration uses CDK context variables for environment-specific values:

| Variable | Description |
|----------|-------------|
| `platform:id` | Platform identifier |
| `deployment:id` | Deployment-specific ID |
| `deployment:account` | AWS account ID |
| `deployment:region` | AWS region |
| `deployment:domain` | Domain name for Backstage |
| `deployment:organization` | Organization name |

## Components

### CDK Stacks

- **BackstageStack** - Main orchestrating stack
  - NetworkNestedStack - VPC and networking
  - EksNestedStack - EKS cluster
  - BackstageNestedStack - RDS, secrets, Helm deployment
  - ObservabilityNestedStack - Monitoring and logging

### Helm Chart

Located in `helm/chart/backstage/`:

- Deployment with health checks
- Service and Ingress (ALB)
- SecretProviderClass for AWS Secrets
- Karpenter NodePool and EC2NodeClass
- ConfigMap with app-config.yaml

## GitHub OAuth Setup

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL to `https://backstage.{your-domain}/api/auth/github/handler/frame`
3. Store credentials in AWS Secrets Manager:
   ```json
   {
     "client_id": "your-client-id",
     "client_secret": "your-client-secret"
   }
   ```

## Development

### Code Quality

```bash
# Run tests
mvn test

# Check code style
mvn checkstyle:check

# Static analysis
mvn spotbugs:check pmd:check

# Format code
mvn spotless:apply
```

### Project Structure

```
aws-backstage-infra/
├── src/main/java/fasti/sh/backstage/
│   ├── Launch.java                    # CDK app entry point
│   └── stack/
│       ├── BackstageStack.java        # Main stack
│       ├── BackstageReleaseConf.java  # Configuration record
│       └── BackstageNestedStack.java  # Helm deployment
├── src/main/resources/production/v1/
│   ├── conf.mustache                  # Main configuration
│   └── backstage/values.mustache # Helm values
├── helm/chart/backstage/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/                     # Kubernetes manifests
└── .github/workflows/                 # CI/CD pipelines
```

## License

Apache 2.0 - See [LICENSE.md](LICENSE.md) for details.
