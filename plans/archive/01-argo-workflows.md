# Argo Workflows Integration

> **Status: IMPLEMENTED**

Deploy Argo Workflows on EKS with Backstage integration for workflow execution with input parameters.

> **Implementation**:
> - **CDK (helm/argo-workflows.mustache)**: Argo Workflows helm chart with production hardening:
>   - Server: 2 replicas, ALB ingress, Backstage CORS support, security contexts
>   - Controller: 2 replicas, leader election, HA configuration
>   - Workflow archive: PostgreSQL persistence for history (30-day retention)
>   - Parallelism limits: 20 global, 10 per namespace
>   - Rate limiting: 10 limit, 5 burst for resource protection
>   - Default retry strategy with exponential backoff
>   - S3 artifact storage with organized key format
>   - Security contexts (runAsNonRoot, readOnlyRootFilesystem, drop ALL capabilities)
>   - Team namespaces: argo, team-backend, team-frontend, team-data, team-ml, team-integrations
> - **GitOps (platform/argo-workflows/templates/)**:
>   - `ci-build-push.yaml` - Basic build and push pipeline
>   - `ci-test.yaml` - Test execution template
>   - `ci-secure-build.yaml` - Build with scanning, SBOM, signing
>   - `ci-cd-pipeline.yaml` - Complete CI/CD pipeline with ArgoCD deploy
>   - `deploy-kubernetes.yaml` - Direct K8s deployment
>   - `deploy-argocd-sync.yaml` - GitOps deployment via ArgoCD
> - **Network Policies**: `platform/network-policies/argo-workflows-netpol.yaml`
>   - Least-privilege policies for server, controller, and workflow executor pods

## Goal

Enable EKS-native workflow execution from Backstage, allowing users to trigger workflows with custom input variables. This follows the same infrastructure-as-code pattern as aws-eks-infra, aws-druid-infra, and aws-webapp-infra.

## Why Argo Workflows

| Feature | Argo Workflows | GitHub Actions | Tekton |
|---------|---------------|----------------|--------|
| EKS Native | Yes | No | Yes |
| Input Parameters | Full support | workflow_dispatch | Limited |
| DAG Support | Native | Limited | Pipeline |
| Artifact Passing | Built-in S3/GCS | Actions artifacts | PVC-based |
| UI | Argo Server | GitHub UI | Dashboard |
| Backstage Plugin | Community | Community | Community |
| CNCF | Graduated | N/A | Graduated |

Argo Workflows is the best fit because:
- Runs natively in EKS as Kubernetes pods
- First-class support for parameterized workflows
- DAG-based workflow definitions with dependencies
- Native S3 artifact storage (AWS-native)
- Mature Backstage plugin ecosystem
- CNCF graduated project with active community

## Architecture

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                        EKS Cluster                          │
                                    │                                                             │
┌──────────────┐                    │  ┌─────────────────┐    ┌─────────────────────────────────┐│
│              │   HTTPS/443        │  │   Argo Server   │    │       argo namespace            ││
│   Backstage  │───────────────────────│   (API + UI)    │    │                                 ││
│   Developer  │                    │  │                 │    │  ┌──────────┐  ┌──────────┐    ││
│    Portal    │                    │  │  - REST API     │    │  │ Workflow │  │ Workflow │    ││
│              │                    │  │  - WebSocket    │    │  │   Pod 1  │  │   Pod 2  │    ││
└──────────────┘                    │  │  - Auth         │    │  └──────────┘  └──────────┘    ││
       │                            │  └────────┬────────┘    │        │             │         ││
       │                            │           │             │        │             │         ││
       │                            │  ┌────────┴────────┐    │        ▼             ▼         ││
       │                            │  │ Workflow        │    │  ┌──────────────────────────┐  ││
       │                            │  │ Controller      │───────│      Workflow Executor   │  ││
       │                            │  │                 │    │  │      (wait, script, etc) │  ││
       │                            │  │  - Watch CRDs   │    │  └──────────────────────────┘  ││
       │                            │  │  - Schedule     │    │                                 ││
       │                            │  │  - Orchestrate  │    └─────────────────────────────────┘│
       │                            │  └────────┬────────┘                                       │
       │                            │           │                                                │
       │                            └───────────┼────────────────────────────────────────────────┘
       │                                        │
       │                                        ▼
       │                            ┌───────────────────────┐
       │                            │    AWS Resources      │
       │                            │                       │
       │                            │  ┌─────────────────┐  │
       │                            │  │   S3 Bucket     │  │
       │                            │  │   (Artifacts)   │  │
       │                            │  └─────────────────┘  │
       │                            │                       │
       │                            │  ┌─────────────────┐  │
       │                            │  │ Aurora Postgres │  │
       │                            │  │   (Archive)     │  │
       │                            │  └─────────────────┘  │
       │                            │                       │
       │                            │  ┌─────────────────┐  │
       │                            │  │ Secrets Manager │  │
       │                            │  │   (Credentials) │  │
       │                            │  └─────────────────┘  │
       │                            │                       │
       │                            │  ┌─────────────────┐  │
       │                            │  │      ECR        │  │
       │                            │  │   (Images)      │  │
       │                            │  └─────────────────┘  │
       │                            └───────────────────────┘
       │
       │ Plugin Integration
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                   Backstage Plugins                       │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │ @backstage-community│  │  Custom Scaffolder Actions │  │
│  │ /plugin-argo-       │  │                            │  │
│  │  workflows          │  │  - Submit Workflow         │  │
│  │                     │  │  - Get Workflow Status     │  │
│  │  - View Workflows   │  │  - List Templates          │  │
│  │  - Trigger w/ Params│  │                            │  │
│  │  - View Logs        │  │                            │  │
│  └────────────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Project Structure

This will be created as a new CDK project `aws-argo-infra`:

```
aws-argo-infra/
├── cdk.json
├── cdk.context.template.json              # Template for environment-specific values
├── pom.xml                                 # Maven dependencies
├── renovate.json                           # Dependency updates
├── checkstyle.xml                          # Code style
├── spotbugs-exclude.xml                    # Static analysis exclusions
├── dependency-check-suppressions.xml       # CVE suppressions
├── src/main/java/fasti/sh/
│   ├── ArgoApp.java                        # CDK app entry point
│   └── argo/
│       └── stack/
│           ├── ArgoWorkflowsStack.java     # Main Argo deployment
│           ├── ArgoStorageStack.java       # S3 + optional PostgreSQL
│           └── ArgoIamStack.java           # IRSA roles
├── helm/
│   └── argo-workflows/
│       ├── values.yaml                     # Base values
│       └── values.mustache                 # Template with CDK outputs
├── docs/
│   ├── PRE_DEPLOYMENT.md                   # Prerequisites
│   ├── DEPLOYMENT.md                       # CDK deploy steps
│   └── POST_DEPLOYMENT.md                  # Verification & testing
├── workflow-templates/
│   ├── build/
│   │   ├── build-docker-image.yaml         # Kaniko-based image build
│   │   ├── build-java-maven.yaml           # Maven build
│   │   └── build-node-pnpm.yaml            # Node.js build
│   ├── deploy/
│   │   ├── deploy-kubernetes.yaml          # kubectl apply
│   │   ├── deploy-helm.yaml                # Helm upgrade
│   │   └── deploy-argocd-sync.yaml         # ArgoCD sync
│   ├── test/
│   │   ├── run-integration-tests.yaml      # Integration test runner
│   │   └── run-load-tests.yaml             # k6/locust load tests
│   └── composite/
│       ├── ci-pipeline.yaml                # Full CI: build → test → deploy
│       └── release-pipeline.yaml           # Release with approvals
└── plans/
    └── README.md
```

