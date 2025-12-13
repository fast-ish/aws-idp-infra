package fasti.sh.idp.model;

import fasti.sh.model.aws.eks.KubernetesConf;
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
 * @param certificate
 *          acm certificate configuration to enable tls for idp public-facing workloads
 */
public record IdpReleaseConf(
  Common common,
  NetworkConf vpc,
  KubernetesConf eks,
  String certificate
) {}
