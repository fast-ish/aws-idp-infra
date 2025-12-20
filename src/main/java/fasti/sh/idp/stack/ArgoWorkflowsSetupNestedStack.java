package fasti.sh.idp.stack;

import fasti.sh.execute.aws.eks.NamespaceConstruct;
import fasti.sh.execute.aws.rds.RdsConstruct;
import fasti.sh.execute.aws.s3.BucketConstruct;
import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.aws.eks.addon.argo.ArgoWorkflowSetup;
import fasti.sh.model.main.Common;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.eks.Cluster;
import software.constructs.Construct;

/**
 * Nested stack for Argo Workflows infrastructure setup.
 *
 * <p>
 * Creates infrastructure resources required by Argo Workflows:
 * <ul>
 * <li>Kubernetes namespace for Argo Workflows</li>
 * <li>Team workflow namespaces</li>
 * <li>S3 bucket for artifact storage</li>
 * <li>RDS PostgreSQL database for workflow archive</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoWorkflowsSetupNestedStack extends NestedStack {
  private final NamespaceConstruct namespace;
  private final BucketConstruct artifactsBucket;
  private final RdsConstruct database;
  private final Map<String, NamespaceConstruct> teamNamespaces;

  /**
   * Creates the Argo Workflows setup nested stack.
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
  public ArgoWorkflowsSetupNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Vpc vpc,
    Cluster cluster,
    NestedStackProps props) {
    super(scope, "argo-workflows-setup", props);

    log.debug("{} [common: {} conf: {}]", "ArgoWorkflowsSetupNestedStack", common, conf);

    var addons = TemplateUtils.parseAs(scope, conf.eks().addons(), AddonsConf.class);
    var argoWorkflowsSetup = TemplateUtils.parseAs(scope, addons.argoWorkflows().setup(), ArgoWorkflowSetup.class);

    // Create main namespace using metadata from serverPodIdentity
    this.namespace = new NamespaceConstruct(
      this,
      common,
      argoWorkflowsSetup.serverPodIdentity().metadata(),
      cluster);

    this.artifactsBucket = new BucketConstruct(scope, common, argoWorkflowsSetup.artifactBucket());

    this.database = new RdsConstruct(
      this,
      common,
      argoWorkflowsSetup.database(),
      vpc,
      List.of(cluster.getClusterSecurityGroup()));

    this.teamNamespaces = new HashMap<>();
    argoWorkflowsSetup.workflowNamespaces().forEach(ns -> {
      var metadata = new ObjectMetaBuilder()
        .withName(ns)
        .withNamespace(ns)
        .withLabels(argoWorkflowsSetup.labels())
        .withAnnotations(argoWorkflowsSetup.annotations())
        .build();

      var team = new NamespaceConstruct(this, common, metadata, cluster);
      team.getNode().addDependency(this.namespace);

      this.teamNamespaces.put(ns, team);
    });
  }
}
