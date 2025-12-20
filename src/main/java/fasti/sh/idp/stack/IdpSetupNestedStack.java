package fasti.sh.idp.stack;

import fasti.sh.execute.aws.acm.AcmCertificateConstruct;
import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.acm.AcmCertificate;
import fasti.sh.model.main.Common;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.eks.Cluster;
import software.constructs.Construct;

/**
 * Nested stack for shared IDP infrastructure setup.
 *
 * <p>
 * Orchestrates component-specific setup stacks:
 * <ul>
 * <li>ACM certificate for TLS (shared across all components)</li>
 * <li>BackstageSetupNestedStack - RDS database</li>
 * <li>ArgoWorkflowsSetupNestedStack - RDS database, S3 bucket, team namespaces</li>
 * </ul>
 *
 * <p>
 * This stack must be deployed before the component stacks.
 */
@Slf4j
@Getter
public class IdpSetupNestedStack extends NestedStack {
  private final AcmCertificateConstruct certificate;
  private final BackstageSetupNestedStack backstage;
  private final ArgoWorkflowsSetupNestedStack argoWorkflows;

  /**
   * Creates the IDP setup nested stack.
   *
   * @param scope
   *          the parent construct
   * @param common
   *          shared deployment metadata
   * @param conf
   *          IDP release configuration
   * @param vpc
   *          VPC for database placement
   * @param cluster
   *          EKS cluster for namespace creation
   * @param props
   *          nested stack properties
   */
  public IdpSetupNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Vpc vpc,
    Cluster cluster,
    NestedStackProps props) {
    super(scope, "idp-setup", props);

    log.debug("{} [common: {} conf: {}]", "IdpSetupNestedStack", common, conf);

    var certificateConf = TemplateUtils.parseAs(scope, conf.certificate(), AcmCertificate.class);

    this.certificate = new AcmCertificateConstruct(this, common, certificateConf);

    this.backstage = new BackstageSetupNestedStack(
      this,
      common,
      conf,
      vpc,
      cluster,
      NestedStackProps.builder().build());

    this.argoWorkflows = new ArgoWorkflowsSetupNestedStack(
      this,
      common,
      conf,
      vpc,
      cluster,
      NestedStackProps.builder().build());
  }
}
