# Plan 10: Disaster Recovery

## Objective
Implement backup strategy, document RTO/RPO targets, and create recovery procedures.

## Context
- No backup solution currently deployed
- Critical data: ArgoCD state, secrets, persistent volumes
- Need to define recovery objectives per component

## RTO/RPO Targets

| Component | RPO | RTO | Backup Method |
|-----------|-----|-----|---------------|
| EKS Cluster | N/A | 4h | Recreate via CDK |
| ArgoCD Config | 0 | 30m | GitOps (source of truth) |
| Secrets | 1h | 15m | AWS Secrets Manager (native) |
| PVCs (stateful apps) | 1h | 2h | Velero + EBS snapshots |
| Databases (Aurora) | 5m | 1h | Aurora automated backups |
| GitOps Repo | 0 | 5m | GitHub (source of truth) |

**Definitions:**
- **RPO (Recovery Point Objective):** Maximum acceptable data loss
- **RTO (Recovery Time Objective):** Maximum acceptable downtime

## Part 1: Velero for Kubernetes Backup

### Install Velero

#### Add to aws-idp-gitops
```yaml
# platform/velero/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: velero

resources:
  - namespace.yaml

helmCharts:
  - name: velero
    repo: https://vmware-tanzu.github.io/helm-charts
    version: 6.0.0
    releaseName: velero
    namespace: velero
    valuesFile: values.yaml
```

#### values.yaml
```yaml
initContainers:
  - name: velero-plugin-for-aws
    image: velero/velero-plugin-for-aws:v1.9.0
    volumeMounts:
      - mountPath: /target
        name: plugins

configuration:
  backupStorageLocation:
    - name: default
      provider: aws
      bucket: {{deployment:id}}-velero-backups
      config:
        region: {{deployment:region}}

  volumeSnapshotLocation:
    - name: default
      provider: aws
      config:
        region: {{deployment:region}}

  defaultBackupStorageLocation: default
  defaultVolumeSnapshotLocations: aws:default

credentials:
  useSecret: false  # Use IRSA

serviceAccount:
  server:
    create: false
    name: velero

schedules:
  daily-backup:
    disabled: false
    schedule: "0 2 * * *"  # 2am daily
    template:
      ttl: 720h  # 30 days retention
      includedNamespaces:
        - argocd
        - argo
        - backstage
        - velero
      excludedResources:
        - events
        - pods
      snapshotVolumes: true

  weekly-full:
    disabled: false
    schedule: "0 3 * * 0"  # 3am Sunday
    template:
      ttl: 2160h  # 90 days retention
      includeClusterResources: true
      snapshotVolumes: true

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

nodeSelector:
  eks.amazonaws.com/nodegroup: {{deployment:id}}-core-node
```

### Add to CDK (aws-idp-infra)

#### S3 Bucket for Backups
```typescript
const veleroBucket = new s3.Bucket(this, 'VeleroBackupsBucket', {
  bucketName: `${deploymentId}-velero-backups`,
  encryption: s3.BucketEncryption.S3_MANAGED,
  versioned: true,
  lifecycleRules: [
    {
      id: 'delete-old-backups',
      expiration: cdk.Duration.days(90),
      noncurrentVersionExpiration: cdk.Duration.days(30),
    },
  ],
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
});
```

#### ServiceAccount with IRSA
```typescript
const veleroServiceAccount = new ServiceAccount(this, 'VeleroServiceAccount', {
  metadata: {
    name: 'velero',
    namespace: 'velero',
  },
  role: {
    name: `${deploymentId}-velero-sa`,
    managedPolicyNames: [],
    customPolicies: [{
      name: `${deploymentId}-velero`,
      policy: 'policy/velero.mustache',
      mappings: {
        bucket: `${deploymentId}-velero-backups`,
      },
    }],
  },
});
```

#### IAM Policy (policy/velero.mustache)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVolumes",
        "ec2:DescribeSnapshots",
        "ec2:CreateTags",
        "ec2:CreateVolume",
        "ec2:CreateSnapshot",
        "ec2:DeleteSnapshot"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::{{bucket}}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::{{bucket}}"
    }
  ]
}
```

## Part 2: Backup Procedures

### Manual Backup
```bash
# Create on-demand backup
velero backup create manual-backup-$(date +%Y%m%d) \
  --include-namespaces argocd,argo,backstage \
  --snapshot-volumes

# Check backup status
velero backup describe manual-backup-20241207

# List all backups
velero backup get
```

### Pre-Upgrade Backup
```bash
# Before any cluster upgrade
velero backup create pre-upgrade-$(date +%Y%m%d-%H%M) \
  --include-cluster-resources \
  --snapshot-volumes \
  --wait

# Verify backup completed
velero backup describe pre-upgrade-* --details
```

## Part 3: Recovery Procedures

### Scenario 1: Restore Single Namespace
```bash
# Restore ArgoCD namespace from latest backup
velero restore create argocd-restore \
  --from-backup daily-backup-20241207 \
  --include-namespaces argocd \
  --restore-volumes

