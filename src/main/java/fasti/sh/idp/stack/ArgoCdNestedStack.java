package fasti.sh.idp.stack;

import com.fasterxml.jackson.core.type.TypeReference;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
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
 * Nested stack for ArgoCD GitOps deployment.
 *
 * <p>Deploys ArgoCD with GitHub SSO authentication via Dex. Also generates
 * the SSO client secret used by Argo Workflows to authenticate against
 * ArgoCD's Dex instance.
 */
@Slf4j
@Getter
public class ArgoCdNestedStack extends NestedStack {
  private final HelmChart chart;
  private final String argoWorkflowsSsoClientSecret;
  private final String argoRolloutsSsoClientSecret;

  /**
   * Creates the ArgoCD nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param cluster the EKS cluster to deploy to
   * @param setup   pre-created resources (certificates, service accounts)
   * @param props   nested stack properties
   */
  @SneakyThrows
  public ArgoCdNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    IdpSetupNestedStack setup,
    NestedStackProps props
  ) {
    super(scope, "argocd", props);

    log.debug("{} [common: {} conf: {}]", "ArgoCdConstruct", common, conf);

    this.argoWorkflowsSsoClientSecret = UUID.randomUUID().toString();
    this.argoRolloutsSsoClientSecret = UUID.randomUUID().toString();

    var argocd = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class)
      .argocd();

    var githubOrg = (String) this.getNode().tryGetContext("deployment:github:org");
    var githubOAuthSecret = (String) this.getNode().tryGetContext("deployment:github:oauth:argocd");

    var templateMappings = new HashMap<String, Object>();
    templateMappings.put("repoServer.role.arn", setup.argoCdServiceAccount().roleConstruct().role().getRoleArn());
    templateMappings.put("domain", common.domain());
    templateMappings.put("certificate.arn", setup.certificate().certificate().getCertificateArn());
    templateMappings.put("github.org", githubOrg != null ? githubOrg : "");
    templateMappings.put("github.oauthSecretName", githubOAuthSecret != null ? githubOAuthSecret : common.id() + "-argocd-github-oauth");
    templateMappings.put("argoWorkflows.ssoClientSecret", this.argoWorkflowsSsoClientSecret);
    templateMappings.put("argoRollouts.ssoClientSecret", this.argoRolloutsSsoClientSecret);
    templateMappings.put("alb.serviceAccountName", common.id() + "-aws-load-balancer-sa");

    var parsed = Template.parse(scope, argocd.chart().values(), templateMappings);

    var values = Mapper.get().readValue(parsed, new TypeReference<Map<String, Object>>() {});
    this.chart = HelmChart.Builder
      .create(this, argocd.chart().name())
      .cluster(cluster)
      .wait(true)
      .timeout(Duration.minutes(15))
      .skipCrds(false)
      .createNamespace(false)
      .chart(argocd.chart().name())
      .namespace(argocd.chart().namespace())
      .repository(argocd.chart().repository())
      .release(argocd.chart().release())
      .version(argocd.chart().version())
      .values(values)
      .build();
  }
}
