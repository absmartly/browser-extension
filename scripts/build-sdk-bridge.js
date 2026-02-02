const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const srcDir = path.join(__dirname, '..', 'src', 'sdk-bridge')
const entryFile = path.join(srcDir, 'index.ts')
const outputFile = path.join(__dirname, '..', 'public', 'absmartly-sdk-bridge.bundle.js')

console.log('[SDK Bridge Build] Building SDK bridge bundle...')

try {
  // Check if esbuild is installed
  try {
    execSync('npx esbuild --version', { stdio: 'ignore' })
  } catch {
    console.log('[SDK Bridge Build] Installing esbuild...')
    execSync('npm install --save-dev esbuild', { stdio: 'inherit' })
  }

  // Check if production build
  const isProduction = process.env.NODE_ENV === 'production'

  // Build the bundle
  const buildCommand = [
    'npx',
    'esbuild',
    `"${entryFile}"`,
    '--bundle',
    `--outfile="${outputFile}"`,
    '--format=iife',
    '--global-name=ABSmartlySDKBridge',
    '--platform=browser',
    '--target=es2020',
    '--minify-syntax',
    '--keep-names',
    '--sourcemap',
    '--external:@absmartly/sdk-plugins',
    isProduction ? '--drop:console' : ''
  ].filter(Boolean).join(' ')

  console.log('[SDK Bridge Build] Running esbuild...')
  execSync(buildCommand, { stdio: 'inherit' })

  // Read the bundled output
  let bundledCode = fs.readFileSync(outputFile, 'utf8')

  // Wrap the bundled code to make functions available globally
  const wrappedCode = `
/**
 * ABsmartly SDK Bridge - Bundled Script
 * Bridges extension with ABsmartly SDK on page
 * Version: 1.1.0
 * Built from TypeScript modules
 */

${bundledCode}

// Expose global API for backward compatibility
if (typeof ABSmartlySDKBridge !== 'undefined') {
  // Expose initialization functions
  window.__absmartlyGetVariantAssignments = ABSmartlySDKBridge.getVariantAssignments
  window.__absmartlyGetContextPath = ABSmartlySDKBridge.getContextPath

  // Mark as injected
  window.__absmartlyExtensionInjected = true

  ${!isProduction ? "console.log('[ABsmartly] SDK Bridge loaded successfully - version 1.1.0')" : "// Console removed in production"}
} else {
  console.error('[ABsmartly] Failed to load SDK Bridge - ABSmartlySDKBridge not found')
}
`

  fs.writeFileSync(outputFile, wrappedCode)
  console.log(`[SDK Bridge Build] Successfully built ${outputFile}`)

  // Also copy to build directories if they exist
  const buildDirs = [
    path.join(__dirname, '..', 'build', 'chrome-mv3-dev'),
    path.join(__dirname, '..', 'build', 'chrome-mv3-prod')
  ]

  buildDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const targetFile = path.join(dir, 'absmartly-sdk-bridge.bundle.js')
      fs.copyFileSync(outputFile, targetFile)
      console.log(`[SDK Bridge Build] Copied to ${targetFile}`)

      // Also copy source map
      const sourceMapFile = outputFile + '.map'
      if (fs.existsSync(sourceMapFile)) {
        const targetSourceMap = targetFile + '.map'
        fs.copyFileSync(sourceMapFile, targetSourceMap)
      }
    }
  })

} catch (error) {
  console.error('[SDK Bridge Build] Build failed:', error)
  process.exit(1)
}
