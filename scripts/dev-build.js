const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');
const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');

function buildVisualEditor() {
  console.log('[Dev Build] Building visual editor...');
  try {
    execSync('node scripts/build-visual-editor.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('[Dev Build] Failed to build visual editor:', error);
  }
}

function copyWithHash() {
  if (!fs.existsSync(devBuildDir)) {
    // Dev build directory doesn't exist yet, wait
    setTimeout(copyWithHash, 1000);
    return;
  }

  // Build visual editor first
  buildVisualEditor();

  // Copy SDK bridge bundle to dev build
  const sdkBridgeSource = path.join(publicDir, 'absmartly-sdk-bridge.bundle.js');
  const sdkBridgeDest = path.join(devBuildDir, 'absmartly-sdk-bridge.bundle.js');
  if (fs.existsSync(sdkBridgeSource)) {
    fs.copyFileSync(sdkBridgeSource, sdkBridgeDest);
    console.log('[Dev Build] Copied absmartly-sdk-bridge.bundle.js');
  } else {
    console.warn('[Dev Build] Warning: absmartly-sdk-bridge.bundle.js not found in public directory');
  }

  // Copy SDK plugins dev bundle to dev build
  const sdkPluginsSource = path.join(publicDir, 'absmartly-sdk-plugins.dev.js');
  const sdkPluginsDest = path.join(devBuildDir, 'absmartly-sdk-plugins.dev.js');
  if (fs.existsSync(sdkPluginsSource)) {
    fs.copyFileSync(sdkPluginsSource, sdkPluginsDest);
    console.log('[Dev Build] Copied absmartly-sdk-plugins.dev.js');
  } else {
    console.warn('[Dev Build] Warning: absmartly-sdk-plugins.dev.js not found in public directory');
  }

  // Update manifest to include visual editor and SDK plugins in web_accessible_resources
  const manifestPath = path.join(devBuildDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
        const resources = manifest.web_accessible_resources[0].resources;
        const visualEditorResource = 'src/injected/build/visual-editor-injection.js';
        const sdkPluginsResource = 'absmartly-sdk-plugins.dev.js';

        let modified = false;
        if (!resources.includes(visualEditorResource)) {
          resources.push(visualEditorResource);
          modified = true;
          console.log('[Dev Build] Added visual-editor-injection.js to web accessible resources');
        }
        if (!resources.includes(sdkPluginsResource)) {
          resources.push(sdkPluginsResource);
          modified = true;
          console.log('[Dev Build] Added absmartly-sdk-plugins.dev.js to web accessible resources');
        }

        if (modified) {
          fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        }
      }
    } catch (err) {
      console.error('[Dev Build] Error updating manifest:', err);
    }
  }
}

// Watch for changes in dev mode
if (process.argv.includes('--watch')) {
  console.log('[Dev Build] Watching visual-editor for changes...');

  // Initial copy
  setTimeout(copyWithHash, 2000);

  // Watch visual editor directory for changes
  const visualEditorDir = path.join(__dirname, '..', 'src', 'visual-editor');

  function watchVisualEditorDir(dir) {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.css'))) {
        console.log(`[Dev Build] Change detected in visual-editor: ${filename}`);
        buildVisualEditor();
      }
    });
  }

  if (fs.existsSync(visualEditorDir)) {
    watchVisualEditorDir(visualEditorDir);
    console.log('[Dev Build] Watching visual-editor directory for changes');
  }
} else {
  // Single copy
  copyWithHash();
}
