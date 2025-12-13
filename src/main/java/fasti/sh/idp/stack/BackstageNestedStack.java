package fasti.sh.idp.stack;

import static fasti.sh.execute.serialization.Format.id;

import fasti.sh.execute.aws.ecr.DockerImageConstruct;
import fasti.sh.execute.aws.rds.RdsConstruct;
import fasti.sh.execute.serialization.Mapper;
import fasti.sh.execute.serialization.Template;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.model.aws.eks.addon.AddonsConf;
import fasti.sh.model.main.Common;
import java.util.Map;
import lombok.Getter;
import lombok.SneakyThrows;
import software.amazon.awscdk.NestedStack;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.services.certificatemanager.ICertificate;
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
 * <li>RDS database for Backstage</li>
 * <li>Database credentials sync via ExternalSecrets</li>
 * <li>GitHub OAuth secret lookup (pre-existing secret)</li>
 * <li>IAM role for Backstage service account (IRSA)</li>
 * <li>Backstage Helm chart deployment to EKS</li>
 * </ul>
 *
 * <p>
 * <b>Dependency Chain:</b>
 * <pre>
 * StorageStack (ACM certificate, ClusterSecretStore)
 *        ↓
 * BackstageStack (this construct - RDS, Helm chart + ExternalSecret)
 * </pre>
 */
@Getter
public class BackstageNestedStack extends NestedStack {
  private final RdsConstruct database;
  private final IRole serviceAccountRole;
  private final ICertificate certificate;
  private final DockerImageConstruct dockerImage;
  private final HelmChart backstageChart;

  /**
   * Creates a new BackstageNestedStack.
   *
   * @param scope   the parent construct
   * @param common  shared deployment metadata
   * @param conf    the Backstage release configuration
   * @param cluster the EKS cluster to deploy to
   * @param setup   pre-created resources
   * @param props   nested stack properties
   */
  @SneakyThrows
  public BackstageNestedStack(Construct scope,
                              Common common,
                              IdpReleaseConf conf,
                              Cluster cluster,
                              IdpSetupNestedStack setup,
                              NestedStackProps props) {
    super(scope, "backstage", props);

    var backstage = Mapper.get()
      .readValue(Template.parse(scope, conf.eks().addons()), AddonsConf.class)
      .backstage();

    this.database = setup.backstage().database();
    this.certificate = setup.certificate().certificate();
    this.serviceAccountRole = setup.backstage().serviceAccountRole();
    this.dockerImage = new DockerImageConstruct(this, common, backstage.dockerImage());

    var githubOAuthSecret = (String) this.getNode().getContext("deployment:github:oauth:backstage");

    var valuesYaml = Template
      .parse(
        this,
        backstage.chart().values(),
        Map
          .of(
            "database.host", this.database.cluster().getClusterEndpoint().getHostname(),
            "database.port", "5432",
            "database.secretArn", this.database.secretConstruct().secret().getSecretArn(),
            "database.secretName", this.database.secretConstruct().secret().getSecretName(),
            "auth.github.awsSecretName", githubOAuthSecret,
            "certificate.arn", this.certificate.getCertificateArn(),
            "image.uri", this.dockerImage.imageUri()));


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
      .namespace(backstage.chart().namespace())
      .release(backstage.chart().release())
      .values(values)
      .createNamespace(true)
      .build();
  }
}
