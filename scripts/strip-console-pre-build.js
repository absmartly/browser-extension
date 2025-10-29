const fs = require('fs');
const path = require('path');
const glob = require('glob');

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log('[Pre-Build] Skipping console stripping (not production)');
  process.exit(0);
}

console.log('[Pre-Build] Stripping console statements from source...');

const srcDir = path.join(__dirname, '..', 'src');
const jsFiles = glob.sync(`${srcDir}/**/*.{ts,tsx,js,jsx}`, {
  ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
});

let filesModified = 0;
let totalStripped = 0;

for (const filePath of jsFiles) {
  try {
    let code = fs.readFileSync(filePath, 'utf8');
    const originalCode = code;

    const patterns = [
      /console\.log\([^;]*\);\n?/g,
      /console\.debug\([^;]*\);\n?/g,
      /console\.info\([^;]*\);\n?/g,
      /console\.trace\([^;]*\);\n?/g
    ];

    let strippedCount = 0;
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        strippedCount += matches.length;
        code = code.replace(pattern, '');
      }
    }

    if (code !== originalCode) {
      fs.writeFileSync(filePath, code, 'utf8');
      filesModified++;
      totalStripped += strippedCount;
      console.log(`[Pre-Build] Stripped ${strippedCount} console statements from ${path.relative(srcDir, filePath)}`);
    }
  } catch (error) {
    console.error(`[Pre-Build] Error processing ${filePath}:`, error.message);
  }
}

console.log(`[Pre-Build] Complete: ${totalStripped} statements removed from ${filesModified} source files`);
