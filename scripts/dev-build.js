const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// This script copies inject-sdk-plugin.js with a hash for dev builds
const publicDir = path.join(__dirname, '..', 'public');
const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
const injectScriptSource = path.join(publicDir, 'inject-sdk-plugin.js');

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



  if (fs.existsSync(injectScriptSource)) {
    // Read the file content and generate a hash
    const fileContent = fs.readFileSync(injectScriptSource, 'utf8');
    const hash = crypto.createHash('md5').update(fileContent).digest('hex').substring(0, 8);
    const hashedFilename = `inject-sdk-plugin.${hash}.js`;

    // Copy to dev build with hash
    const injectScriptDest = path.join(devBuildDir, hashedFilename);
    fs.copyFileSync(injectScriptSource, injectScriptDest);
    console.log(`[Dev Build] Copied inject-sdk-plugin.js as ${hashedFilename}`);

    // Create a mapping file
    const mappingData = { filename: hashedFilename, hash: hash, timestamp: Date.now() };
    const mappingPath = path.join(devBuildDir, 'inject-sdk-plugin-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));
    console.log('[Dev Build] Updated inject-sdk-plugin-mapping.json');

    // Clean up old versioned files
    const files = fs.readdirSync(devBuildDir);
    files.forEach(file => {
      if (file.startsWith('inject-sdk-plugin.') && file.endsWith('.js') && file !== hashedFilename) {
        fs.unlinkSync(path.join(devBuildDir, file));
        console.log(`[Dev Build] Removed old version: ${file}`);
      }
    });
  }

  // Update manifest to include visual editor in web_accessible_resources
  const manifestPath = path.join(devBuildDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
        const resources = manifest.web_accessible_resources[0].resources;
        const visualEditorResource = 'src/injected/build/visual-editor-injection.js';

        if (!resources.includes(visualEditorResource)) {
          resources.push(visualEditorResource);
          fs.writeFileSync(manifestPath, JSON.stringify(manifest));
          console.log('[Dev Build] Added visual-editor-injection.js to web accessible resources');
        }
      }
    } catch (err) {
      console.error('[Dev Build] Error updating manifest:', err);
    }
  }
}

// Watch for changes in dev mode
if (process.argv.includes('--watch')) {
  console.log('[Dev Build] Watching inject-sdk-plugin.js and visual-editor for changes...');

  // Initial copy
  setTimeout(copyWithHash, 2000);

  // Watch inject-sdk-plugin.js for changes
  fs.watchFile(injectScriptSource, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('[Dev Build] Change detected in inject-sdk-plugin.js');
      copyWithHash();
    }
  });

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