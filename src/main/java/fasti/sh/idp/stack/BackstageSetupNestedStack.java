package fasti.sh.idp.stack;

import fasti.sh.execute.aws.iam.RoleConstruct;
import fasti.sh.execute.aws.rds.RdsConstruct;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.aws.eks.addon.backstage.BackstageSetup;
import fasti.sh.model.main.Common;
import java.util.List;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.iam.Role;
import software.constructs.Construct;

/**
 * Nested stack for Backstage infrastructure setup.
 *
 * <p>Creates resources required by Backstage:
 * <ul>
 *   <li>RDS PostgreSQL database</li>
 *   <li>IRSA-enabled service account role</li>
 * </ul>
 *
 * <p>GitHub OAuth secret is configured via context (deployment:github:oauth:backstage).
 */
@Slf4j
@Getter
public class BackstageSetupNestedStack extends NestedStack {
  private final RdsConstruct database;
  private final Role serviceAccountRole;

  /**
   * Creates the Backstage setup nested stack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    IDP release configuration
   * @param vpc     VPC for database placement
   * @param cluster EKS cluster for service account creation
   * @param props   nested stack properties
   */
  @SneakyThrows
  public BackstageSetupNestedStack(
    Construct scope,
    Common common,
    IdpReleaseConf conf,
    Vpc vpc,
    Cluster cluster,
    NestedStackProps props
  ) {
    super(scope, "backstage-setup", props);

    log.debug("{} [common: {} conf: {}]", "BackstageSetupNestedStack", common, conf);

    var addons = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class);

    var backstageSetup = Mapper.get()
      .readValue(Template.parse(scope, addons.backstage().setup()), BackstageSetup.class);

    this.database = new RdsConstruct(
      this,
      common,
      backstageSetup.database(),
      vpc,
      List.of(cluster.getClusterSecurityGroup()));

    var oidc = cluster.getOpenIdConnectProvider();
    var principal = backstageSetup.serviceAccount().role().principal().oidcPrincipal(this, oidc, backstageSetup.serviceAccount());
    this.serviceAccountRole = new RoleConstruct(this, common, principal, backstageSetup.serviceAccount().role()).role();
  }
}
