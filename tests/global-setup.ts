import type { FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const getLatestMtimeMs = (targetPath: string): number => {
  if (!fs.existsSync(targetPath)) return 0
  const stats = fs.statSync(targetPath)
  if (!stats.isDirectory()) {
    return stats.mtimeMs
  }

  const entries = fs.readdirSync(targetPath)
  let latest = stats.mtimeMs
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry)
    const entryMtime = getLatestMtimeMs(entryPath)
    if (entryMtime > latest) latest = entryMtime
  }

  return latest
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')

  const rootDir = path.join(__dirname, '..')
  const buildDir = path.join(rootDir, 'build', 'chrome-mv3-dev')
  const manifestPath = path.join(buildDir, 'manifest.json')

  // 1. Check if extension needs to be built
  // Always rebuild the visual editor bundle with test flag for accurate testing
  const visualEditorBundle = path.join(rootDir, '..', 'absmartly-visual-editor-bundles', 'visual-editor-injection.bundle')
  const sourcePaths = [
    path.join(rootDir, 'src'),
    path.join(rootDir, 'content'),
    path.join(rootDir, 'background'),
    path.join(rootDir, 'public'),
    path.join(rootDir, 'assets'),
    path.join(rootDir, 'index.tsx'),
    path.join(rootDir, 'content.ts'),
    path.join(rootDir, 'background.ts')
  ]

  const buildMtime = fs.existsSync(manifestPath) ? fs.statSync(manifestPath).mtimeMs : 0
  const latestSourceMtime = Math.max(...sourcePaths.map(getLatestMtimeMs))
  const needsRebuild =
    !fs.existsSync(manifestPath) ||
    !fs.existsSync(visualEditorBundle) ||
    latestSourceMtime > buildMtime

  if (needsRebuild) {
    console.log('📦 Extension not built. Building now...')
    try {
      // Set environment variable to disable shadow DOM for tests
      process.env.PLASMO_PUBLIC_DISABLE_SHADOW_DOM = 'true'

      // Pass NODE_ENV=development explicitly: `plasmo build` defaults to
      // production, which in turn makes src/utils/debug.ts strip every
      // debugLog/debugWarn call. Several e2e specs (ai-session-image,
      // ai-conversation-history, ...) assert on specific console output
      // the app emits via debugLog, so running them against a production
      // bundle drops those messages and the assertions fail with
      // "Expected > 0, Received 0". `--tag=dev` on its own only namespaces
      // the output directory; it doesn't change NODE_ENV.
      execSync('plasmo build --tag=dev --src-path=.', {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'development',
          PLASMO_PUBLIC_DISABLE_SHADOW_DOM: 'true'
        }
      })
      console.log('✅ Extension built successfully in DEV mode (with shadow DOM disabled for tests)')
    } catch (error) {
      console.error('❌ Failed to build extension:', error)
      throw new Error('Extension build failed. Please fix build errors and try again.')
    }
  } else {
    console.log('✅ Extension already built')
    console.log('⚠️  Note: Using existing build. Delete build/chrome-mv3-dev/manifest.json to force rebuild.')
  }

  // `plasmo build` wipes the build directory before re-emitting files, so if
  // it runs (either because the build is missing or because an mtime check
  // triggered it), the SDK bridge bundle that `scripts/build-dev-once.sh`
  // copied in `bun run build:dev` is lost. Re-copy it here so tests that
  // inject `chrome-extension://.../absmartly-sdk-bridge.bundle.js` (e.g.
  // csp-js-preview-fixture.spec.ts) don't hit ERR_FILE_NOT_FOUND.
  const sdkBridgeBundleSrc = path.join(rootDir, 'public', 'absmartly-sdk-bridge.bundle.js')
  const sdkBridgeBundleDest = path.join(buildDir, 'absmartly-sdk-bridge.bundle.js')
  if (fs.existsSync(sdkBridgeBundleSrc) && fs.existsSync(buildDir)) {
    fs.copyFileSync(sdkBridgeBundleSrc, sdkBridgeBundleDest)
    const sdkBridgeBundleMapSrc = `${sdkBridgeBundleSrc}.map`
    const sdkBridgeBundleMapDest = `${sdkBridgeBundleDest}.map`
    if (fs.existsSync(sdkBridgeBundleMapSrc)) {
      fs.copyFileSync(sdkBridgeBundleMapSrc, sdkBridgeBundleMapDest)
    }
    console.log('✅ Ensured absmartly-sdk-bridge.bundle.js is present in build directory')
  }

  // 2. Copy test files to build directory
  const testsDir = path.join(buildDir, 'tests')
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true })
  }

  // Copy seed.html and seed.js
  const seedHtmlSource = path.join(__dirname, 'seed.html')
  const seedHtmlDest = path.join(testsDir, 'seed.html')
  if (fs.existsSync(seedHtmlSource)) {
    fs.copyFileSync(seedHtmlSource, seedHtmlDest)
    console.log('✅ Copied seed.html to build directory')
  }

  const seedJsSource = path.join(__dirname, 'seed.js')
  const seedJsDest = path.join(testsDir, 'seed.js')
  if (fs.existsSync(seedJsSource)) {
    fs.copyFileSync(seedJsSource, seedJsDest)
    console.log('✅ Copied seed.js to build directory')
  }

  // Copy local test page
  const testPageSource = path.join(__dirname, 'local-test-page.html')
  const testPageDest = path.join(buildDir, 'local-test-page.html')
  if (fs.existsSync(testPageSource)) {
    fs.copyFileSync(testPageSource, testPageDest)
    console.log('✅ Copied local-test-page.html to build directory')
  }

  // 3. Load environment variables from .env.dev.local
  const envPath = path.join(rootDir, '.env.dev.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return

      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    })
    console.log('✅ Loaded environment variables from .env.dev.local')
  }

  // 4. Verify API credentials are available
  const apiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
  const apiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT

  if (!apiKey || !apiEndpoint) {
    console.warn('⚠️ API credentials not found in environment variables')
    console.warn('   Tests will use default test credentials')
  } else {
    console.log('✅ API credentials found in environment')
  }

  console.log('✅ Global setup completed successfully')
  console.log('---')
}

export default globalSetup
