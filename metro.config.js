const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Fix: react-async-hook@3.6.1 has a broken package.json ──────────────────
// Its "module" field points to "react-async-hook.esm.js" at the package root,
// but the file actually lives at dist/react-async-hook.esm.js, so Metro fails to
// resolve it (pulled in transitively by react-native-country-picker-modal).
// Its "main" (dist/index.js, a valid CJS entry) is correct, so redirect just
// this one package there. Surgical — no global resolverMainFields / package-
// exports changes, and the critical getDefaultConfig(__dirname) above is intact.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-async-hook') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/react-async-hook/dist/index.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
