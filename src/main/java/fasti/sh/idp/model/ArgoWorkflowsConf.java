package fasti.sh.idp.model;

import fasti.sh.model.aws.rds.Rds;
import fasti.sh.model.aws.s3.S3Bucket;

/**
 * Configuration for Argo Workflows.
 *
 * @param database RDS database configuration for Argo Workflows
 * @param bucket   S3 bucket configuration for Argo artifacts
 */
public record ArgoWorkflowsConf(
  Rds database,
  S3Bucket bucket
) {}