## CDK Stacks - Detailed Implementation

### 1. ArgoStorageStack

Creates S3 bucket for artifacts and optional PostgreSQL for workflow archive:

```java
package fasti.sh.argo.stack;

import software.amazon.awscdk.*;
import software.amazon.awscdk.services.ec2.*;
import software.amazon.awscdk.services.rds.*;
import software.amazon.awscdk.services.s3.*;
import software.amazon.awscdk.services.secretsmanager.*;
import software.constructs.Construct;

import java.util.List;
import java.util.Map;

public class ArgoStorageStack extends Stack {

    private final IBucket artifactBucket;
    private final IDatabaseCluster database;
    private final ISecret databaseSecret;

    public ArgoStorageStack(Construct scope, String id, ArgoStorageStackProps props) {
        super(scope, id, props);

        // S3 Bucket for workflow artifacts
        // - Stores workflow logs
        // - Stores intermediate artifacts between steps
        // - Stores final outputs
        this.artifactBucket = new Bucket(this, "ArgoArtifactBucket", BucketProps.builder()
            .bucketName(String.format("%s-argo-artifacts-%s",
                props.getEnvironmentName(),
                props.getAccount()))
            .encryption(BucketEncryption.S3_MANAGED)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .versioned(false)  // Artifacts are immutable, no need for versioning
            .lifecycleRules(List.of(
                LifecycleRule.builder()
                    .id("expire-old-artifacts")
                    .expiration(Duration.days(30))  // Configurable retention
                    .noncurrentVersionExpiration(Duration.days(7))
                    .build(),
                LifecycleRule.builder()
                    .id("intelligent-tiering")
                    .transitions(List.of(
                        Transition.builder()
                            .storageClass(StorageClass.INTELLIGENT_TIERING)
                            .transitionAfter(Duration.days(1))
                            .build()
                    ))
                    .build()
            ))
            .removalPolicy(RemovalPolicy.RETAIN)  // Keep artifacts on stack deletion
            .build());

        // Enable server access logging
        var loggingBucket = new Bucket(this, "ArgoArtifactLoggingBucket", BucketProps.builder()
            .bucketName(String.format("%s-argo-artifacts-logs-%s",
                props.getEnvironmentName(),
                props.getAccount()))
            .encryption(BucketEncryption.S3_MANAGED)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .lifecycleRules(List.of(
                LifecycleRule.builder()
                    .expiration(Duration.days(90))
                    .build()
            ))
            .removalPolicy(RemovalPolicy.DESTROY)
            .autoDeleteObjects(true)
            .build());

        // Enable access logging on artifact bucket
        ((Bucket) this.artifactBucket).addToResourcePolicy(/* logging policy */);

        // PostgreSQL for workflow archive (optional but recommended for production)
        // - Stores completed workflow metadata
        // - Enables searching/filtering workflows
        // - Required for workflow archive feature
        if (props.isEnableWorkflowArchive()) {

            // Database credentials in Secrets Manager
            this.databaseSecret = new Secret(this, "ArgoDbSecret", SecretProps.builder()
                .secretName(String.format("%s/argo/database", props.getEnvironmentName()))
                .generateSecretString(SecretStringGenerator.builder()
                    .secretStringTemplate("{\"username\": \"argo_admin\"}")
                    .generateStringKey("password")
                    .excludePunctuation(true)
                    .passwordLength(32)
                    .build())
                .build());

            // Security group for database
            var dbSecurityGroup = new SecurityGroup(this, "ArgoDbSecurityGroup",
                SecurityGroupProps.builder()
                    .vpc(props.getVpc())
                    .description("Security group for Argo Workflows PostgreSQL")
                    .allowAllOutbound(false)
                    .build());

            // Allow inbound from EKS cluster security group
            dbSecurityGroup.addIngressRule(
                props.getEksClusterSecurityGroup(),
                Port.tcp(5432),
                "Allow PostgreSQL from EKS"
            );

            // Aurora PostgreSQL Serverless v2
            // - Auto-scales based on load
            // - Cost-effective for variable workflow volume
            // - Multi-AZ for high availability
            this.database = new DatabaseCluster(this, "ArgoArchiveDb",
                DatabaseClusterProps.builder()
                    .engine(DatabaseClusterEngine.auroraPostgres(
                        AuroraPostgresClusterEngineProps.builder()
                            .version(AuroraPostgresEngineVersion.VER_15_4)
                            .build()
                    ))
                    .serverlessV2MinCapacity(0.5)   // Min 0.5 ACU (~1GB RAM)
                    .serverlessV2MaxCapacity(4)     // Max 4 ACU (~8GB RAM)
                    .writer(ClusterInstance.serverlessV2("writer",
                        ServerlessV2ClusterInstanceProps.builder()
                            .publiclyAccessible(false)
                            .build()))
                    .readers(List.of(
                        ClusterInstance.serverlessV2("reader",
                            ServerlessV2ClusterInstanceProps.builder()
                                .scaleWithWriter(true)
                                .build())
                    ))
                    .vpc(props.getVpc())
                    .vpcSubnets(SubnetSelection.builder()
                        .subnetType(SubnetType.PRIVATE_ISOLATED)
                        .build())
                    .securityGroups(List.of(dbSecurityGroup))
                    .credentials(Credentials.fromSecret(this.databaseSecret))
                    .defaultDatabaseName("argo")
                    .storageEncrypted(true)
                    .deletionProtection(true)
                    .backup(BackupProps.builder()
                        .retention(Duration.days(7))
                        .preferredWindow("03:00-04:00")
                        .build())
                    .cloudwatchLogsExports(List.of("postgresql"))
                    .cloudwatchLogsRetention(RetentionDays.ONE_MONTH)
                    .removalPolicy(RemovalPolicy.SNAPSHOT)
                    .build());
        } else {
            this.database = null;
            this.databaseSecret = null;
        }

        // CloudFormation outputs
        new CfnOutput(this, "ArtifactBucketName", CfnOutputProps.builder()
            .value(this.artifactBucket.getBucketName())
            .exportName(String.format("%s-argo-artifact-bucket", props.getEnvironmentName()))
            .build());

        new CfnOutput(this, "ArtifactBucketArn", CfnOutputProps.builder()
            .value(this.artifactBucket.getBucketArn())
            .exportName(String.format("%s-argo-artifact-bucket-arn", props.getEnvironmentName()))
            .build());

        if (this.database != null) {
            new CfnOutput(this, "DatabaseEndpoint", CfnOutputProps.builder()
                .value(this.database.getClusterEndpoint().getHostname())
                .exportName(String.format("%s-argo-db-endpoint", props.getEnvironmentName()))
                .build());

            new CfnOutput(this, "DatabaseSecretArn", CfnOutputProps.builder()
                .value(this.databaseSecret.getSecretArn())
                .exportName(String.format("%s-argo-db-secret-arn", props.getEnvironmentName()))
                .build());
        }
    }

    public IBucket getArtifactBucket() { return artifactBucket; }
    public IDatabaseCluster getDatabase() { return database; }
    public ISecret getDatabaseSecret() { return databaseSecret; }
}
```

