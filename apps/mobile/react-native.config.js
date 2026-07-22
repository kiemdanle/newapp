const path = require('path');

// Only ship fonts the app actually uses. Full vector-icons Fonts/ would
// pack every family (FontAwesome, Material, …) into the APK for no gain.
const ioniconsFont = path.join(
  path.dirname(require.resolve('react-native-vector-icons/package.json')),
  'Fonts',
  'Ionicons.ttf',
);

module.exports = {
  project: {
    android: {
      packageName: 'com.expyrico.app',
      sourceDir: './android',
    },
    ios: {
      sourceDir: './ios',
    },
  },
  // RN asset linking copies these into android/app/src/main/assets/fonts
  // (and iOS Resources when re-linked). Without this, Ionicons renders as □.
  assets: [ioniconsFont],
};
