import type { FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')

  const rootDir = path.join(__dirname, '..')
  const buildDir = path.join(rootDir, 'build', 'chrome-mv3-dev')
  const manifestPath = path.join(buildDir, 'manifest.json')

  // 1. Check if extension needs to be built
  // Always rebuild the visual editor bundle with test flag for accurate testing
  const visualEditorBundle = path.join(rootDir, '..', 'absmartly-visual-editor-bundles', 'visual-editor-injection.bundle')
  const needsRebuild = !fs.existsSync(manifestPath) || !fs.existsSync(visualEditorBundle)

  if (needsRebuild) {
    console.log('📦 Extension not built. Building now...')
    try {
      // Set environment variable to disable shadow DOM for tests
      process.env.PLASMO_PUBLIC_DISABLE_SHADOW_DOM = 'true'

      execSync('npm run build', {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...process.env, PLASMO_PUBLIC_DISABLE_SHADOW_DOM: 'true' }
      })
      console.log('✅ Extension built successfully (with shadow DOM disabled for tests)')
    } catch (error) {
      console.error('❌ Failed to build extension:', error)
      throw new Error('Extension build failed. Please fix build errors and try again.')
    }
  } else {
    console.log('✅ Extension already built')
    console.log('⚠️  Note: Using existing build. Delete build/chrome-mv3-dev/manifest.json to force rebuild.')
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