### 2. ArgoIamStack

Creates IRSA roles for Argo components:

```java
package fasti.sh.argo.stack;

import software.amazon.awscdk.*;
import software.amazon.awscdk.services.iam.*;
import software.amazon.awscdk.services.s3.IBucket;
import software.constructs.Construct;

import java.util.List;
import java.util.Map;

public class ArgoIamStack extends Stack {

    private final IRole argoServerRole;
    private final IRole argoControllerRole;
    private final IRole workflowExecutorRole;

    public ArgoIamStack(Construct scope, String id, ArgoIamStackProps props) {
        super(scope, id, props);

        String oidcProviderArn = props.getOidcProviderArn();
        String oidcIssuer = props.getOidcIssuer();  // Without https://

        // ===========================================
        // Argo Server Role
        // - Read workflow status
        // - Read artifacts for UI display
        // - Authentication/authorization
        // ===========================================
        this.argoServerRole = new Role(this, "ArgoServerRole", RoleProps.builder()
            .roleName(String.format("%s-argo-server", props.getEnvironmentName()))
            .assumedBy(new FederatedPrincipal(
                oidcProviderArn,
                Map.of(
                    "StringEquals", Map.of(
                        oidcIssuer + ":sub", "system:serviceaccount:argo:argo-server",
                        oidcIssuer + ":aud", "sts.amazonaws.com"
                    )
                ),
                "sts:AssumeRoleWithWebIdentity"
            ))
            .description("IAM role for Argo Server (IRSA)")
            .build());

        // Argo Server needs read access to artifacts for displaying in UI
        this.argoServerRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("S3ArtifactReadAccess")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:ListBucket"
            ))
            .resources(List.of(
                props.getArtifactBucket().getBucketArn(),
                props.getArtifactBucket().getBucketArn() + "/*"
            ))
            .build()));

        // ===========================================
        // Argo Controller Role
        // - Manage workflow pods
        // - Write to artifact storage
        // - Read secrets for workflow injection
        // ===========================================
        this.argoControllerRole = new Role(this, "ArgoControllerRole", RoleProps.builder()
            .roleName(String.format("%s-argo-controller", props.getEnvironmentName()))
            .assumedBy(new FederatedPrincipal(
                oidcProviderArn,
                Map.of(
                    "StringEquals", Map.of(
                        oidcIssuer + ":sub", "system:serviceaccount:argo:argo-workflow-controller",
                        oidcIssuer + ":aud", "sts.amazonaws.com"
                    )
                ),
                "sts:AssumeRoleWithWebIdentity"
            ))
            .description("IAM role for Argo Workflow Controller (IRSA)")
            .build());

        // Controller needs full artifact access
        this.argoControllerRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("S3ArtifactFullAccess")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ))
            .resources(List.of(
                props.getArtifactBucket().getBucketArn(),
                props.getArtifactBucket().getBucketArn() + "/*"
            ))
            .build()));

        // Controller needs to read database credentials
        if (props.getDatabaseSecretArn() != null) {
            this.argoControllerRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
                .sid("SecretsManagerDbAccess")
                .effect(Effect.ALLOW)
                .actions(List.of(
                    "secretsmanager:GetSecretValue"
                ))
                .resources(List.of(props.getDatabaseSecretArn()))
                .build()));
        }

        // ===========================================
        // Workflow Executor Role
        // - Used by workflow pods themselves
        // - ECR access for building/pushing images
        // - S3 access for artifacts
        // - Secrets access for credentials injection
        // - EKS access for kubectl operations
        // ===========================================
        this.workflowExecutorRole = new Role(this, "WorkflowExecutorRole", RoleProps.builder()
            .roleName(String.format("%s-argo-workflow-executor", props.getEnvironmentName()))
            .assumedBy(new FederatedPrincipal(
                oidcProviderArn,
                Map.of(
                    "StringLike", Map.of(
                        // Allow any service account in argo namespace to assume this role
                        // Workflows create dynamic service accounts
                        oidcIssuer + ":sub", "system:serviceaccount:argo:*"
                    ),
                    "StringEquals", Map.of(
                        oidcIssuer + ":aud", "sts.amazonaws.com"
                    )
                ),
                "sts:AssumeRoleWithWebIdentity"
            ))
            .description("IAM role for Argo Workflow execution pods (IRSA)")
            .build());

        // ECR access for building and pushing images
        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("ECRAuthToken")
            .effect(Effect.ALLOW)
            .actions(List.of("ecr:GetAuthorizationToken"))
            .resources(List.of("*"))
            .build()));

        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("ECRPushPull")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:DescribeRepositories",
                "ecr:CreateRepository",
                "ecr:DescribeImages"
            ))
            .resources(List.of(
                String.format("arn:aws:ecr:%s:%s:repository/*",
                    props.getRegion(), props.getAccount())
            ))
            .build()));

        // S3 artifact access for workflow pods
        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("S3ArtifactAccess")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:DeleteObject"
            ))
            .resources(List.of(
                props.getArtifactBucket().getBucketArn() + "/*"
            ))
            .build()));

        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("S3ListBucket")
            .effect(Effect.ALLOW)
            .actions(List.of("s3:ListBucket"))
            .resources(List.of(props.getArtifactBucket().getBucketArn()))
            .build()));

        // Secrets Manager access for workflow credentials
        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("SecretsManagerWorkflowSecrets")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ))
            .resources(List.of(
                String.format("arn:aws:secretsmanager:%s:%s:secret:%s/argo/*",
                    props.getRegion(), props.getAccount(), props.getEnvironmentName())
            ))
            .build()));

        // CloudWatch Logs for workflow logging
        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("CloudWatchLogs")
            .effect(Effect.ALLOW)
            .actions(List.of(
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"
            ))
            .resources(List.of(
                String.format("arn:aws:logs:%s:%s:log-group:/argo/*",
                    props.getRegion(), props.getAccount())
            ))
            .build()));

        // STS for cross-account operations (if needed)
        this.workflowExecutorRole.addToPolicy(new PolicyStatement(PolicyStatementProps.builder()
            .sid("STSGetCallerIdentity")
            .effect(Effect.ALLOW)
            .actions(List.of("sts:GetCallerIdentity"))
            .resources(List.of("*"))
            .build()));

        // CloudFormation outputs
        new CfnOutput(this, "ArgoServerRoleArn", CfnOutputProps.builder()
            .value(this.argoServerRole.getRoleArn())
            .exportName(String.format("%s-argo-server-role-arn", props.getEnvironmentName()))
            .build());

        new CfnOutput(this, "ArgoControllerRoleArn", CfnOutputProps.builder()
            .value(this.argoControllerRole.getRoleArn())
            .exportName(String.format("%s-argo-controller-role-arn", props.getEnvironmentName()))
            .build());

        new CfnOutput(this, "WorkflowExecutorRoleArn", CfnOutputProps.builder()
            .value(this.workflowExecutorRole.getRoleArn())
            .exportName(String.format("%s-argo-workflow-executor-role-arn", props.getEnvironmentName()))
            .build());
    }

    public IRole getArgoServerRole() { return argoServerRole; }
    public IRole getArgoControllerRole() { return argoControllerRole; }
    public IRole getWorkflowExecutorRole() { return workflowExecutorRole; }
}
```

