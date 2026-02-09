const fs = require('fs');
const path = require('path');
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
