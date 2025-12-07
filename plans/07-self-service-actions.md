# Plan 07: Developer Self-Service Actions

## Objective
Create Backstage scaffolder actions for provisioning AWS resources (databases, caches, queues, secrets).

## Context
- Backstage scaffolder is configured with GitHub integration
- Teams need self-service for common infrastructure
- Resources should be provisioned via GitOps (not direct AWS API)
- CDK or Crossplane for actual resource creation

## Architecture Options

### Option A: GitOps + Crossplane (Recommended)
```
Backstage Action → Creates PR with Crossplane manifest → ArgoCD syncs → Crossplane provisions AWS resource
```

### Option B: GitOps + CDK
```
Backstage Action → Creates PR with CDK config → CI runs cdk deploy → Resource created
```

### Option C: Direct AWS (Not recommended)
```
Backstage Action → AWS SDK → Resource created
```

**Recommendation:** Option A with Crossplane for Kubernetes-native IaC

## Resources to Support

### 1. Aurora Database
- PostgreSQL or MySQL
- Serverless v2 or Provisioned
- Team-scoped (VPC security group)

### 2. DynamoDB Table
- On-demand or provisioned capacity
- GSI/LSI configuration
- TTL settings

### 3. ElastiCache Redis
- Cluster mode or single node
- Encryption at rest/transit
- Team-scoped security group

### 4. SQS Queue
- Standard or FIFO
- Dead letter queue
- Encryption

### 5. SNS Topic
- Standard or FIFO
- Subscriptions (SQS, Lambda, Email)

### 6. AWS Secret
- Secrets Manager secret
- Initial value or generated
- Rotation configuration

## Implementation

### Step 1: Install Crossplane
Add to aws-idp-gitops:
```yaml
# platform/crossplane/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

helmCharts:
  - name: crossplane
    repo: https://charts.crossplane.io/stable
    version: 1.15.0
    releaseName: crossplane
    namespace: crossplane-system
    valuesFile: values.yaml

resources:
  - namespace.yaml
  - aws-provider.yaml
  - provider-config.yaml
```

### Step 2: Create Crossplane Compositions

#### Aurora PostgreSQL Composition
```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: aurora-postgresql
spec:
  compositeTypeRef:
    apiVersion: database.platform.fasti.sh/v1alpha1
    kind: PostgreSQLInstance
  resources:
    - name: cluster
      base:
        apiVersion: rds.aws.crossplane.io/v1alpha1
        kind: DBCluster
        spec:
          forProvider:
            engine: aurora-postgresql
            engineVersion: "15.4"
            serverlessV2ScalingConfiguration:
              minCapacity: 0.5
              maxCapacity: 16
            masterUsername: admin
            masterUserPasswordSecretRef:
              name: ""  # patched
              namespace: ""  # patched
              key: password
            vpcSecurityGroupIds: []  # patched
            dbSubnetGroupName: ""  # patched
      patches:
        - fromFieldPath: spec.teamNamespace
          toFieldPath: spec.forProvider.masterUserPasswordSecretRef.namespace
        # ... more patches
```

#### DynamoDB Composition
```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: dynamodb-table
spec:
  compositeTypeRef:
    apiVersion: database.platform.fasti.sh/v1alpha1
    kind: DynamoDBTable
  resources:
    - name: table
      base:
        apiVersion: dynamodb.aws.crossplane.io/v1alpha1
        kind: Table
        spec:
          forProvider:
            region: us-west-2
            billingMode: PAY_PER_REQUEST
            attributeDefinitions: []  # patched
            keySchema: []  # patched
            sseSpecification:
              enabled: true
              sseType: KMS
```

### Step 3: Create Backstage Scaffolder Actions

#### Custom Action: Create Database
```typescript
// packages/backend/src/scaffolder/actions/createDatabase.ts
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { Octokit } from '@octokit/rest';

export const createDatabaseAction = createTemplateAction<{
  name: string;
  type: 'aurora-postgresql' | 'aurora-mysql' | 'dynamodb';
  team: string;
  environment: string;
}>({
  id: 'platform:create-database',
  description: 'Creates a database via GitOps',
  schema: {
    input: {
      required: ['name', 'type', 'team'],
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Database name' },
        type: { type: 'string', enum: ['aurora-postgresql', 'aurora-mysql', 'dynamodb'] },
        team: { type: 'string', description: 'Owning team' },
        environment: { type: 'string', default: 'production' },
      },
    },
  },
  async handler(ctx) {
    const { name, type, team, environment } = ctx.input;

    // Generate Crossplane claim YAML
    const claim = generateDatabaseClaim({ name, type, team, environment });

    // Create PR to aws-idp-gitops
    const octokit = new Octokit({ auth: ctx.secrets.githubToken });

    // Create branch
    const branchName = `create-db-${name}-${Date.now()}`;
    // ... create file and PR

    ctx.output('prUrl', prUrl);
    ctx.output('claimName', `${name}-${type}`);
  },
});
```

