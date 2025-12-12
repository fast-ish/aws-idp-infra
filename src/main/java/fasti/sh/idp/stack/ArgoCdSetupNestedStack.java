package fasti.sh.idp.stack;

import fasti.sh.execute.aws.eks.NamespaceConstruct;
import fasti.sh.execute.aws.eks.ServiceAccountConstruct;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.constructs.Construct;

/**
 * Nested stack for ArgoCD infrastructure setup.
 *
 * <p>Creates resources required by ArgoCD:
 * <ul>
 *   <li>Kubernetes namespace</li>
 *   <li>IRSA-enabled service account for repo server</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoCdSetupNestedStack extends NestedStack {
  private final NamespaceConstruct namespace;
  private final ServiceAccountConstruct serviceAccount;

  /**
   * Creates the ArgoCD setup nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param cluster EKS cluster for namespace and service account creation
   * @param props   nested stack properties
   */
  @SneakyThrows
  public ArgoCdSetupNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    NestedStackProps props
  ) {
    super(scope, "argocd-setup", props);

    log.debug("{} [common: {} conf: {}]", "ArgoCdSetupNestedStack", common, conf);

    var addons = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class);

    this.namespace = new NamespaceConstruct(
      this,
      common,
      addons.argocd().serviceAccount().metadata(),
      cluster);

    this.serviceAccount = new ServiceAccountConstruct(this, common, addons.argocd().serviceAccount(), cluster);
    this.serviceAccount.getNode().addDependency(this.namespace);
  }
}
