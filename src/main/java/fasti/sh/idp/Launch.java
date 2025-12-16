package fasti.sh.idp;

import static fasti.sh.execute.serialization.Format.describe;
import static fasti.sh.execute.serialization.Format.name;

import com.fasterxml.jackson.core.type.TypeReference;
import fasti.sh.execute.util.ContextUtils;
import fasti.sh.execute.util.TemplateUtils;
import fasti.sh.idp.model.IdpReleaseConf;
import fasti.sh.idp.stack.IdpStack;
import fasti.sh.model.main.Common;
import fasti.sh.model.main.Release;
import java.util.Map;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

/**
 * CDK application entry point for IDP infrastructure deployment.
 *
 * <p>
 * Creates a single stack with nested stacks for all IDP components. Deploy with {@code cdk deploy --all}.
 */
public class Launch {

  /**
   * Main entry point for the CDK application.
   *
   * @param args
   *          command line arguments
   */
  public static void main(final String[] args) {
    var app = new App();

    var conf = get(app);

    new IdpStack(
      app, conf.release(),
      StackProps
        .builder()
        .stackName(name(conf.release().common().id(), "idp"))
        .env(
          Environment
            .builder()
            .account(conf.release().common().account())
            .region(conf.release().common().region())
            .build())
        .description(
          describe(
            conf.platform(),
            String
              .format(
                "Internal Developer Platform release [%s/%s]",
                conf.release().common().name(),
                conf.release().common().alias())))
        .tags(Common.Maps.from(conf.platform().tags(), conf.release().common().tags()))
        .build());

    app.synth();
  }

  private static Release<IdpReleaseConf> get(App app) {
    var mappings = Map
      .<String, Object>ofEntries(
        Map.entry("deployment:tags", ContextUtils.parseTags(app, "deployment:tags")));
    var type = new TypeReference<Release<IdpReleaseConf>>() {};
    return TemplateUtils.parseAs(app, "conf.mustache", mappings, type);
  }
}
