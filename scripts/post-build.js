const fs = require('fs');
const path = require('path');

// Copy sidebar files from tabs folder to root for injection
const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod');
const tabsDir = path.join(buildDir, 'tabs');

if (fs.existsSync(tabsDir)) {
  const files = fs.readdirSync(tabsDir);
  
  files.forEach(file => {
    if (file.startsWith('sidebar') && (file.endsWith('.js') || file.endsWith('.css'))) {
      const source = path.join(tabsDir, file);
      const dest = path.join(buildDir, file);
      fs.copyFileSync(source, dest);
      console.log(`Copied ${file} to root`);
    }
  });
}