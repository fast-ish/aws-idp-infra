package fasti.sh.idp.stack;

import com.fasterxml.jackson.core.type.TypeReference;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.aws.eks.addon.argo.ArgoWorkflowSetup;
import fasti.sh.model.main.Common;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.eks.HelmChart;
import software.constructs.Construct;

/**
 * Nested stack for Argo Workflows deployment.
 *
 * <p>Deploys Argo Workflows with:
 * <ul>
 *   <li>SSO authentication via ArgoCD's Dex instance</li>
 *   <li>PostgreSQL persistence for workflow archive</li>
 *   <li>S3 artifact storage</li>
 *   <li>IRSA-enabled service accounts for server, controller, and executor</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoWorkflowsNestedStack extends NestedStack {
  private final HelmChart chart;

  /**
   * Creates the Argo Workflows nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param cluster the EKS cluster to deploy to
   * @param setup   pre-created resources (databases, buckets, service accounts)
   * @param argocd  ArgoCD stack (provides SSO client secret)
   * @param props   nested stack properties
   */
  @SneakyThrows
  public ArgoWorkflowsNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    IdpSetupNestedStack setup,
    ArgoCdNestedStack argocd,
    NestedStackProps props
  ) {
    super(scope, "argoworkflows", props);

    log.debug(
      "{} [common: {} conf: {} database: {} bucket: {} certificate: {}]", "ArgoWorkflowsNestedStack",
      common,
      conf,
      setup.argoWorkflowsDb().cluster().getClusterIdentifier(),
      setup.argoWorkflowsArtifacts().bucket().getBucketName(),
      setup.certificate().certificate().getCertificateArn());

    var argoWorkflows = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class)
      .argoWorkflows();

    var argoWorkflowsSetup = Mapper.get()
      .readValue(Template.parse(scope, argoWorkflows.setup()), ArgoWorkflowSetup.class);

    var templateMappings = new HashMap<String, Object>();
    templateMappings.put("region", common.region());
    templateMappings.put("domain", common.domain());
    templateMappings.put("workflowNamespaces", setup.argoWorkflowsNamespaces().keySet());
    templateMappings.put("argoServer.role.arn", setup.argoServerServiceAccount().roleConstruct().role().getRoleArn());
    templateMappings.put("argoController.role.arn", setup.argoControllerServiceAccount().roleConstruct().role().getRoleArn());
    templateMappings.put("workflowExecutor.role.arn", setup.argoExecutorServiceAccount().roleConstruct().role().getRoleArn());
    templateMappings.put("artifactBucket", setup.argoWorkflowsArtifacts().bucket().getBucketName());

    templateMappings.put("certificate.arn", setup.certificate().certificate().getCertificateArn());
    templateMappings.put("argoWorkflows.db.host", setup.argoWorkflowsDb().cluster().getClusterEndpoint().getHostname());
    templateMappings.put("argoWorkflows.db.secretArn", setup.argoWorkflowsDb().secretConstruct().secret().getSecretArn());
    templateMappings.put("argoWorkflows.db.secretName", setup.argoWorkflowsDb().secretConstruct().secret().getSecretName());
    templateMappings.put("argoWorkflows.db.name", argoWorkflowsSetup.database().databaseName());
    templateMappings.put("argoWorkflows.ssoClientSecret", argocd.argoWorkflowsSsoClientSecret());

    var parsed = Template.parse(scope, argoWorkflows.chart().values(), templateMappings);
    var values = Mapper.get().readValue(parsed, new TypeReference<Map<String, Object>>() {});

    this.chart = HelmChart.Builder
      .create(this, argoWorkflows.chart().name())
      .cluster(cluster)
      .wait(true)
      .timeout(Duration.minutes(15))
      .skipCrds(false)
      .createNamespace(false)
      .chart(argoWorkflows.chart().name())
      .namespace(argoWorkflows.chart().namespace())
      .repository(argoWorkflows.chart().repository())
      .release(argoWorkflows.chart().release())
      .version(argoWorkflows.chart().version())
      .values(values)
      .build();
  }
}
