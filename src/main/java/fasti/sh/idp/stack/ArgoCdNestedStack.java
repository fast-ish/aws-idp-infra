package fasti.sh.idp.stack;

import fasti.sh.execute.aws.eks.PodIdentityConstruct;
import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.eks.HelmChart;
import software.amazon.awscdk.services.eks.KubernetesManifest;
import software.constructs.Construct;

/**
 * Nested stack for ArgoCD GitOps deployment.
 *
 * <p>
 * Deploys ArgoCD with GitHub SSO authentication via Dex. Also generates the SSO client secret used by Argo Workflows to authenticate
 * against ArgoCD's Dex instance.
 */
@Slf4j
@Getter
public class ArgoCdNestedStack extends NestedStack {
  private final PodIdentityConstruct podIdentity;
  private final HelmChart chart;
  private final KubernetesManifest bootstrap;
  private final String argoWorkflowsSsoClientSecret;
  private final String argoRolloutsSsoClientSecret;

  /**
   * Creates the ArgoCD nested stack.
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
   *          pre-created resources (certificates)
   * @param props
   *          nested stack properties
   */
  public ArgoCdNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Cluster cluster,
    IdpSetupNestedStack setup,
    NestedStackProps props) {
    super(scope, "argocd", props);

    log.debug("{} [common: {} conf: {}]", "ArgoCdConstruct", common, conf);

    this.argoWorkflowsSsoClientSecret = UUID.randomUUID().toString();
    this.argoRolloutsSsoClientSecret = UUID.randomUUID().toString();

    var argocd = TemplateUtils.parseAs(scope, conf.eks().addons(), AddonsConf.class).argocd();

    this.podIdentity = new PodIdentityConstruct(this, common, argocd.podIdentity(), cluster);

    var githubOrg = (String) this.getNode().getContext("deployment:github:org");
    var githubOAuthSecret = (String) this.getNode().getContext("deployment:github:oauth:argocd");

    var templateMappings = new HashMap<String, Object>();
    templateMappings.put("repoServer.role.arn", this.podIdentity.roleConstruct().role().getRoleArn());
    templateMappings.put("domain", common.domain());
    templateMappings.put("github.org", githubOrg);
    templateMappings.put("github.oauthSecretName", githubOAuthSecret);
    templateMappings.put("argoWorkflows.ssoClientSecret", this.argoWorkflowsSsoClientSecret);
    templateMappings.put("argoRollouts.ssoClientSecret", this.argoRolloutsSsoClientSecret);

    var values = TemplateUtils.parseAsMap(scope, argocd.chart().values(), templateMappings);
    this.chart = HelmChart.Builder
      .create(this, argocd.chart().name())
      .cluster(cluster)
      .wait(true)
      .timeout(Duration.minutes(15))
      .skipCrds(false)
      .createNamespace(true)
      .chart(argocd.chart().name())
      .namespace(argocd.chart().namespace())
      .repository(argocd.chart().repository())
      .release(argocd.chart().release())
      .version(argocd.chart().version())
      .values(values)
      .build();

    var bootstrapManifests = TemplateUtils.parseAsList(scope, argocd.bootstrap(), new HashMap<>());
    this.bootstrap = KubernetesManifest.Builder
      .create(this, "bootstrap")
      .cluster(cluster)
      .manifest(bootstrapManifests)
      .overwrite(true)
      .build();

    this.bootstrap.getNode().addDependency(this.chart);
  }
}