### Step 4: Create Scaffolder Templates

#### Database Provisioning Template
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: provision-database
  title: Provision Database
  description: Create an Aurora or DynamoDB database for your service
  tags:
    - database
    - aurora
    - dynamodb
    - infrastructure
spec:
  owner: platform
  type: infrastructure

  parameters:
    - title: Database Configuration
      required:
        - name
        - type
        - team
      properties:
        name:
          title: Database Name
          type: string
          pattern: '^[a-z][a-z0-9-]*$'
        type:
          title: Database Type
          type: string
          enum:
            - aurora-postgresql
            - aurora-mysql
            - dynamodb
          enumNames:
            - Aurora PostgreSQL (Serverless v2)
            - Aurora MySQL (Serverless v2)
            - DynamoDB (On-demand)
        team:
          title: Owning Team
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group

    - title: Aurora Options
      dependencies:
        type:
          oneOf:
            - properties:
                type:
                  const: aurora-postgresql
            - properties:
                type:
                  const: aurora-mysql
      properties:
        minCapacity:
          title: Min ACU
          type: number
          default: 0.5
          enum: [0.5, 1, 2, 4, 8]
        maxCapacity:
          title: Max ACU
          type: number
          default: 16
          enum: [2, 4, 8, 16, 32, 64]

    - title: DynamoDB Options
      dependencies:
        type:
          oneOf:
            - properties:
                type:
                  const: dynamodb
      properties:
        partitionKey:
          title: Partition Key
          type: string
          default: id
        sortKey:
          title: Sort Key (optional)
          type: string
        ttlAttribute:
          title: TTL Attribute (optional)
          type: string

  steps:
    - id: create-database
      name: Create Database
      action: platform:create-database
      input:
        name: ${{ parameters.name }}
        type: ${{ parameters.type }}
        team: ${{ parameters.team }}
        minCapacity: ${{ parameters.minCapacity }}
        maxCapacity: ${{ parameters.maxCapacity }}
        partitionKey: ${{ parameters.partitionKey }}
        sortKey: ${{ parameters.sortKey }}

    - id: create-secret
      name: Create Connection Secret
      action: platform:create-external-secret
      input:
        name: ${{ parameters.name }}-db
        namespace: team-${{ parameters.team }}
        secretPath: ${{ parameters.team }}/${{ parameters.name }}/database

  output:
    links:
      - title: Pull Request
        url: ${{ steps['create-database'].output.prUrl }}
      - title: View in Catalog
        icon: catalog
        entityRef: resource:default/${{ parameters.name }}-database
```

### Step 5: Additional Templates

Create similar templates for:
- `provision-cache.yaml` - ElastiCache Redis
- `provision-queue.yaml` - SQS Queue
- `provision-topic.yaml` - SNS Topic
- `provision-secret.yaml` - AWS Secret

## Directory Structure

```
backstage-ext/
├── packages/
│   └── backend/
│       └── src/
│           └── scaffolder/
│               └── actions/
│                   ├── index.ts
│                   ├── createDatabase.ts
│                   ├── createCache.ts
│                   ├── createQueue.ts
│                   └── createSecret.ts
└── templates/
    ├── provision-database/
    │   └── template.yaml
    ├── provision-cache/
    │   └── template.yaml
    ├── provision-queue/
    │   └── template.yaml
    └── provision-secret/
        └── template.yaml

aws-idp-gitops/
└── platform/
    └── crossplane/
        ├── kustomization.yaml
        ├── namespace.yaml
        ├── aws-provider.yaml
        ├── provider-config.yaml
        └── compositions/
            ├── aurora-postgresql.yaml
            ├── aurora-mysql.yaml
            ├── dynamodb.yaml
            ├── elasticache-redis.yaml
            ├── sqs-queue.yaml
            └── sns-topic.yaml
```

## Success Criteria
- [ ] Crossplane deployed and AWS provider configured
- [ ] Compositions for each resource type
- [ ] Backstage actions registered
- [ ] Templates available in Backstage
- [ ] End-to-end test: create database via Backstage
- [ ] Resources appear in Backstage catalog

## Notes
- Consider AWS Service Catalog as alternative to Crossplane
- Implement resource quotas per team
- Add cost estimation in template UI
- Require approval for expensive resources
- Auto-delete resources in non-prod environments
