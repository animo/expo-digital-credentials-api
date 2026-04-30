const {
  WarningAggregator,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const FLAG = "Xskip-metadata-version-check";

module.exports = function withKotlinMetadataSkip(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      WarningAggregator.addWarningAndroid(
        "withKotlinMetadataSkip",
        "Cannot configure build.gradle because it's not Groovy.",
        "https://docs.expo.dev/"
      );
      return config;
    }

    if (config.modResults.contents.includes(FLAG)) {
      return config;
    }

    config.modResults.contents += `

// Allow Kotlin 1.9 compiler to consume Kotlin 2.x metadata from DC-API libs.
subprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions.freeCompilerArgs += "-${FLAG}"
  }
}
`;
    return config;
  });
};
