package fasti.sh.idp.stack;

import fasti.sh.model.aws.acm.AcmCertificate;
import fasti.sh.model.aws.ecr.DockerImage;
import fasti.sh.model.aws.eks.HelmChart;
import fasti.sh.model.aws.eks.KubernetesConf;
import fasti.sh.model.aws.eks.ServiceAccountConf;
import fasti.sh.model.aws.rds.Rds;
import fasti.sh.model.aws.secretsmanager.SecretCredentials;
import fasti.sh.model.aws.vpc.NetworkConf;
import fasti.sh.model.main.Common;

/**
 * Configuration record for IDP deployment.
 *
 * @param common
 *          shared deployment metadata
 * @param vpc
 *          VPC configuration for the deployment
 * @param eks
 *          EKS cluster configuration
 * @param database
 *          RDS PostgreSQL database configuration
 * @param githubOAuth
 *          GitHub OAuth credentials for authentication
 * @param serviceAccount
 *          Service account configuration for Backstage pods
 * @param certificate
 *          ACM certificate for HTTPS/TLS
 * @param dockerImage
 *          Docker image configuration for Backstage
 * @param helm
 *          Helm chart configuration for Backstage deployment
 */
public record IdpReleaseConf(
  Common common,
  NetworkConf vpc,
  KubernetesConf eks,
  Rds database,
  SecretCredentials githubOAuth,
  ServiceAccountConf serviceAccount,
  AcmCertificate certificate,
  DockerImage dockerImage,
  HelmChart helm
) {}
