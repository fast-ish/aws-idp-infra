package fasti.sh.idp.stack;

import static fasti.sh.execute.serialization.Format.describe;
import static fasti.sh.execute.serialization.Format.id;

import fasti.sh.execute.aws.eks.AddonsNestedStack;
import fasti.sh.execute.aws.eks.EksNestedStack;
import fasti.sh.execute.aws.eks.ObservabilityAddonsNestedStack;
import fasti.sh.execute.aws.vpc.NetworkNestedStack;
import fasti.sh.idp.model.IdpReleaseConf;
import lombok.Getter;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.constructs.Construct;

/**
 * Main CDK stack for the Internal Developer Platform.
 *
 * <p>
 * Orchestrates all nested stacks in the correct dependency order:
 * <ol>
 * <li>Network - VPC and networking infrastructure</li>
 * <li>EKS - Kubernetes cluster</li>
 * <li>Core Addons - Essential cluster add-ons (Karpenter, cert-manager, etc.)</li>
 * <li>Observability Addons - Monitoring and logging (Grafana, Alloy)</li>
 * <li>IDP Setup - Shared resources (certificates) and component setups</li>
 * <li>Backstage - Developer portal</li>
 * <li>ArgoCD - GitOps deployment</li>
 * <li>Argo Workflows - Workflow automation</li>
 * <li>Argo Events - Event-driven automation</li>
 * <li>Argo Rollouts - Progressive delivery</li>
 * </ol>
 */
@Getter
public class IdpStack extends Stack {
  private final NetworkNestedStack network;
  private final EksNestedStack eks;
  private final AddonsNestedStack coreAddons;
  private final ObservabilityAddonsNestedStack observabilityAddons;
  private final IdpSetupNestedStack setup;
  private final BackstageNestedStack backstage;
  private final ArgoCdNestedStack argocd;
  private final ArgoWorkflowsNestedStack argoWorkflows;
  private final ArgoEventsNestedStack argoEvents;
  private final ArgoRolloutsNestedStack argoRollouts;

  /**
   * Creates the IDP stack with all nested stacks.
   *
   * @param scope
   *          the parent construct
   * @param conf
   *          IDP release configuration
   * @param props
   *          stack properties including environment and tags
   */
  public IdpStack(Construct scope, IdpReleaseConf conf, StackProps props) {
    super(scope, id("idp", conf.common().version()), props);

    this.network = new NetworkNestedStack(
      this,
      conf.common(),
      conf.vpc(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::network"))
        .build());

    this.eks = new EksNestedStack(
      this,
      conf.common(),
      conf.eks(),
      this.network.vpc(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::eks"))
        .build());

    this.coreAddons = new AddonsNestedStack(
      this,
      conf.common(),
      conf.eks(),
      this.eks.cluster(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::addons"))
        .build());

    this.observabilityAddons = new ObservabilityAddonsNestedStack(
      this,
      conf.common(),
      conf.eks(),
      this.eks.cluster(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::observability-addons"))
        .build());

    this.setup = new IdpSetupNestedStack(
      this,
      conf.common(),
      conf,
      this.network.vpc(),
      this.eks.cluster(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::setup"))
        .build());

    this.backstage = new BackstageNestedStack(
      this,
      conf.common(),
      conf,
      this.eks.cluster(),
      this.setup,
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::backstage"))
        .build());

    this.argocd = new ArgoCdNestedStack(
      this,
      conf.common(),
      conf,
      this.eks.cluster(),
      this.setup,
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::argocd"))
        .build());

    this.argoWorkflows = new ArgoWorkflowsNestedStack(
      this,
      conf.common(),
      conf,
      this.eks.cluster(),
      this.setup,
      this.argocd,
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::argo-workflows"))
        .build());

    this.argoEvents = new ArgoEventsNestedStack(
      this,
      conf.common(),
      conf,
      this.eks.cluster(),
      this.setup,
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::argo-events"))
        .build());

    this.argoRollouts = new ArgoRolloutsNestedStack(
      this,
      conf.common(),
      conf,
      this.eks.cluster(),
      this.setup,
      this.argocd,
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::argo-rollouts"))
        .build());

    this.eks().addDependency(this.network());
    this.coreAddons().addDependency(this.eks());
    this.observabilityAddons().addDependency(this.coreAddons());
    this.setup().addDependency(this.coreAddons());
    this.backstage().addDependency(this.setup());
    this.argocd().addDependency(this.setup());
    this.argoWorkflows().addDependency(this.argocd());
    this.argoEvents().addDependency(this.argoWorkflows());
    this.argoRollouts().addDependency(this.argoEvents());
  }
}
