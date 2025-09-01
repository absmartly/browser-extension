const fs = require('fs');
const path = require('path');

// Copy sidebar files from tabs folder to root for injection
const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod');
const tabsDir = path.join(buildDir, 'tabs');
const publicDir = path.join(__dirname, '..', 'public');
const manifestPath = path.join(buildDir, 'manifest.json');

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

// Copy inject-sdk-plugin.js from public to build directory
const injectScriptSource = path.join(publicDir, 'inject-sdk-plugin.js');
const injectScriptDest = path.join(buildDir, 'inject-sdk-plugin.js');
if (fs.existsSync(injectScriptSource)) {
  fs.copyFileSync(injectScriptSource, injectScriptDest);
  console.log('Copied inject-sdk-plugin.js to build directory');
}

// Also copy to dev build if it exists
const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
if (fs.existsSync(devBuildDir)) {
  const devInjectScriptDest = path.join(devBuildDir, 'inject-sdk-plugin.js');
  if (fs.existsSync(injectScriptSource)) {
    fs.copyFileSync(injectScriptSource, devInjectScriptDest);
    console.log('Copied inject-sdk-plugin.js to dev build directory');
  }
}