# aws-idp-infra

Internal Developer Platform on AWS EKS. Java 21, AWS CDK 2.219.0.

**Depends on**: `cdk-common` (install first with `mvn install -DskipTests`)

## Architecture

```
IdpStack (main)
  ├── NetworkNestedStack      # VPC, subnets, NAT
  ├── EksNestedStack          # EKS cluster, managed addons, node groups
  ├── CoreAddonsNestedStack   # cert-manager, karpenter, external-dns, etc.
  ├── BackstageNestedStack    # Backstage IDP application
  ├── ArgoAddonsNestedStack   # kyverno, argo-workflows, argocd
  └── ObservabilityAddonsStack # grafana k8s-monitoring
```

## Directory Layout

```
src/main/java/fasti/sh/idp/
  Launch.java                 # CDK app entry point
  stack/
    IdpStack.java             # Main orchestration stack (nested mode)
    IdpStacks.java            # Independent stacks mode
    IdpReleaseConf.java       # Configuration record

src/main/resources/production/v1/
  conf.mustache               # Main config
  eks/addons.mustache         # All addon configs
  helm/*.mustache             # Helm chart values
  policy/*.mustache           # IAM policy templates
```

## Deployment Modes

```bash
# Nested stacks (default) - single deploy
cdk deploy --all

# Independent stacks - granular deploy
cdk deploy --context independent-stacks=true
cdk deploy *-network
cdk deploy *-eks
cdk deploy *-core-addons
```

## Key Addons

| Addon | Purpose |
|-------|---------|
| cert-manager | TLS certificates |
| karpenter | Node autoscaling |
| external-dns | DNS record management |
| external-secrets | AWS Secrets Manager integration |
| argocd | GitOps continuous delivery |
| argo-workflows | CI/CD workflows |
| kyverno | Policy enforcement |
| grafana k8s-monitoring | Observability |

## Commands

```bash
mvn compile -q                 # Compile
mvn spotless:apply             # Format code
cdk synth                      # Synthesize CloudFormation
cdk deploy                     # Deploy to AWS
```

## Key Files

- `stack/IdpStack.java` - Main stack orchestration
- `stack/CoreAddonsStack.java` - Uses AddonChain for core addons
- `resources/production/v1/eks/addons.mustache` - Addon configuration
- `resources/production/v1/helm/*.mustache` - Helm values

## Configuration

Edit `cdk.context.json`:
- AWS account/region
- Domain name
- Administrator IAM roles
- Grafana Cloud credentials

## Don't

- Deploy without installing cdk-common first
- Modify addons.mustache without updating helm values templates
- Skip policy templates when adding new addons with IAM roles
