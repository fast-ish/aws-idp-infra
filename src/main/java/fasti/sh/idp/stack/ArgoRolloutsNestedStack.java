package fasti.sh.idp.stack;

import com.fasterxml.jackson.core.type.TypeReference;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.eks.HelmChart;
import software.amazon.awscdk.services.eks.KubernetesManifest;
import software.constructs.Construct;

/**
 * Nested stack for Argo Rollouts deployment.
 *
 * <p>Deploys Argo Rollouts for progressive delivery with:
 * <ul>
 *   <li>Rollouts controller for canary and blue-green deployments</li>
 *   <li>Dashboard UI with GitHub SSO via ALB OIDC</li>
 *   <li>Analysis runs for automated rollback decisions</li>
 * </ul>
 */
@Slf4j
@Getter
public class ArgoRolloutsNestedStack extends NestedStack {
  private final HelmChart chart;
  private final KubernetesManifest ingress;

  /**
   * Creates the Argo Rollouts nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param cluster the EKS cluster to deploy to
   * @param setup   IDP setup (provides certificate and argoRollouts setup)
   * @param props   nested stack properties
   */
  @SneakyThrows
  public ArgoRolloutsNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    IdpSetupNestedStack setup,
    NestedStackProps props
  ) {
    super(scope, "argorollouts", props);

    log.debug("{} [common: {} conf: {}]", "ArgoRolloutsNestedStack", common, conf);

    var argoRollouts = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class)
      .argoRollouts();

    var domain = (String) this.getNode().tryGetContext("deployment:domain");

    Map<String, Object> templateMappings = new HashMap<>();
    templateMappings.put("certificate.arn", setup.certificate().certificate().getCertificateArn());
    templateMappings.put("domain", domain);

    var parsed = Template.parse(scope, argoRollouts.chart().values(), templateMappings);
    var values = Mapper.get().readValue(parsed, new TypeReference<Map<String, Object>>() {});

    this.chart = HelmChart.Builder
      .create(this, argoRollouts.chart().name())
      .cluster(cluster)
      .wait(true)
      .timeout(Duration.minutes(15))
      .skipCrds(false)
      .createNamespace(false)
      .chart(argoRollouts.chart().name())
      .namespace(argoRollouts.chart().namespace())
      .repository(argoRollouts.chart().repository())
      .release(argoRollouts.chart().release())
      .version(argoRollouts.chart().version())
      .values(values)
      .build();

    var ingressParsed = Template.parse(scope, argoRollouts.ingress(), templateMappings);
    var ingressManifest = Mapper.get().readValue(ingressParsed, new TypeReference<Map<String, Object>>() {});
    this.ingress = KubernetesManifest.Builder
      .create(this, "argo-rollouts-dashboard-ingress")
      .cluster(cluster)
      .overwrite(true)
      .prune(true)
      .skipValidation(true)
      .manifest(List.of(ingressManifest))
      .build();

    this.ingress.getNode().addDependency(this.chart);
  }
}
