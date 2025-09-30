const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public');
const entryPoint = path.join(__dirname, '..', 'src', 'plugin-extensions', 'browser-bundle.ts');

async function bundle() {
  try {
    console.log('[Bundle] Building Extension DOM Plugin...');

    // Development build
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile: path.join(outDir, 'absmartly-extension-plugin.dev.js'),
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      sourcemap: true,
      minify: false,
      globalName: 'ABsmartlyExtensionPlugin'
    });

    console.log('[Bundle] Created absmartly-extension-plugin.dev.js');

    // Production build
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile: path.join(outDir, 'absmartly-extension-plugin.min.js'),
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      sourcemap: false,
      minify: true,
      globalName: 'ABsmartlyExtensionPlugin'
    });

    console.log('[Bundle] Created absmartly-extension-plugin.min.js');
    console.log('[Bundle] Extension plugin bundled successfully!');

  } catch (error) {
    console.error('[Bundle] Error building extension plugin:', error);
    process.exit(1);
  }
}

bundle();
