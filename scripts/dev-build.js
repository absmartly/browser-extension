const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// This script copies inject-sdk-plugin.js with a hash for dev builds
const publicDir = path.join(__dirname, '..', 'public');
const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
const injectScriptSource = path.join(publicDir, 'inject-sdk-plugin.js');

function copyWithHash() {
  if (!fs.existsSync(devBuildDir)) {
    // Dev build directory doesn't exist yet, wait
    setTimeout(copyWithHash, 1000);
    return;
  }

  // Copy DOM Changes plugin - use development build for dev builds
  const sdkPluginDir = path.join(__dirname, '..', '..', 'absmartly-dom-changes-sdk-plugin', 'dist');
  const pluginDevSource = path.join(sdkPluginDir, 'absmartly-dom-changes.dev.js');
  const pluginProdSource = path.join(publicDir, 'absmartly-dom-changes.min.js');
  
  // Try to use dev build from SDK plugin repo, fallback to production build
  let pluginSource = pluginDevSource;
  let pluginFilename = 'absmartly-dom-changes.dev.js';
  
  if (!fs.existsSync(pluginDevSource)) {
    console.log('[Dev Build] SDK plugin dev build not found, using production build');
    pluginSource = pluginProdSource;
    pluginFilename = 'absmartly-dom-changes.min.js';
  }
  
  if (fs.existsSync(pluginSource)) {
    const pluginDest = path.join(devBuildDir, pluginFilename);
    fs.copyFileSync(pluginSource, pluginDest);
    console.log(`[Dev Build] Copied ${pluginFilename}`);
    
    // Also copy source map if using dev build
    if (pluginSource === pluginDevSource) {
      const mapSource = pluginDevSource + '.map';
      if (fs.existsSync(mapSource)) {
        const mapDest = path.join(devBuildDir, pluginFilename + '.map');
        fs.copyFileSync(mapSource, mapDest);
        console.log(`[Dev Build] Copied ${pluginFilename}.map`);
      }
    }
  }

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
}

// Watch for changes in dev mode
if (process.argv.includes('--watch')) {
  console.log('[Dev Build] Watching inject-sdk-plugin.js for changes...');
  
  // Initial copy
  setTimeout(copyWithHash, 2000);
  
  // Watch for changes
  fs.watchFile(injectScriptSource, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('[Dev Build] Change detected in inject-sdk-plugin.js');
      copyWithHash();
    }
  });
} else {
  // Single copy
  copyWithHash();
}