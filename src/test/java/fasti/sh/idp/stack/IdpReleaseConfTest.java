package fasti.sh.idp.stack;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import fasti.sh.model.aws.eks.HelmChart;
import fasti.sh.model.main.Common;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for IdpReleaseConf record.
 */
@DisplayName("IdpReleaseConf Tests")
class IdpReleaseConfTest {

  @Nested
  @DisplayName("Record Construction Tests")
  class ConstructionTests {

    @Test
    @DisplayName("should create record with all fields")
    void shouldCreateRecordWithAllFields() {
      var common = createTestCommon();
      var helm = createTestHelmChart();

      var conf = new IdpReleaseConf(
        common,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        helm);

      assertNotNull(conf);
      assertEquals(common, conf.common());
      assertEquals(helm, conf.helm());
      assertNull(conf.vpc());
      assertNull(conf.eks());
      assertNull(conf.database());
      assertNull(conf.githubOAuth());
      assertNull(conf.serviceAccount());
      assertNull(conf.certificate());
      assertNull(conf.dockerImage());
    }

    @Test
    @DisplayName("should preserve common metadata")
    void shouldPreserveCommonMetadata() {
      var common = createTestCommon();
      var conf = new IdpReleaseConf(common, null, null, null, null, null, null, null, null);

      assertEquals("test-id", conf.common().id());
      assertEquals("123456789012", conf.common().account());
      assertEquals("us-west-2", conf.common().region());
      assertEquals("test-org", conf.common().organization());
      assertEquals("test-name", conf.common().name());
      assertEquals("test-alias", conf.common().alias());
    }
  }

  @Nested
  @DisplayName("Record Equality Tests")
  class EqualityTests {

    @Test
    @DisplayName("should be equal when all fields match")
    void shouldBeEqualWhenAllFieldsMatch() {
      var common = createTestCommon();
      var helm = createTestHelmChart();

      var conf1 = new BackstageReleaseConf(common, null, null, null, null, null, null, null, helm);
      var conf2 = new BackstageReleaseConf(common, null, null, null, null, null, null, null, helm);

      assertEquals(conf1, conf2);
      assertEquals(conf1.hashCode(), conf2.hashCode());
    }
  }

  @Nested
  @DisplayName("HelmChart Configuration Tests")
  class HelmChartTests {

    @Test
    @DisplayName("should preserve helm chart configuration")
    void shouldPreserveHelmChartConfiguration() {
      var helm = createTestHelmChart();
      var conf = new IdpReleaseConf(createTestCommon(), null, null, null, null, null, null, null, helm);

      assertEquals("backstage", conf.helm().name());
      assertEquals("backstage", conf.helm().namespace());
      assertEquals("backstage-test", conf.helm().release());
      assertEquals("1.0.0", conf.helm().version());
    }
  }

  private Common createTestCommon() {
    return new Common(
      "test-id",
      "123456789012",
      "us-west-2",
      "test-org",
      "test-name",
      "test-alias",
      "production",
      "v1",
      "test.domain",
      Map.of("test-key", "test-value"));
  }

  private HelmChart createTestHelmChart() {
    return new HelmChart(
      "backstage",
      "backstage",
      "backstage-test",
      "",
      "backstage/values.mustache",
      "1.0.0");
  }
}
