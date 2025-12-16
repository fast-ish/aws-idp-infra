package fasti.sh.idp.stack;

import fasti.sh.execute.aws.eks.NamespaceConstruct;
import fasti.sh.execute.aws.eks.ServiceAccountConstruct;
import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.constructs.Construct;

/**
 * Nested stack for Argo Rollouts infrastructure setup.
 *
 * <p>
 * Creates resources required by Argo Rollouts:
 * <ul>
 * <li>Kubernetes namespace</li>
 * <li>IRSA-enabled service account for controller</li>
 * <li>IRSA-enabled service account for dashboard</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoRolloutsSetupNestedStack extends NestedStack {
  private final NamespaceConstruct namespace;
  private final ServiceAccountConstruct controllerServiceAccount;
  private final ServiceAccountConstruct dashboardServiceAccount;

  /**
   * Creates the Argo Rollouts setup nested stack.
   *
   * @param scope
   *          the parent construct
   * @param common
   *          shared deployment metadata
   * @param conf
   *          IDP release configuration
   * @param cluster
   *          EKS cluster for namespace and service account creation
   * @param props
   *          nested stack properties
   */
  public ArgoRolloutsSetupNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    NestedStackProps props) {
    super(scope, "argo-rollouts-setup", props);

    log.debug("{} [common: {} conf: {}]", "ArgoRolloutsSetupNestedStack", common, conf);

    var addons = TemplateUtils.parseAs(scope, conf.eks().addons(), AddonsConf.class);

    this.namespace = new NamespaceConstruct(
      this,
      common,
      addons.argoRollouts().controllerServiceAccount().metadata(),
      cluster);

    this.controllerServiceAccount = new ServiceAccountConstruct(
      this,
      common,
      addons.argoRollouts().controllerServiceAccount(),
      cluster);
    this.controllerServiceAccount.getNode().addDependency(this.namespace);

    this.dashboardServiceAccount = new ServiceAccountConstruct(
      this,
      common,
      addons.argoRollouts().dashboardServiceAccount(),
      cluster);
    this.dashboardServiceAccount.getNode().addDependency(this.namespace);
  }
}
