// No-op stub for react-native-worklets.
//
// The real react-native-worklets requires RN 0.83+, but this app is pinned to RN
// 0.74.5 (Expo SDK 51). babel-preset-expo / the RN babel preset unconditionally
// resolve `react-native-worklets/plugin` while transforming react-native's own
// files under jest. Reanimated is fully mocked in tests (tests/setup.ts), so the
// worklets runtime is never exercised — the module only needs to resolve.
module.exports = {};
