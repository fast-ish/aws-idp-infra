package fasti.sh.idp.stack;

import fasti.sh.execute.aws.acm.AcmCertificateConstruct;
import fasti.sh.execute.aws.eks.NamespaceConstruct;
import fasti.sh.execute.aws.eks.ServiceAccountConstruct;
import fasti.sh.execute.aws.iam.RoleConstruct;
import fasti.sh.execute.aws.rds.RdsConstruct;
import fasti.sh.execute.aws.s3.BucketConstruct;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.acm.AcmCertificate;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.aws.eks.addon.argo.ArgoWorkflowSetup;
import fasti.sh.model.aws.eks.addon.backstage.BackstageSetup;
import fasti.sh.model.main.Common;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.constructs.Construct;

/**
 * Nested stack for shared IDP infrastructure setup.
 *
 * <p>Creates resources shared across IDP components:
 * <ul>
 *   <li>ACM certificate for TLS</li>
 *   <li>RDS databases for Backstage and Argo Workflows</li>
 *   <li>S3 bucket for Argo Workflows artifacts</li>
 *   <li>Kubernetes namespaces for ArgoCD, Argo Workflows, Argo Events, and Argo Rollouts</li>
 *   <li>IRSA-enabled service accounts for all components</li>
 * </ul>
 *
 * <p>This stack must be deployed before Backstage, ArgoCD, Argo Workflows, Argo Events, and Argo Rollouts.
 */
@Slf4j
@Getter
public class IdpSetupNestedStack extends NestedStack {
  private final AcmCertificateConstruct certificate;
  private final @NotNull ISecret githubOAuthSecret;
  private final RdsConstruct backstageDb;
  private final Role backstageServiceAccountRole;
  private final NamespaceConstruct argoCdNamespace;
  private final ServiceAccountConstruct argoCdServiceAccount;
  private final NamespaceConstruct argoWorkflowsNamespace;
  private final BucketConstruct argoWorkflowsArtifacts;
  private final RdsConstruct argoWorkflowsDb;
  private final Map<String, NamespaceConstruct> argoWorkflowsNamespaces;
  private final ServiceAccountConstruct argoServerServiceAccount;
  private final ServiceAccountConstruct argoControllerServiceAccount;
  private final ServiceAccountConstruct argoExecutorServiceAccount;
  private final NamespaceConstruct argoEventsNamespace;
  private final ServiceAccountConstruct argoEventsControllerServiceAccount;
  private final NamespaceConstruct argoRolloutsNamespace;
  private final ServiceAccountConstruct argoRolloutsControllerServiceAccount;
  private final ServiceAccountConstruct argoRolloutsDashboardServiceAccount;

  /**
   * Creates the IDP setup nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param vpc     VPC for database placement
   * @param cluster EKS cluster for namespace and service account creation
   * @param props   nested stack properties
   */
  @SneakyThrows
  public IdpSetupNestedStack(Construct scope,
    Common common,
    IdpReleaseConf conf,
    Vpc vpc,
    Cluster cluster,
    NestedStackProps props) {
    super(scope, "idp-setup", props);

    log.debug("{} [common: {} conf: {}]", "IdpSetupNestedStack", common, conf);

    var certificateConf = Mapper.get()
      .readValue(Template.parse(scope, conf.certificate()), AcmCertificate.class);

    this.certificate = new AcmCertificateConstruct(this, common, certificateConf);

    var addons = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class);

    var backstageSetup = Mapper.get()
      .readValue(Template.parse(scope, addons.backstage().setup()), BackstageSetup.class);

    this.githubOAuthSecret = Secret.fromSecretNameV2(this, "github-oauth-secret", backstageSetup.secret());

    this.backstageDb = new RdsConstruct(
      this,
      common,
      backstageSetup.database(),
      vpc,
      List.of(cluster.getClusterSecurityGroup()));

    var oidc = cluster.getOpenIdConnectProvider();
    var principal = backstageSetup.serviceAccount().role().principal().oidcPrincipal(this, oidc, backstageSetup.serviceAccount());
    this.backstageServiceAccountRole = new RoleConstruct(this, common, principal, backstageSetup.serviceAccount().role()).role();

    this.argoCdNamespace =
      new NamespaceConstruct(this, common, addons.argocd().serviceAccount().metadata(), cluster);

    this.argoCdServiceAccount = new ServiceAccountConstruct(this, common, addons.argocd().serviceAccount(), cluster);
    this.argoCdServiceAccount().getNode().addDependency(this.argoCdNamespace());

    var argoWorkflowsSetup = Mapper.get()
      .readValue(Template.parse(scope, addons.argoWorkflows().setup()), ArgoWorkflowSetup.class);

    this.argoWorkflowsNamespace = new NamespaceConstruct(
      this,
      common,
      argoWorkflowsSetup.serverServiceAccount().metadata(),
      cluster);

    this.argoWorkflowsArtifacts = new BucketConstruct(scope, common, argoWorkflowsSetup.artifactBucket());

    this.argoWorkflowsDb = new RdsConstruct(
      this,
      common,
      argoWorkflowsSetup.database(),
      vpc,
      List.of(cluster.getClusterSecurityGroup()));

    this.argoWorkflowsNamespaces = new HashMap<>();
    argoWorkflowsSetup.workflowNamespaces().forEach(ns -> {
      var metadata = new ObjectMetaBuilder()
        .withName(ns)
        .withNamespace(ns)
        .withLabels(argoWorkflowsSetup.labels())
        .withAnnotations(argoWorkflowsSetup.annotations())
        .build();

      var team = new NamespaceConstruct(this, common, metadata, cluster);
      team.getNode().addDependency(this.argoWorkflowsNamespace);

      this.argoWorkflowsNamespaces.put(ns, team);
    });

    this.argoServerServiceAccount = new ServiceAccountConstruct(this, common, argoWorkflowsSetup.serverServiceAccount(), cluster);
    this.argoServerServiceAccount().getNode().addDependency(this.argoWorkflowsNamespace());

    this.argoControllerServiceAccount = new ServiceAccountConstruct(this, common, argoWorkflowsSetup.controllerServiceAccount(), cluster);
    this.argoControllerServiceAccount().getNode().addDependency(this.argoWorkflowsNamespace());

    this.argoExecutorServiceAccount = new ServiceAccountConstruct(this, common, argoWorkflowsSetup.executorServiceAccount(), cluster);
    this.argoExecutorServiceAccount().getNode().addDependency(this.argoWorkflowsNamespace());

    this.argoEventsNamespace = new NamespaceConstruct(
      this,
      common,
      addons.argoEvents().controllerServiceAccount().metadata(),
      cluster);

    this.argoEventsControllerServiceAccount = new ServiceAccountConstruct(this, common, addons.argoEvents().controllerServiceAccount(), cluster);
    this.argoEventsControllerServiceAccount().getNode().addDependency(this.argoEventsNamespace());

    this.argoRolloutsNamespace = new NamespaceConstruct(
      this,
      common,
      addons.argoRollouts().controllerServiceAccount().metadata(),
      cluster);

    this.argoRolloutsControllerServiceAccount = new ServiceAccountConstruct(this, common, addons.argoRollouts().controllerServiceAccount(), cluster);
    this.argoRolloutsControllerServiceAccount().getNode().addDependency(this.argoRolloutsNamespace());

    this.argoRolloutsDashboardServiceAccount = new ServiceAccountConstruct(this, common, addons.argoRollouts().dashboardServiceAccount(), cluster);
    this.argoRolloutsDashboardServiceAccount().getNode().addDependency(this.argoRolloutsNamespace());
  }
}
