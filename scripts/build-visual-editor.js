const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'src', 'visual-editor');
const buildDir = path.join(__dirname, '..', '..', 'absmartly-visual-editor-bundles');
const entryFile = path.join(srcDir, 'index.ts');
const outputFile = path.join(buildDir, 'visual-editor-injection.bundle');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

console.log('[Visual Editor Build] Building unified visual editor script...');

// Use esbuild to bundle the TypeScript modules
try {
  // Check if esbuild is installed
  try {
    execSync('npx esbuild --version', { stdio: 'ignore' });
  } catch {
    console.log('[Visual Editor Build] Installing esbuild...');
    execSync('npm install --save-dev esbuild', { stdio: 'inherit' });
  }

  // Build the bundle
  const buildCommand = `npx esbuild "${entryFile}" --bundle --outfile="${outputFile}" --format=iife --global-name=ABSmartlyVisualEditor --platform=browser --target=es2020 --minify-syntax --keep-names --external:chrome`;

  console.log('[Visual Editor Build] Running esbuild...');
  execSync(buildCommand, { stdio: 'inherit' });

  // Read the bundled output
  let bundledCode = fs.readFileSync(outputFile, 'utf8');

  // Wrap the bundled code to make initVisualEditor available globally
  const wrappedCode = `
/**
 * ABsmartly Unified Visual Editor - Bundled Script
 * Built from modular TypeScript components with rich UI
 * Version: 3.0.0-unified
 */

${bundledCode}

// Make visual editor functions available globally when injected
if (typeof ABSmartlyVisualEditor !== 'undefined') {
  // Primary initialization function
  if (ABSmartlyVisualEditor.initVisualEditor) {
    window.initVisualEditor = ABSmartlyVisualEditor.initVisualEditor;
  }

  // Also expose the entire unified API for advanced usage
  window.ABSmartlyVisualEditor = ABSmartlyVisualEditor;

  console.log('[ABSmartly] Unified visual editor bundled script loaded successfully');
  console.log('[ABSmartly] Visual editor version:', ABSmartlyVisualEditor.VISUAL_EDITOR_VERSION || '3.0.0-unified');
} else {
  console.error('[ABSmartly] Failed to load visual editor bundle - ABSmartlyVisualEditor not found');
}

// Return the result when called from background script
if (typeof variantName !== 'undefined' && typeof experimentName !== 'undefined') {
  window.initVisualEditor(variantName, experimentName, logoUrl, initialChanges);
}
`;

  fs.writeFileSync(outputFile, wrappedCode);
  console.log(`[Visual Editor Build] Successfully built ${outputFile}`);

  // Also copy to build directories if they exist
  const buildDirs = [
    path.join(__dirname, '..', 'build', 'chrome-mv3-dev'),
    path.join(__dirname, '..', 'build', 'chrome-mv3-prod')
  ];

  buildDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const targetDir = path.join(dir, 'src', 'injected', 'build');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const targetFile = path.join(targetDir, 'visual-editor-injection.js');
      // Copy as .js for runtime usage
      const bundleContent = fs.readFileSync(outputFile, 'utf8');
      fs.writeFileSync(targetFile, bundleContent);
      console.log(`[Visual Editor Build] Copied to ${targetFile}`);
    }
  });

} catch (error) {
  console.error('[Visual Editor Build] Build failed:', error);
  process.exit(1);
}