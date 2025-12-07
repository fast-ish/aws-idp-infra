package fasti.sh.idp.stack;

import static fasti.sh.execute.serialization.Format.describe;
import static fasti.sh.execute.serialization.Format.id;

import fasti.sh.execute.aws.eks.EksNestedStack;
import fasti.sh.execute.aws.eks.ObservabilityNestedStack;
import fasti.sh.execute.aws.vpc.NetworkNestedStack;
import lombok.Getter;
import software.amazon.awscdk.NestedStackProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.constructs.Construct;

/**
 * Main CDK stack for IDP infrastructure deployment.
 *
 * <p>
 * This stack orchestrates the deployment of:
 * <ul>
 * <li>VPC networking via NetworkNestedStack</li>
 * <li>EKS cluster via EksNestedStack</li>
 * <li>Backstage application with RDS PostgreSQL via BackstageNestedStack</li>
 * <li>Observability components via ObservabilityNestedStack</li>
 * </ul>
 */
@Getter
public class IdpStack extends Stack {
  private final NetworkNestedStack network;
  private final EksNestedStack eks;
  private final BackstageNestedStack backstage;
  private final ObservabilityNestedStack observability;

  /**
   * Creates a new IdpStack.
   *
   * @param scope
   *          the parent construct
   * @param conf
   *          the release configuration
   * @param props
   *          stack properties
   */
  public IdpStack(Construct scope, IdpReleaseConf conf, StackProps props) {
    super(scope, id("idp", conf.common().version()), props);

    this.network = new NetworkNestedStack(this, conf.common(), conf.vpc(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::network"))
        .build());

    this.eks = new EksNestedStack(this, conf.common(), conf.eks(), this.network.vpc(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::eks"))
        .build());

    this.backstage = new BackstageNestedStack(this, conf.common(), conf,
      this.network.vpc(), this.eks.cluster(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::backstage"))
        .build());

    this.observability = new ObservabilityNestedStack(this, conf.common(), conf.eks().observability(),
      NestedStackProps
        .builder()
        .description(describe(conf.common(), "idp::observability"))
        .build());

    this.eks().addDependency(this.network());
    this.backstage().addDependency(this.eks());
    this.observability().addDependency(this.eks());
  }
}
