// No-op stub for react-native-worklets.
//
// The real react-native-worklets requires RN 0.83+, but this app is pinned to
// RN 0.76 (Expo SDK 52). nativewind -> react-native-css-interop/babel.js
// unconditionally lists "react-native-worklets/plugin" as a babel plugin, so
// the module only needs to resolve to a valid babel plugin — it never runs at
// runtime (reanimated/worklets are mocked in tests, and the production build
// does not exercise the worklets runtime path either).
module.exports = {};