### 3. ArgoWorkflowsStack

Main stack deploying Argo via Helm:

```java
package fasti.sh.argo.stack;

import fasti.sh.execute.aws.eks.HelmChartDeployer;
import software.amazon.awscdk.*;
import software.amazon.awscdk.services.eks.ICluster;
import software.amazon.awscdk.services.iam.IRole;
import software.amazon.awscdk.services.s3.IBucket;
import software.constructs.Construct;

import java.util.List;
import java.util.Map;

public class ArgoWorkflowsStack extends Stack {

    public ArgoWorkflowsStack(Construct scope, String id, ArgoWorkflowsStackProps props) {
        super(scope, id, props);

        // Helm values for Argo Workflows
        Map<String, Object> helmValues = Map.ofEntries(
            // ===========================================
            // Server Configuration
            // ===========================================
            Map.entry("server", Map.ofEntries(
                Map.entry("replicas", 2),
                Map.entry("serviceAccount", Map.of(
                    "create", true,
                    "name", "argo-server",
                    "annotations", Map.of(
                        "eks.amazonaws.com/role-arn", props.getArgoServerRoleArn()
                    )
                )),
                // Authentication mode: server = SSO, client = mTLS, sso = OIDC
                Map.entry("extraArgs", List.of(
                    "--auth-mode=server",
                    "--secure=false"  // TLS terminated at ALB
                )),
                // Ingress via ALB
                Map.entry("ingress", Map.ofEntries(
                    Map.entry("enabled", true),
                    Map.entry("ingressClassName", "alb"),
                    Map.entry("annotations", Map.of(
                        "alb.ingress.kubernetes.io/scheme", "internet-facing",
                        "alb.ingress.kubernetes.io/target-type", "ip",
                        "alb.ingress.kubernetes.io/certificate-arn", props.getCertificateArn(),
                        "alb.ingress.kubernetes.io/listen-ports", "[{\"HTTPS\":443}]",
                        "alb.ingress.kubernetes.io/ssl-redirect", "443",
                        "alb.ingress.kubernetes.io/healthcheck-path", "/",
                        "alb.ingress.kubernetes.io/healthcheck-protocol", "HTTP",
                        "alb.ingress.kubernetes.io/success-codes", "200-399",
                        "alb.ingress.kubernetes.io/group.name", "argo",
                        "alb.ingress.kubernetes.io/tags",
                            String.format("Environment=%s,Application=argo-workflows",
                                props.getEnvironmentName())
                    )),
                    Map.entry("hosts", List.of(
                        String.format("argo.%s", props.getDomainName())
                    ))
                )),
                // Resource limits
                Map.entry("resources", Map.of(
                    "requests", Map.of(
                        "cpu", "100m",
                        "memory", "256Mi"
                    ),
                    "limits", Map.of(
                        "cpu", "500m",
                        "memory", "512Mi"
                    )
                )),
                // Pod disruption budget
                Map.entry("pdb", Map.of(
                    "enabled", true,
                    "minAvailable", 1
                ))
            )),

            // ===========================================
            // Controller Configuration
            // ===========================================
            Map.entry("controller", Map.ofEntries(
                Map.entry("replicas", 2),
                Map.entry("serviceAccount", Map.of(
                    "create", true,
                    "name", "argo-workflow-controller",
                    "annotations", Map.of(
                        "eks.amazonaws.com/role-arn", props.getArgoControllerRoleArn()
                    )
                )),
                // Namespaces where workflows can run
                Map.entry("workflowNamespaces", List.of("argo", "default", "workflows")),
                // Workflow defaults
                Map.entry("workflowDefaults", Map.of(
                    "spec", Map.of(
                        "serviceAccountName", "argo-workflow",
                        "ttlStrategy", Map.of(
                            "secondsAfterCompletion", 3600,      // 1 hour
                            "secondsAfterSuccess", 1800,         // 30 minutes
                            "secondsAfterFailure", 86400         // 24 hours
                        ),
                        "podGC", Map.of(
                            "strategy", "OnWorkflowSuccess",
                            "deleteDelayDuration", "5m"
                        )
                    )
                )),
                // Persistence for workflow archive
                Map.entry("persistence", props.isEnableWorkflowArchive() ? Map.of(
                    "archive", true,
                    "archiveTTL", "30d",
                    "postgresql", Map.of(
                        "host", props.getDatabaseHost(),
                        "port", "5432",
                        "database", "argo",
                        "tableName", "argo_workflows",
                        "userNameSecret", Map.of(
                            "name", "argo-postgres-credentials",
                            "key", "username"
                        ),
                        "passwordSecret", Map.of(
                            "name", "argo-postgres-credentials",
                            "key", "password"
                        )
                    )
                ) : Map.of("archive", false)),
                // Metrics for Prometheus
                Map.entry("metricsConfig", Map.of(
                    "enabled", true,
                    "port", 9090,
                    "path", "/metrics"
                )),
                // Resource limits
                Map.entry("resources", Map.of(
                    "requests", Map.of(
                        "cpu", "200m",
                        "memory", "256Mi"
                    ),
                    "limits", Map.of(
                        "cpu", "1000m",
                        "memory", "1Gi"
                    )
                )),
                // Leader election for HA
                Map.entry("extraArgs", List.of(
                    "--leader-elect"
                )),
                // Pod disruption budget
                Map.entry("pdb", Map.of(
                    "enabled", true,
                    "minAvailable", 1
                ))
            )),

            // ===========================================
            // Artifact Repository (S3)
            // ===========================================
            Map.entry("artifactRepository", Map.of(
                "archiveLogs", true,
                "s3", Map.of(
                    "bucket", props.getArtifactBucketName(),
                    "region", props.getRegion(),
                    "endpoint", String.format("s3.%s.amazonaws.com", props.getRegion()),
                    "useSDKCreds", true,  // Use IRSA
                    "insecure", false,
                    "keyFormat", "artifacts/{{workflow.namespace}}/{{workflow.name}}/{{workflow.creationTimestamp.Y}}/{{workflow.creationTimestamp.m}}/{{workflow.creationTimestamp.d}}/{{pod.name}}"
                )
            )),

            // ===========================================
            // Workflow Service Account
            // ===========================================
            Map.entry("workflow", Map.of(
                "serviceAccount", Map.of(
                    "create", true,
                    "name", "argo-workflow",
                    "annotations", Map.of(
                        "eks.amazonaws.com/role-arn", props.getWorkflowExecutorRoleArn()
                    )
                ),
                // RBAC for workflow pods
                "rbac", Map.of(
                    "create", true
                )
            )),

            // ===========================================
            // Executor Configuration
            // ===========================================
            Map.entry("executor", Map.of(
                "image", Map.of(
                    "registry", "quay.io",
                    "repository", "argoproj/argoexec",
                    "tag", "v3.5.2"
                ),
                "resources", Map.of(
                    "requests", Map.of(
                        "cpu", "10m",
                        "memory", "64Mi"
                    ),
                    "limits", Map.of(
                        "cpu", "100m",
                        "memory", "256Mi"
                    )
                )
            )),

            // ===========================================
            // Global Settings
            // ===========================================
            Map.entry("useStaticCredentials", false),  // Use IRSA
            Map.entry("singleNamespace", false),       // Multi-namespace support
            Map.entry("createAggregateRoles", true)    // Aggregate cluster roles
        );

        // Deploy Helm chart
        HelmChartDeployer.deploy(this, "ArgoWorkflowsChart", HelmChartDeployerProps.builder()
            .cluster(props.getCluster())
            .chart("argo-workflows")
            .repository("https://argoproj.github.io/argo-helm")
            .version("0.41.1")  // Pin version for reproducibility
            .namespace("argo")
            .createNamespace(true)
            .values(helmValues)
            .timeout(Duration.minutes(10))
            .wait(true)
            .build());

        // Create Kubernetes secret for database credentials (if using archive)
        if (props.isEnableWorkflowArchive()) {
            // This would be created via External Secrets Operator or similar
            // pointing to the Secrets Manager secret
        }

        // CloudFormation outputs
        new CfnOutput(this, "ArgoServerUrl", CfnOutputProps.builder()
            .value(String.format("https://argo.%s", props.getDomainName()))
            .description("Argo Workflows Server URL")
            .build());
    }
}
```

