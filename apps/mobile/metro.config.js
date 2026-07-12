const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole repo and look up node_modules in both places.
// Keep hierarchical lookup ENABLED: pnpm's strict node_modules layout stores
// transitive deps inside each package's own virtual store
// (node_modules/.pnpm/<pkg>/node_modules/...). With disableHierarchicalLookup
// Metro can only resolve packages explicitly listed in nodeModulesPaths, so
// every transitive dep (invariant, @babel/runtime, react-native-css-interop,
// etc.) would have to be hoisted as a direct dependency. Letting Metro walk
// the directory tree from each importing file lets it find pnpm-nested deps.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm with node-linker=hoisted puts @types/react@18.x in
// apps/mobile/node_modules/ (because apps/admin uses @types/react@^19 for its
// React 19 app). Metro's file system lookup incorrectly finds
// @types/react/package.json when resolving `react` from app source files —
// @types/react has main: "" and only .d.ts files, so Metro throws
// InvalidPackageError before hierarchical lookup can find the real react at
// the workspace root. Explicitly resolve react/react-native subpaths to the
// hoisted copies so Metro never falls through to the @types package.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const reactPkg = path.resolve(projectRoot, 'node_modules/react');
  const rnPkg = path.resolve(workspaceRoot, 'node_modules/react-native');
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(context, path.join(projectRoot, 'src', moduleName.slice(2)), platform);
  }
  if (moduleName === 'react') {
    return { type: 'sourceFile', filePath: path.join(reactPkg, 'index.js') };
  }
  if (moduleName === 'react/jsx-runtime') {
    return { type: 'sourceFile', filePath: path.join(reactPkg, 'jsx-runtime.js') };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return { type: 'sourceFile', filePath: path.join(reactPkg, 'jsx-dev-runtime.js') };
  }
  return (context.resolveRequest)(context, moduleName, platform);
};

const finalConfig = withNativeWind(config, { input: './global.css' });

module.exports = finalConfig;
