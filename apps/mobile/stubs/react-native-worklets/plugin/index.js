// No-op babel plugin. The real react-native-worklets requires RN 0.83+, but this
// project is on RN 0.74 (Expo SDK 51). babel-preset-expo unconditionally resolves
// `react-native-worklets/plugin` while transforming react-native's own files under
// jest. Reanimated is fully mocked in tests (tests/setup.ts), so this transform
// never needs to do anything — it only needs to resolve to a valid babel plugin.
module.exports = function () {
  return { visitor: {} };
};