## Helm Values Template

`helm/argo-workflows/values.mustache`:

```yaml
# Argo Workflows Helm Values
# Generated from CDK - DO NOT EDIT DIRECTLY

# ===========================================
# Server Configuration
# ===========================================
server:
  replicas: 2
  serviceAccount:
    create: true
    name: argo-server
    annotations:
      eks.amazonaws.com/role-arn: {{argoServerRoleArn}}

  extraArgs:
    - --auth-mode=server
    - --secure=false

  ingress:
    enabled: true
    ingressClassName: alb
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: {{certificateArn}}
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/ssl-redirect: '443'
      alb.ingress.kubernetes.io/healthcheck-path: /
      alb.ingress.kubernetes.io/success-codes: 200-399
      alb.ingress.kubernetes.io/group.name: argo
    hosts:
      - argo.{{domainName}}

  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

  pdb:
    enabled: true
    minAvailable: 1

# ===========================================
# Controller Configuration
# ===========================================
controller:
  replicas: 2
  serviceAccount:
    create: true
    name: argo-workflow-controller
    annotations:
      eks.amazonaws.com/role-arn: {{argoControllerRoleArn}}

  workflowNamespaces:
    - argo
    - default
    - workflows

  workflowDefaults:
    spec:
      serviceAccountName: argo-workflow
      ttlStrategy:
        secondsAfterCompletion: 3600
        secondsAfterSuccess: 1800
        secondsAfterFailure: 86400
      podGC:
        strategy: OnWorkflowSuccess
        deleteDelayDuration: 5m

  {{#enableWorkflowArchive}}
  persistence:
    archive: true
    archiveTTL: 30d
    postgresql:
      host: {{postgresHost}}
      port: 5432
      database: argo
      tableName: argo_workflows
      userNameSecret:
        name: argo-postgres-credentials
        key: username
      passwordSecret:
        name: argo-postgres-credentials
        key: password
  {{/enableWorkflowArchive}}
  {{^enableWorkflowArchive}}
  persistence:
    archive: false
  {{/enableWorkflowArchive}}

  metricsConfig:
    enabled: true
    port: 9090
    path: /metrics

  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi

  extraArgs:
    - --leader-elect

  pdb:
    enabled: true
    minAvailable: 1

# ===========================================
# Artifact Repository (S3)
# ===========================================
artifactRepository:
  archiveLogs: true
  s3:
    bucket: {{artifactBucket}}
    region: {{region}}
    endpoint: s3.{{region}}.amazonaws.com
    useSDKCreds: true
    insecure: false
    keyFormat: "artifacts/{{`{{workflow.namespace}}`}}/{{`{{workflow.name}}`}}/{{`{{workflow.creationTimestamp.Y}}`}}/{{`{{workflow.creationTimestamp.m}}`}}/{{`{{workflow.creationTimestamp.d}}`}}/{{`{{pod.name}}`}}"

# ===========================================
# Workflow Service Account
# ===========================================
workflow:
  serviceAccount:
    create: true
    name: argo-workflow
    annotations:
      eks.amazonaws.com/role-arn: {{workflowExecutorRoleArn}}
  rbac:
    create: true

# ===========================================
# Executor Configuration
# ===========================================
executor:
  image:
    registry: quay.io
    repository: argoproj/argoexec
    tag: v3.5.2
  resources:
    requests:
      cpu: 10m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 256Mi

# ===========================================
# Global Settings
# ===========================================
useStaticCredentials: false
singleNamespace: false
createAggregateRoles: true
```

## Workflow Templates with Input Parameters

### 1. Build Docker Image

