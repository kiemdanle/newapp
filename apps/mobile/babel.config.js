module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo auto-injects the reanimated babel plugin when it
      // detects reanimated installed; that plugin chain resolves
      // react-native-worklets/plugin, which isn't part of the SDK 51 install.
      // Under jest reanimated is fully mocked (tests/setup.ts), so disable the
      // auto-injection there. The real app build keeps it on.
      ['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: !isTest }],
      'nativewind/babel',
    ],
    plugins: [
      // WatermelonDB models use legacy decorators (@field, @date, @readonly).
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // reanimated plugin only for the real build (see note above); skipped in test.
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
