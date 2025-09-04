const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Copy inject-sdk-plugin.js with hash from public to build directory
const injectScriptSource = path.join(publicDir, 'inject-sdk-plugin.js');
if (fs.existsSync(injectScriptSource)) {
  // Read the file content and generate a hash
  const fileContent = fs.readFileSync(injectScriptSource, 'utf8');
  const hash = crypto.createHash('md5').update(fileContent).digest('hex').substring(0, 8);
  const hashedFilename = `inject-sdk-plugin.${hash}.js`;
  
  // Copy to prod build with hash
  const injectScriptDest = path.join(buildDir, hashedFilename);
  fs.copyFileSync(injectScriptSource, injectScriptDest);
  console.log(`Copied inject-sdk-plugin.js as ${hashedFilename} to build directory`);
  
  // Also copy to dev build if it exists
  const devBuildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
  if (fs.existsSync(devBuildDir)) {
    const devInjectScriptDest = path.join(devBuildDir, hashedFilename);
    fs.copyFileSync(injectScriptSource, devInjectScriptDest);
    console.log(`Copied inject-sdk-plugin.js as ${hashedFilename} to dev build directory`);
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

// Copy ABsmartly DOM Changes Plugin from node_modules
const pluginSource = path.join(__dirname, '..', 'node_modules', '@absmartly', 'dom-changes-plugin', 'dist', 'absmartly-dom-changes.min.js');
if (fs.existsSync(pluginSource)) {
  const pluginDestProd = path.join(buildDir, 'absmartly-dom-changes.min.js');
  fs.copyFileSync(pluginSource, pluginDestProd);
  console.log('Copied absmartly-dom-changes.min.js to prod build directory');
  
  if (fs.existsSync(devBuildDir)) {
    const pluginDestDev = path.join(devBuildDir, 'absmartly-dom-changes.min.js');
    fs.copyFileSync(pluginSource, pluginDestDev);
    console.log('Copied absmartly-dom-changes.min.js to dev build directory');
  }
}