# Monitor restore
velero restore describe argocd-restore
velero restore logs argocd-restore
```

### Scenario 2: Restore Specific Resources
```bash
# Restore only ConfigMaps and Secrets from backstage
velero restore create backstage-config-restore \
  --from-backup daily-backup-20241207 \
  --include-namespaces backstage \
  --include-resources configmaps,secrets
```

### Scenario 3: Full Cluster Recovery
```bash
# 1. Recreate cluster via CDK
cd aws-idp-infra
cdk deploy --all

# 2. Install Velero (bootstrap)
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --set-file credentials.secretContents.cloud=./velero-credentials \
  --set configuration.backupStorageLocation[0].bucket=${BUCKET} \
  --set configuration.backupStorageLocation[0].config.region=${REGION}

# 3. Restore from backup
velero restore create full-restore \
  --from-backup weekly-full-20241201 \
  --include-cluster-resources

# 4. Wait for ArgoCD to sync remaining resources
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s
```

### Scenario 4: Cross-Region Recovery
```bash
# 1. Copy S3 backup to new region
aws s3 sync s3://${BUCKET} s3://${NEW_REGION_BUCKET} --source-region us-west-2 --region us-east-1

# 2. Deploy cluster in new region
cdk deploy --all --context region=us-east-1

# 3. Configure Velero to use new bucket
# 4. Restore from backup
```

## Part 4: Secrets Backup Strategy

AWS Secrets Manager handles its own backup, but ensure:

### Cross-Region Replication
```typescript
// In CDK
const secret = new secretsmanager.Secret(this, 'MySecret', {
  replicaRegions: [{
    region: 'us-east-1',
  }],
});
```

### Secret Rotation
Ensure rotation is configured for critical secrets:
```bash
aws secretsmanager rotate-secret \
  --secret-id ${SECRET_ID} \
  --rotation-lambda-arn ${ROTATION_LAMBDA_ARN} \
  --rotation-rules AutomaticallyAfterDays=30
```

## Part 5: Aurora Backup Strategy

Aurora handles automated backups, but verify:

### Backup Configuration
```typescript
const cluster = new rds.DatabaseCluster(this, 'Database', {
  // ...
  backup: {
    retention: cdk.Duration.days(30),
    preferredWindow: '03:00-04:00',
  },
  deletionProtection: true,
});
```

### Point-in-Time Recovery Test
```bash
# Test PITR capability
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier production-cluster \
  --db-cluster-identifier test-pitr-$(date +%Y%m%d) \
  --restore-to-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --vpc-security-group-ids ${SG_ID} \
  --db-subnet-group-name ${SUBNET_GROUP}
```

## Part 6: Disaster Recovery Testing

### Monthly DR Test Checklist
- [ ] Verify Velero backups are completing
- [ ] Test restore of single namespace to staging
- [ ] Verify secrets can be accessed from replica region
- [ ] Test Aurora PITR to test cluster
- [ ] Document any issues found
- [ ] Update runbooks if needed

### Quarterly Full DR Test
- [ ] Spin up full cluster in DR region
- [ ] Restore from Velero backup
- [ ] Restore Aurora from snapshot
- [ ] Verify all services functional
- [ ] Measure actual RTO
- [ ] Document gaps vs targets
- [ ] Destroy DR environment

### DR Test Automation (Argo Workflow)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: monthly-dr-test
  namespace: argo
spec:
  schedule: "0 4 1 * *"  # 1st of month, 4am
  workflowSpec:
    entrypoint: dr-test
    templates:
      - name: dr-test
        steps:
          - - name: create-backup
              template: velero-backup
          - - name: test-restore
              template: velero-restore-test
          - - name: verify
              template: verify-restore
          - - name: cleanup
              template: cleanup-test
          - - name: report
              template: send-report
```

## Implementation Checklist

### Velero Setup
- [ ] Create S3 bucket for backups
- [ ] Create Velero IAM role
- [ ] Add Velero to GitOps
- [ ] Configure backup schedules
- [ ] Test manual backup/restore

### Documentation
- [ ] Document RTO/RPO targets
- [ ] Create recovery runbooks
- [ ] Document backup verification steps
- [ ] Create DR test procedures

### Testing
- [ ] Perform initial DR test
- [ ] Schedule monthly DR tests
- [ ] Create DR test automation
- [ ] Document test results

### Monitoring
- [ ] Alert on backup failures
- [ ] Alert on backup age > 48h
- [ ] Dashboard for backup status

## Success Criteria
- [ ] Velero deployed and taking daily backups
- [ ] All namespaces backed up successfully
- [ ] Restore tested and documented
- [ ] RTO/RPO targets documented and achievable
- [ ] DR test automation in place
- [ ] Alerts configured for backup failures

## Notes
- Velero doesn't backup etcd; cluster state from GitOps
- PVC snapshots require CSI driver support
- Test restores regularly - backups are useless if untested
- Consider disaster recovery as a service (DRaaS) for critical workloads
- Document dependencies between components for recovery order
