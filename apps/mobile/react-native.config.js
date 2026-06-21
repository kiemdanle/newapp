// Explicitly override `expo`'s autolinking import path.
//
// expo@52.0.49 sets `namespace "expo.core"` in android/build.gradle but its
// ExpoModulesPackage.kt declares `package expo.modules`. expo's own
// react-native.config.js sets the correct `packageImportPath` only when
// isExpoModulesInstalledAndroid() returns true — but that check can fail
// silently on EAS (the config is loaded via require-from-string which swallows
// errors), causing the autolinking to fall back to
// `import expo.core.ExpoModulesPackage;` (from the gradle namespace), which
// doesn't resolve. Pin the correct path here so the build is deterministic.
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};
