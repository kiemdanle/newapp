// pnpm hook: strip the OPTIONAL `expo` peer dependency declared by a few
// React Native packages (@react-native-firebase/*, @react-native-google-signin).
// Expo is fully removed from this project; the peer exists only so those libs
// can integrate with Expo projects. Under `autoInstallPeers: true` pnpm would
// otherwise install the entire Expo SDK. Removing the peer key makes pnpm
// treat it as absent, so nothing pulls expo into node_modules.
//
// The app code never imports expo (verified), so this is safe.

const EXPO_PEER = 'expo';

function readPackage(pkg, context) {
  if (pkg.peerDependencies && Object.prototype.hasOwnProperty.call(pkg.peerDependencies, EXPO_PEER)) {
    const meta = pkg.peerDependenciesMeta && pkg.peerDependenciesMeta[EXPO_PEER];
    if (meta && meta.optional) {
      context.log(`[pnpmfile] stripping optional expo peer from ${pkg.name}@${pkg.version}`);
      delete pkg.peerDependencies[EXPO_PEER];
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[EXPO_PEER];
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