`workflow-templates/build/build-docker-image.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: build-docker-image
  namespace: argo
  labels:
    app.kubernetes.io/name: build-docker-image
    app.kubernetes.io/component: ci
  annotations:
    workflows.argoproj.io/description: |
      Build and push a Docker image using Kaniko.
      Supports multi-stage builds and layer caching.
spec:
  entrypoint: build-and-push

  # ===========================================
  # Input Parameters
  # Exposed in Backstage for user input
  # ===========================================
  arguments:
    parameters:
      - name: git-repo
        description: "Git repository URL (e.g., https://github.com/org/repo)"

      - name: git-branch
        default: "main"
        description: "Git branch to build"
        enum:
          - main
          - develop
          - staging

      - name: git-revision
        default: "HEAD"
        description: "Git revision (commit SHA, tag, or HEAD)"

      - name: dockerfile-path
        default: "Dockerfile"
        description: "Path to Dockerfile relative to repo root"

      - name: docker-context
        default: "."
        description: "Docker build context path"

      - name: image-name
        description: "Target image name (without registry/tag)"

      - name: image-tag
        description: "Image tag (e.g., v1.0.0, latest, commit-sha)"

      - name: ecr-registry
        description: "ECR registry URL (e.g., 123456789.dkr.ecr.us-west-2.amazonaws.com)"

      - name: build-args
        default: ""
        description: "Docker build arguments (JSON object, e.g., {\"NODE_ENV\":\"production\"})"

      - name: cache-enabled
        default: "true"
        description: "Enable Docker layer caching"
        enum:
          - "true"
          - "false"

      - name: scan-image
        default: "true"
        description: "Scan image for vulnerabilities after build"
        enum:
          - "true"
          - "false"

  # ===========================================
  # Volume Claims for workspace
  # ===========================================
  volumeClaimTemplates:
    - metadata:
        name: workspace
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
        storageClassName: gp3

  # ===========================================
  # Templates
  # ===========================================
  templates:
    # -----------------------------------------
    # Main DAG
    # -----------------------------------------
    - name: build-and-push
      dag:
        tasks:
          - name: clone
            template: git-clone
            arguments:
              parameters:
                - name: repo
                  value: "{{workflow.parameters.git-repo}}"
                - name: branch
                  value: "{{workflow.parameters.git-branch}}"
                - name: revision
                  value: "{{workflow.parameters.git-revision}}"

          - name: build
            template: kaniko-build
            dependencies: [clone]
            arguments:
              parameters:
                - name: dockerfile
                  value: "{{workflow.parameters.dockerfile-path}}"
                - name: context
                  value: "{{workflow.parameters.docker-context}}"
                - name: image-name
                  value: "{{workflow.parameters.image-name}}"
                - name: image-tag
                  value: "{{workflow.parameters.image-tag}}"
                - name: registry
                  value: "{{workflow.parameters.ecr-registry}}"
                - name: build-args
                  value: "{{workflow.parameters.build-args}}"
                - name: cache-enabled
                  value: "{{workflow.parameters.cache-enabled}}"

          - name: scan
            template: trivy-scan
            dependencies: [build]
            when: "{{workflow.parameters.scan-image}} == true"
            arguments:
              parameters:
                - name: image
                  value: "{{workflow.parameters.ecr-registry}}/{{workflow.parameters.image-name}}:{{workflow.parameters.image-tag}}"

          - name: notify
            template: slack-notify
            dependencies: [build]
            arguments:
              parameters:
                - name: status
                  value: "success"
                - name: image
                  value: "{{workflow.parameters.ecr-registry}}/{{workflow.parameters.image-name}}:{{workflow.parameters.image-tag}}"

    # -----------------------------------------
    # Git Clone
    # -----------------------------------------
    - name: git-clone
      inputs:
        parameters:
          - name: repo
          - name: branch
          - name: revision
      container:
        image: alpine/git:2.43.0
        command: [sh, -c]
        args:
          - |
            set -ex
            git clone --depth 1 -b {{inputs.parameters.branch}} \
              {{inputs.parameters.repo}} /workspace/source
            cd /workspace/source
            if [ "{{inputs.parameters.revision}}" != "HEAD" ]; then
              git fetch --depth 1 origin {{inputs.parameters.revision}}
              git checkout {{inputs.parameters.revision}}
            fi
            echo "Cloned $(git rev-parse HEAD)"
            echo "$(git rev-parse HEAD)" > /workspace/git-sha
        volumeMounts:
          - name: workspace
            mountPath: /workspace
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi

    # -----------------------------------------
    # Kaniko Build
    # -----------------------------------------
    - name: kaniko-build
      inputs:
        parameters:
          - name: dockerfile
          - name: context
          - name: image-name
          - name: image-tag
          - name: registry
          - name: build-args
          - name: cache-enabled
      container:
        image: gcr.io/kaniko-project/executor:v1.19.2
        args:
          - --dockerfile=/workspace/source/{{inputs.parameters.dockerfile}}
          - --context=/workspace/source/{{inputs.parameters.context}}
          - --destination={{inputs.parameters.registry}}/{{inputs.parameters.image-name}}:{{inputs.parameters.image-tag}}
          - --destination={{inputs.parameters.registry}}/{{inputs.parameters.image-name}}:latest
          - --cache={{inputs.parameters.cache-enabled}}
          - --cache-repo={{inputs.parameters.registry}}/{{inputs.parameters.image-name}}-cache
          - --snapshot-mode=redo
          - --use-new-run
          - --compressed-caching=false
          - --cleanup
        volumeMounts:
          - name: workspace
            mountPath: /workspace
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 4000m
            memory: 8Gi

    # -----------------------------------------
    # Trivy Security Scan
    # -----------------------------------------
    - name: trivy-scan
      inputs:
        parameters:
          - name: image
      outputs:
        artifacts:
          - name: scan-report
            path: /tmp/trivy-report.json
            archive:
              none: {}
            s3:
              key: "scans/{{workflow.name}}/trivy-report.json"
      container:
        image: aquasec/trivy:0.48.1
        command: [sh, -c]
        args:
          - |
            trivy image \
              --format json \
              --output /tmp/trivy-report.json \
              --severity HIGH,CRITICAL \
              --exit-code 0 \
              {{inputs.parameters.image}}

            # Print summary
            trivy image \
              --format table \
              --severity HIGH,CRITICAL \
              {{inputs.parameters.image}}

            # Fail if critical vulnerabilities
            CRITICAL=$(cat /tmp/trivy-report.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length')
            if [ "$CRITICAL" -gt "0" ]; then
              echo "Found $CRITICAL critical vulnerabilities!"
              exit 1
            fi
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi

    # -----------------------------------------
    # Slack Notification
    # -----------------------------------------
    - name: slack-notify
      inputs:
        parameters:
          - name: status
          - name: image
      container:
        image: curlimages/curl:8.5.0
        command: [sh, -c]
        args:
          - |
            curl -X POST $SLACK_WEBHOOK_URL \
              -H 'Content-Type: application/json' \
              -d '{
                "text": "Docker Build {{inputs.parameters.status}}",
                "blocks": [
                  {
                    "type": "section",
                    "text": {
                      "type": "mrkdwn",
                      "text": "*Docker Build {{inputs.parameters.status}}*\n`{{inputs.parameters.image}}`"
                    }
                  }
                ]
              }'
        env:
          - name: SLACK_WEBHOOK_URL
            valueFrom:
              secretKeyRef:
                name: slack-webhook
                key: url
                optional: true
        resources:
          requests:
            cpu: 10m
            memory: 32Mi
          limits:
            cpu: 100m
            memory: 64Mi
```

### 2. Deploy to Kubernetes

