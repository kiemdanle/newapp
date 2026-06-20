#!/usr/bin/env node
// Patches settings.gradle AFTER expo prebuild — replaces fragile require.resolve()
// calls with hardcoded rootDir-relative paths that work on any npm/pnpm layout.

const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'android', 'settings.gradle');
if (!fs.existsSync(settingsPath)) {
  console.log('fix-settings-gradle: no settings.gradle found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(settingsPath, 'utf8');
let changed = false;

// Pattern 1: includeBuild(new File(["node",..."require.resolve('@react-native/gradle-plugin/package.json')"...]).execute...
const gradlePluginInclude = /includeBuild\(new File\(\["node",\s*"--print",\s*"require\.resolve\('@react-native\/gradle-plugin\/package\.json'\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)\)\.getParentFile\(\)\.toString\(\)\)/g;
if (content.match(gradlePluginInclude)) {
  content = content.replace(gradlePluginInclude, 'includeBuild(new File(rootDir, "../node_modules/@react-native/gradle-plugin").toString())');
  changed = true;
}

// Pattern 2: includeBuild at bottom for gradle-plugin with paths option
const gradlePluginInclude2 = /includeBuild\(new File\(\["node",\s*"--print",\s*"require\.resolve\('@react-native\/gradle-plugin\/package\.json',\s*\{ paths: \[require\.resolve\('react-native\/package\.json'\)\] \}\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)\)\.getParentFile\(\)\)/g;
if (content.match(gradlePluginInclude2)) {
  content = content.replace(gradlePluginInclude2, 'includeBuild(new File(rootDir, "../node_modules/@react-native/gradle-plugin"))');
  changed = true;
}

// Pattern 3: expo autolinking
const expoAutolink = /apply from: new File\(\["node",\s*"--print",\s*"require\.resolve\('expo\/package\.json'\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\),\s*"\.\.\/scripts\/autolinking\.gradle"\)/g;
if (content.match(expoAutolink)) {
  content = content.replace(expoAutolink, 'apply from: new File(rootDir, "../node_modules/expo/scripts/autolinking.gradle")');
  changed = true;
}

// Pattern 4: cli-platform-android
const cliAndroid = /apply from: new File\(\["node",\s*"--print",\s*"require\.resolve\('@react-native-community\/cli-platform-android\/package\.json',\s*\{ paths: \[require\.resolve\('react-native\/package\.json'\)\] \}\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\),\s*"\.\.\/native_modules\.gradle"\)/g;
if (content.match(cliAndroid)) {
  content = content.replace(cliAndroid, 'apply from: new File(rootDir, "../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")');
  changed = true;
}

// Pattern 5: versionCatalogs react-native path
const versionCatalogs = /from\(files\(new File\(\["node",\s*"--print",\s*"require\.resolve\('react-native\/package\.json'\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\),\s*"\.\.\/gradle\/libs\.versions\.toml"\)\)\)/g;
if (content.match(versionCatalogs)) {
  content = content.replace(versionCatalogs, 'from(files(new File(rootDir, "../node_modules/react-native/gradle/libs.versions.toml"))))');
  changed = true;
}

if (changed) {
  fs.writeFileSync(settingsPath, content);
  console.log('fix-settings-gradle: patched ' + ((content.match(/require\.resolve/g) || []).length) + ' require.resolve calls remain (if 0, all fixed)');
} else {
  console.log('fix-settings-gradle: no patterns matched (already patched or unexpected format)');
}
