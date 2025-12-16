package fasti.sh.idp.stack;

import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.eks.HelmChart;
import software.constructs.Construct;

/**
 * Nested stack for Argo Events deployment.
 *
 * <p>
 * Deploys Argo Events for event-driven workflow automation with:
 * <ul>
 * <li>Event controller with leader election</li>
 * <li>NATS JetStream-based event bus</li>
 * <li>Webhook for HTTP event sources</li>
 * <li>IRSA-enabled controller service account for AWS integrations</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoEventsNestedStack extends NestedStack {
  private final HelmChart chart;

  /**
   * Creates the Argo Events nested stack.
   *
   * @param scope
   *          the parent construct
   * @param common
   *          shared deployment metadata
   * @param conf
   *          IDP release configuration
   * @param cluster
   *          the EKS cluster to deploy to
   * @param setup
   *          IDP setup (provides argoEvents setup)
   * @param props
   *          nested stack properties
   */
  public ArgoEventsNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    IdpSetupNestedStack setup,
    NestedStackProps props) {
    super(scope, "argoevents", props);

    log.debug("{} [common: {} conf: {}]", "ArgoEventsNestedStack", common, conf);

    var argoEvents = TemplateUtils.parseAs(scope, conf.eks().addons(), AddonsConf.class).argoEvents();
    var values = TemplateUtils.parseAsMap(scope, argoEvents.chart().values());

    this.chart = HelmChart.Builder
      .create(this, argoEvents.chart().name())
      .cluster(cluster)
      .wait(true)
      .timeout(Duration.minutes(15))
      .skipCrds(false)
      .createNamespace(false)
      .chart(argoEvents.chart().name())
      .namespace(argoEvents.chart().namespace())
      .repository(argoEvents.chart().repository())
      .release(argoEvents.chart().release())
      .version(argoEvents.chart().version())
      .values(values)
      .build();
  }
}
