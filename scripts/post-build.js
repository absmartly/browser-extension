const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Copy sidebar files from tabs folder to root for injection
// Build the visual editor first
console.log('Building visual editor...');
try {
  execSync('node scripts/build-visual-editor.js', {
    stdio: 'inherit',
    env: process.env  // Pass through all environment variables including PLASMO_PUBLIC_DISABLE_SHADOW_DOM
  });
} catch (error) {
  console.error('Failed to build visual editor:', error);
}

const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod');
const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
const tabsDir = path.join(buildDir, 'tabs');
const publicDir = path.join(__dirname, '..', 'public');
const manifestPath = path.join(buildDir, 'manifest.json');

// Visual editor bundled script paths
const visualEditorSource = path.join(__dirname, '..', '..', 'absmartly-visual-editor-bundles', 'visual-editor-injection.bundle');

if (fs.existsSync(tabsDir)) {
  const files = fs.readdirSync(tabsDir);
  const sidebarFiles = [];
  
  files.forEach(file => {
    if (file.startsWith('sidebar') && (file.endsWith('.js') || file.endsWith('.css'))) {
      const source = path.join(tabsDir, file);
      const dest = path.join(buildDir, file);
      fs.copyFileSync(source, dest);
      console.log(`Copied ${file} to root`);
      sidebarFiles.push(file);
    }
  });
  
  // Update manifest with exact filenames
  if (sidebarFiles.length > 0 && fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Find web_accessible_resources and add exact sidebar files
    if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
      const resources = manifest.web_accessible_resources[0].resources;
      
      // Remove glob patterns and add exact files
      const filteredResources = resources.filter(r => !r.startsWith('sidebar.'));
      manifest.web_accessible_resources[0].resources = [...filteredResources, ...sidebarFiles];
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      console.log('Updated manifest with exact sidebar filenames');
    }
  }
}

// Copy inject-sdk-plugin.js with hash from public to build directory
const injectScriptSource = path.join(publicDir, 'inject-sdk-plugin.js');
if (fs.existsSync(injectScriptSource)) {
  let fileContent = fs.readFileSync(injectScriptSource, 'utf8');

  // Minify for production to remove console statements
  if (process.env.NODE_ENV === 'production') {
    try {
      const { execSync } = require('child_process');
      const tempInput = path.join(__dirname, '..', 'temp-inject-input.js');
      const tempOutput = path.join(__dirname, '..', 'temp-inject-output.js');

      fs.writeFileSync(tempInput, fileContent);
      execSync(`npx esbuild "${tempInput}" --minify --drop:console --outfile="${tempOutput}"`, { stdio: 'inherit' });
      fileContent = fs.readFileSync(tempOutput, 'utf8');

      // Clean up temp files
      fs.unlinkSync(tempInput);
      fs.unlinkSync(tempOutput);
      console.log('Minified inject-sdk-plugin.js for production (console removed)');
    } catch (error) {
      console.warn('Failed to minify inject-sdk-plugin.js, using original:', error.message);
      fileContent = fs.readFileSync(injectScriptSource, 'utf8');
    }
  }

  // Generate hash from processed content
  const hash = crypto.createHash('md5').update(fileContent).digest('hex').substring(0, 8);
  const hashedFilename = `inject-sdk-plugin.${hash}.js`;

  // Write to prod build with hash
  const injectScriptDest = path.join(buildDir, hashedFilename);
  fs.writeFileSync(injectScriptDest, fileContent);
  console.log(`Copied inject-sdk-plugin.js as ${hashedFilename} to build directory`);
  
  // Also copy to dev build if it exists (use original unminified version)
  const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
  if (fs.existsSync(devBuildDir)) {
    const devInjectScriptDest = path.join(devBuildDir, hashedFilename);
    // Always use original for dev build
    const devFileContent = fs.readFileSync(injectScriptSource, 'utf8');
    fs.writeFileSync(devInjectScriptDest, devFileContent);
    console.log(`Copied inject-sdk-plugin.js as ${hashedFilename} to dev build directory (unminified)`);
  }
  
  // Create a mapping file so the content script knows which file to load
  const mappingData = { filename: hashedFilename, hash: hash };
  const mappingPath = path.join(buildDir, 'inject-sdk-plugin-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mappingData));
  console.log('Created inject-sdk-plugin-mapping.json');
  
  if (fs.existsSync(devBuildDir)) {
    const devMappingPath = path.join(devBuildDir, 'inject-sdk-plugin-mapping.json');
    fs.writeFileSync(devMappingPath, JSON.stringify(mappingData));
    console.log('Created inject-sdk-plugin-mapping.json in dev build');
  }
  
  // Clean up old versioned files (optional)
  [buildDir, devBuildDir].forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        if (file.startsWith('inject-sdk-plugin.') && file.endsWith('.js') && file !== hashedFilename) {
          fs.unlinkSync(path.join(dir, file));
          console.log(`Removed old version: ${file}`);
        }
      });
    }
  });
}



// Copy visual editor bundled script
if (fs.existsSync(visualEditorSource)) {
  // Create the src/injected/build directory structure in both build directories
  [buildDir, devBuildDir].forEach(targetDir => {
    if (fs.existsSync(targetDir)) {
      const srcDir = path.join(targetDir, 'src');
      const injectedDir = path.join(srcDir, 'injected');
      const buildSubDir = path.join(injectedDir, 'build');

      // Create directories if they don't exist
      if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);
      if (!fs.existsSync(injectedDir)) fs.mkdirSync(injectedDir);
      if (!fs.existsSync(buildSubDir)) fs.mkdirSync(buildSubDir);

      // Copy the visual editor script
      const dest = path.join(buildSubDir, 'visual-editor-injection.js');
      fs.copyFileSync(visualEditorSource, dest);
      console.log(`Copied visual-editor-injection.js to ${targetDir}`);
    }
  });

  // Add to web accessible resources
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
    const resources = manifest.web_accessible_resources[0].resources;
    const visualEditorResource = 'src/injected/build/visual-editor-injection.js';

    if (!resources.includes(visualEditorResource)) {
      resources.push(visualEditorResource);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('Added visual-editor-injection.js to web accessible resources');
    }
  }
}

// Copy SDK bridge bundle to build directories
const sdkBridgeSource = path.join(__dirname, '..', 'public', 'absmartly-sdk-bridge.bundle.js');
const sdkBridgeSourceMap = sdkBridgeSource + '.map';

if (fs.existsSync(sdkBridgeSource)) {
  [buildDir, devBuildDir].forEach(dir => {
    if (fs.existsSync(dir)) {
      const targetFile = path.join(dir, 'absmartly-sdk-bridge.bundle.js');
      fs.copyFileSync(sdkBridgeSource, targetFile);
      console.log(`Copied SDK bridge bundle to ${dir}`);

      // Also copy source map if it exists
      if (fs.existsSync(sdkBridgeSourceMap)) {
        const targetSourceMap = targetFile + '.map';
        fs.copyFileSync(sdkBridgeSourceMap, targetSourceMap);
      }
    }
  });
}

// Console stripping removed - post-build minification was corrupting already-minified files
// The SWC patch and optimized debug utilities provide sufficient console reduction