`workflow-templates/deploy/deploy-kubernetes.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: deploy-kubernetes
  namespace: argo
  labels:
    app.kubernetes.io/name: deploy-kubernetes
    app.kubernetes.io/component: cd
  annotations:
    workflows.argoproj.io/description: |
      Deploy an application to Kubernetes using kubectl.
      Supports rolling updates, rollbacks, and health checks.
spec:
  entrypoint: deploy

  # ===========================================
  # Input Parameters
  # ===========================================
  arguments:
    parameters:
      - name: deployment-name
        description: "Name of the Kubernetes Deployment"

      - name: namespace
        default: "default"
        description: "Target Kubernetes namespace"
        enum:
          - default
          - staging
          - production

      - name: image
        description: "Full image reference (registry/image:tag)"

      - name: container-name
        default: "app"
        description: "Container name within the deployment"

      - name: replicas
        default: "2"
        description: "Desired number of replicas"

      - name: strategy
        default: "RollingUpdate"
        description: "Deployment strategy"
        enum:
          - RollingUpdate
          - Recreate

      - name: max-surge
        default: "25%"
        description: "Max surge for rolling update"

      - name: max-unavailable
        default: "25%"
        description: "Max unavailable for rolling update"

      - name: wait-timeout
        default: "300"
        description: "Timeout in seconds to wait for rollout"

      - name: dry-run
        default: "false"
        description: "Perform a dry run without applying changes"
        enum:
          - "true"
          - "false"

  # ===========================================
  # Templates
  # ===========================================
  templates:
    # -----------------------------------------
    # Main Flow
    # -----------------------------------------
    - name: deploy
      steps:
        - - name: pre-check
            template: verify-deployment-exists
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"

        - - name: backup-current
            template: get-current-image
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"
                - name: container-name
                  value: "{{workflow.parameters.container-name}}"

        - - name: update-image
            template: set-image
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"
                - name: container-name
                  value: "{{workflow.parameters.container-name}}"
                - name: image
                  value: "{{workflow.parameters.image}}"
                - name: dry-run
                  value: "{{workflow.parameters.dry-run}}"

        - - name: scale
            template: scale-deployment
            when: "{{workflow.parameters.dry-run}} == false"
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"
                - name: replicas
                  value: "{{workflow.parameters.replicas}}"

        - - name: wait-rollout
            template: rollout-status
            when: "{{workflow.parameters.dry-run}} == false"
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"
                - name: timeout
                  value: "{{workflow.parameters.wait-timeout}}"

        - - name: verify
            template: verify-health
            when: "{{workflow.parameters.dry-run}} == false"
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.namespace}}"

    # -----------------------------------------
    # Verify Deployment Exists
    # -----------------------------------------
    - name: verify-deployment-exists
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            set -e
            echo "Checking deployment {{inputs.parameters.deployment-name}} in {{inputs.parameters.namespace}}..."
            kubectl get deployment {{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              -o jsonpath='{.metadata.name}'
            echo "Deployment found."
        resources:
          requests:
            cpu: 50m
            memory: 64Mi

    # -----------------------------------------
    # Get Current Image (for rollback reference)
    # -----------------------------------------
    - name: get-current-image
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
          - name: container-name
      outputs:
        parameters:
          - name: current-image
            valueFrom:
              path: /tmp/current-image
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            kubectl get deployment {{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              -o jsonpath='{.spec.template.spec.containers[?(@.name=="{{inputs.parameters.container-name}}")].image}' \
              > /tmp/current-image
            echo "Current image: $(cat /tmp/current-image)"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi

    # -----------------------------------------
    # Set Image
    # -----------------------------------------
    - name: set-image
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
          - name: container-name
          - name: image
          - name: dry-run
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            set -e
            DRY_RUN_FLAG=""
            if [ "{{inputs.parameters.dry-run}}" = "true" ]; then
              DRY_RUN_FLAG="--dry-run=client"
              echo "DRY RUN MODE"
            fi

            echo "Setting image {{inputs.parameters.image}} on container {{inputs.parameters.container-name}}..."
            kubectl set image deployment/{{inputs.parameters.deployment-name}} \
              {{inputs.parameters.container-name}}={{inputs.parameters.image}} \
              -n {{inputs.parameters.namespace}} \
              $DRY_RUN_FLAG \
              --record
        resources:
          requests:
            cpu: 50m
            memory: 64Mi

    # -----------------------------------------
    # Scale Deployment
    # -----------------------------------------
    - name: scale-deployment
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
          - name: replicas
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            set -e
            CURRENT=$(kubectl get deployment {{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              -o jsonpath='{.spec.replicas}')

            if [ "$CURRENT" != "{{inputs.parameters.replicas}}" ]; then
              echo "Scaling from $CURRENT to {{inputs.parameters.replicas}} replicas..."
              kubectl scale deployment {{inputs.parameters.deployment-name}} \
                --replicas={{inputs.parameters.replicas}} \
                -n {{inputs.parameters.namespace}}
            else
              echo "Already at {{inputs.parameters.replicas}} replicas"
            fi
        resources:
          requests:
            cpu: 50m
            memory: 64Mi

    # -----------------------------------------
    # Wait for Rollout
    # -----------------------------------------
    - name: rollout-status
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
          - name: timeout
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            set -e
            echo "Waiting for rollout to complete..."
            kubectl rollout status deployment/{{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              --timeout={{inputs.parameters.timeout}}s
            echo "Rollout complete!"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi

    # -----------------------------------------
    # Verify Health
    # -----------------------------------------
    - name: verify-health
      inputs:
        parameters:
          - name: deployment-name
          - name: namespace
      container:
        image: bitnami/kubectl:1.29
        command: [sh, -c]
        args:
          - |
            set -e
            echo "Verifying deployment health..."

            # Check all pods are ready
            READY=$(kubectl get deployment {{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              -o jsonpath='{.status.readyReplicas}')
            DESIRED=$(kubectl get deployment {{inputs.parameters.deployment-name}} \
              -n {{inputs.parameters.namespace}} \
              -o jsonpath='{.spec.replicas}')

            echo "Ready: $READY / Desired: $DESIRED"

            if [ "$READY" != "$DESIRED" ]; then
              echo "ERROR: Not all replicas are ready!"
              kubectl get pods -n {{inputs.parameters.namespace}} \
                -l app={{inputs.parameters.deployment-name}} \
                -o wide
              exit 1
            fi

            # Check for recent restarts
            RESTARTS=$(kubectl get pods -n {{inputs.parameters.namespace}} \
              -l app={{inputs.parameters.deployment-name}} \
              -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}' | \
              tr ' ' '\n' | awk '{sum+=$1} END {print sum}')

            echo "Total restarts: $RESTARTS"

            echo "Deployment healthy!"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
```

### 3. CI Pipeline (Composite)

`workflow-templates/composite/ci-pipeline.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: ci-pipeline
  namespace: argo
  labels:
    app.kubernetes.io/name: ci-pipeline
    app.kubernetes.io/component: ci-cd
  annotations:
    workflows.argoproj.io/description: |
      Complete CI pipeline: clone → build → test → scan → push → deploy
spec:
  entrypoint: pipeline

  # ===========================================
  # Input Parameters
  # ===========================================
  arguments:
    parameters:
      # Source
      - name: git-repo
        description: "Git repository URL"
      - name: git-branch
        default: "main"
        description: "Git branch"
      - name: git-revision
        default: "HEAD"
        description: "Git revision"

      # Build
      - name: dockerfile-path
        default: "Dockerfile"
        description: "Dockerfile path"
      - name: docker-context
        default: "."
        description: "Docker context"

      # Image
      - name: image-name
        description: "Image name (without registry)"
      - name: ecr-registry
        description: "ECR registry URL"

      # Deploy
      - name: deployment-name
        description: "Kubernetes deployment name"
      - name: deploy-namespace
        default: "default"
        description: "Target namespace"
        enum:
          - default
          - staging
          - production

      # Options
      - name: run-tests
        default: "true"
        description: "Run tests before build"
        enum:
          - "true"
          - "false"
      - name: deploy-enabled
        default: "true"
        description: "Deploy after successful build"
        enum:
          - "true"
          - "false"
      - name: notify-slack
        default: "true"
        description: "Send Slack notifications"
        enum:
          - "true"
          - "false"

  # ===========================================
  # Volumes
  # ===========================================
  volumeClaimTemplates:
    - metadata:
        name: workspace
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi
        storageClassName: gp3

  # ===========================================
  # Templates
  # ===========================================
  templates:
    - name: pipeline
      dag:
        tasks:
          # Clone repository
          - name: clone
            template: git-clone
            arguments:
              parameters:
                - name: repo
                  value: "{{workflow.parameters.git-repo}}"
                - name: branch
                  value: "{{workflow.parameters.git-branch}}"
                - name: revision
                  value: "{{workflow.parameters.git-revision}}"

          # Run tests (optional)
          - name: test
            templateRef:
              name: run-tests
              template: run
            when: "{{workflow.parameters.run-tests}} == true"
            dependencies: [clone]

          # Build image
          - name: build
            templateRef:
              name: build-docker-image
              template: build-and-push
            dependencies: [clone, test]
            arguments:
              parameters:
                - name: git-repo
                  value: "{{workflow.parameters.git-repo}}"
                - name: git-branch
                  value: "{{workflow.parameters.git-branch}}"
                - name: dockerfile-path
                  value: "{{workflow.parameters.dockerfile-path}}"
                - name: docker-context
                  value: "{{workflow.parameters.docker-context}}"
                - name: image-name
                  value: "{{workflow.parameters.image-name}}"
                - name: image-tag
                  value: "{{workflow.name}}"  # Use workflow name as tag
                - name: ecr-registry
                  value: "{{workflow.parameters.ecr-registry}}"

          # Deploy (optional)
          - name: deploy
            templateRef:
              name: deploy-kubernetes
              template: deploy
            when: "{{workflow.parameters.deploy-enabled}} == true"
            dependencies: [build]
            arguments:
              parameters:
                - name: deployment-name
                  value: "{{workflow.parameters.deployment-name}}"
                - name: namespace
                  value: "{{workflow.parameters.deploy-namespace}}"
                - name: image
                  value: "{{workflow.parameters.ecr-registry}}/{{workflow.parameters.image-name}}:{{workflow.name}}"

          # Notify on success
          - name: notify-success
            template: slack-notify
            when: "{{workflow.parameters.notify-slack}} == true"
            dependencies: [deploy]
            arguments:
              parameters:
                - name: status
                  value: "success"
                - name: message
                  value: "Pipeline completed successfully"

    # Exit handler for failures
    - name: exit-handler
      steps:
        - - name: notify-failure
            template: slack-notify
            when: "{{workflow.status}} != Succeeded && {{workflow.parameters.notify-slack}} == true"
            arguments:
              parameters:
                - name: status
                  value: "failure"
                - name: message
                  value: "Pipeline failed: {{workflow.failures}}"

    # Git clone template
    - name: git-clone
      inputs:
        parameters:
          - name: repo
          - name: branch
          - name: revision
      container:
        image: alpine/git:2.43.0
        command: [sh, -c]
        args:
          - |
            git clone --depth 1 -b {{inputs.parameters.branch}} \
              {{inputs.parameters.repo}} /workspace/source
        volumeMounts:
          - name: workspace
            mountPath: /workspace
        resources:
          requests:
            cpu: 100m
            memory: 256Mi

    # Slack notification template
    - name: slack-notify
      inputs:
        parameters:
          - name: status
          - name: message
      container:
        image: curlimages/curl:8.5.0
        command: [sh, -c]
        args:
          - |
            curl -X POST $SLACK_WEBHOOK_URL \
              -H 'Content-Type: application/json' \
              -d "{\"text\": \"[{{inputs.parameters.status}}] {{inputs.parameters.message}}\"}"
        env:
          - name: SLACK_WEBHOOK_URL
            valueFrom:
              secretKeyRef:
                name: slack-webhook
                key: url
                optional: true
        resources:
          requests:
            cpu: 10m
            memory: 32Mi

  # Exit handler
  onExit: exit-handler
```

