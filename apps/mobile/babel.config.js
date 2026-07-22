module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);
  return {
    presets: [
      ['@react-native/babel-preset', { reanimated: !isTest }],
    ],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
