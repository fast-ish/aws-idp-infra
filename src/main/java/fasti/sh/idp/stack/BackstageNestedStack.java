package fasti.sh.idp.stack;

import static fasti.sh.execute.serialization.Format.id;

import fasti.sh.execute.aws.acm.AcmCertificateConstruct;
import fasti.sh.execute.aws.ecr.DockerImageConstruct;
import fasti.sh.execute.aws.iam.RoleConstruct;
import fasti.sh.execute.aws.rds.RdsConstruct;
import fasti.sh.execute.aws.secretsmanager.SecretConstruct;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.model.main.Common;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.certificatemanager.ICertificate;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.eks.Cluster;
import software.amazon.awscdk.services.eks.HelmChart;
import software.amazon.awscdk.services.iam.IRole;
import software.amazon.awscdk.services.s3.assets.Asset;
import software.amazon.awscdk.services.s3.assets.AssetProps;
import software.constructs.Construct;

/**
 * Nested stack for Backstage application deployment.
 *
 * <p>
 * This stack handles:
 * <ul>
 * <li>RDS PostgreSQL database creation for Backstage metadata</li>
 * <li>GitHub OAuth secret management</li>
 * <li>IAM role for Backstage service account (IRSA)</li>
 * <li>Backstage Helm chart deployment to EKS</li>
 * </ul>
 */
@Getter
public class BackstageNestedStack extends NestedStack {
  private final RdsConstruct database;
  private final SecretConstruct githubOAuthSecret;
  private final IRole serviceAccountRole;
  private final ICertificate certificate;
  private final DockerImageConstruct dockerImage;
  private final HelmChart backstageChart;

  /**
   * Creates a new BackstageNestedStack.
   *
   * @param scope
   *          the parent construct
   * @param common
   *          shared deployment metadata
   * @param conf
   *          the Backstage release configuration
   * @param vpc
   *          the VPC for the deployment
   * @param cluster
   *          the EKS cluster to deploy to
   * @param props
   *          nested stack properties
   */
  @SneakyThrows
  public BackstageNestedStack(Construct scope, Common common, IdpReleaseConf conf,
    Vpc vpc, Cluster cluster, NestedStackProps props) {
    super(scope, "backstage", props);

    this.database = new RdsConstruct(this, common, conf.database(), vpc, List.of(cluster.getClusterSecurityGroup()));
    this.githubOAuthSecret = new SecretConstruct(this, common, conf.githubOAuth());
    this.certificate = new AcmCertificateConstruct(this, common, conf.certificate()).certificate();
    this.dockerImage = new DockerImageConstruct(this, common, conf.dockerImage());

    var oidc = cluster.getOpenIdConnectProvider();
    var principal = conf.serviceAccount().role().principal().oidcPrincipal(this, oidc, conf.serviceAccount());
    this.serviceAccountRole = new RoleConstruct(this, common, principal, conf.serviceAccount().role()).role();

    var valuesYaml = Template
      .parse(
        this,
        conf.helm().values(),
        Map
          .of(
            "database.host",
            this.database.cluster().getClusterEndpoint().getHostname(),
            "database.port",
            "5432",
            "database.secretArn",
            this.database.secretConstruct().secret().getSecretArn(),
            "githubOAuth.secretArn",
            this.githubOAuthSecret.secret().getSecretArn(),
            "certificate.arn",
            this.certificate.getCertificateArn(),
            "image.uri",
            this.dockerImage.imageUri()));

    @SuppressWarnings("unchecked")
    var values = (Map<String, Object>) Mapper.get().readValue(valuesYaml, Map.class);

    this.backstageChart = HelmChart.Builder
      .create(this, id("backstage", "chart"))
      .cluster(cluster)
      .chartAsset(
        new Asset(
          this, id("backstage", "helm-asset"),
          AssetProps
            .builder()
            .path("helm/chart/backstage")
            .build()))
      .namespace(conf.helm().namespace())
      .release(conf.helm().release())
      .values(values)
      .createNamespace(true)
      .build();

    this.backstageChart.getNode().addDependency(this.serviceAccountRole);
  }
}