## Backstage Integration

### 1. Plugin Installation

Add to `backstage-ext/packages/app/package.json`:

```json
{
  "dependencies": {
    "@backstage-community/plugin-argo-workflows": "^0.1.0"
  }
}
```

### 2. App Configuration

Add to `backstage-ext/app-config.yaml`:

```yaml
argoWorkflows:
  baseUrl: https://argo.${DOMAIN_NAME}
  # Token for API access (optional, can use user's token)
  token: ${ARGO_SERVER_TOKEN}
```

### 3. EntityPage Integration

Update `backstage-ext/packages/app/src/components/catalog/EntityPage.tsx`:

```tsx
import {
  EntityArgoWorkflowsContent,
  isArgoWorkflowsAvailable,
} from '@backstage-community/plugin-argo-workflows';

const cicdContent = (
  <EntitySwitch>
    <EntitySwitch.Case if={isArgoWorkflowsAvailable}>
      <EntityArgoWorkflowsContent />
    </EntitySwitch.Case>
    <EntitySwitch.Case>
      <EmptyState
        title="No CI/CD available for this entity"
        missing="info"
        description="Add argo-workflows.io/workflow-templates annotation to enable CI/CD."
        action={
          <Button
            variant="contained"
            color="primary"
            href="https://backstage.io/docs/features/software-catalog/well-known-annotations"
          >
            Read more
          </Button>
        }
      />
    </EntitySwitch.Case>
  </EntitySwitch>
);
```

### 4. Catalog Entity Annotation

Update component's `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    github.com/project-slug: org/my-service
    # Argo Workflows integration
    argo-workflows.io/workflow-templates: build-docker-image,deploy-kubernetes,ci-pipeline
    argo-workflows.io/namespace: argo
spec:
  type: service
  lifecycle: production
  owner: user:default/stxkxs
```

## Security Considerations

### 1. RBAC Configuration

Create namespace-scoped roles for workflows:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: workflow-executor
  namespace: argo
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]
  - apiGroups: ["argoproj.io"]
    resources: ["workflows", "workflowtemplates"]
    verbs: ["get", "list", "watch", "create"]
```

### 2. Network Policies

Restrict workflow pod network access:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: workflow-egress
  namespace: argo
spec:
  podSelector:
    matchLabels:
      workflows.argoproj.io/workflow: "*"
  policyTypes:
    - Egress
  egress:
    # Allow ECR
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - port: 443
          protocol: TCP
    # Allow S3
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - port: 443
          protocol: TCP
    # Deny all other egress
```

### 3. Pod Security Standards

Apply restricted security context:

```yaml
workflowDefaults:
  spec:
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      fsGroup: 1000
      seccompProfile:
        type: RuntimeDefault
    podSecurityContext:
      runAsNonRoot: true
```

## Monitoring & Observability

### Prometheus Metrics

Argo Workflows exposes metrics at `/metrics`:

- `argo_workflows_count` - Total workflows by status
- `argo_workflows_pods_count` - Pods by phase
- `argo_workflow_operation_duration_seconds` - Operation latency

### Grafana Dashboard

Import Argo Workflows dashboard (ID: 13927) or create custom:

```json
{
  "title": "Argo Workflows",
  "panels": [
    {
      "title": "Workflows by Status",
      "targets": [
        {
          "expr": "sum(argo_workflows_count) by (status)"
        }
      ]
    },
    {
      "title": "Workflow Duration P95",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(argo_workflow_operation_duration_seconds_bucket[5m]))"
        }
      ]
    }
  ]
}
```

## Implementation Order

1. **Phase 1: Infrastructure**
   - Create aws-argo-infra project from template
   - Implement ArgoStorageStack (S3 bucket)
   - Implement ArgoIamStack (IRSA roles)
   - Deploy ArgoWorkflowsStack via Helm

2. **Phase 2: Workflow Templates**
   - Create build-docker-image template
   - Create deploy-kubernetes template
   - Create ci-pipeline composite template
   - Test workflows manually via Argo UI

3. **Phase 3: Backstage Integration**
   - Install @backstage-community/plugin-argo-workflows
   - Configure app-config.yaml
   - Update EntityPage.tsx
   - Add annotations to catalog entities

4. **Phase 4: Security & Monitoring**
   - Configure RBAC policies
   - Apply network policies
   - Set up Prometheus metrics
   - Create Grafana dashboards

## Dependencies

- `aws-eks-infra` - EKS cluster with OIDC provider
- `aws-backstage-infra` - Backstage deployment
- `cdk-common` - Shared CDK constructs (HelmChartDeployer, etc.)

## References

- [Argo Workflows Documentation](https://argoproj.github.io/argo-workflows/)
- [Argo Helm Charts](https://github.com/argoproj/argo-helm)
- [Backstage Argo Workflows Plugin](https://github.com/backstage/community-plugins/tree/main/workspaces/argo-workflows)
- [IRSA Documentation](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
