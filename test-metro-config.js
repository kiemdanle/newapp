const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = '/home/dan/newapp/apps/mobile';
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const finalConfig = withNativeWind(config, { input: './global.css' });

console.log('disableHierarchicalLookup:', finalConfig.resolver.disableHierarchicalLookup);
console.log('nodeModulesPaths:', finalConfig.resolver.nodeModulesPaths);
console.log('resolveRequest exists:', typeof finalConfig.resolver.resolveRequest);
console.log('transformerPath:', finalConfig.transformerPath);
console.log('watchFolders:', finalConfig.watchFolders);
