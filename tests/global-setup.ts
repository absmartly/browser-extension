import { FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')

  const rootDir = path.join(__dirname, '..')
  const buildDir = path.join(rootDir, 'build', 'chrome-mv3-dev')
  const manifestPath = path.join(buildDir, 'manifest.json')

  // 1. Check if extension needs to be built
  if (!fs.existsSync(manifestPath)) {
    console.log('📦 Extension not built. Building now...')
    try {
      execSync('npm run build', {
        cwd: rootDir,
        stdio: 'inherit'
      })
      console.log('✅ Extension built successfully')
    } catch (error) {
      console.error('❌ Failed to build extension:', error)
      throw new Error('Extension build failed. Please fix build errors and try again.')
    }
  } else {
    console.log('✅ Extension already built')
  }

  // 2. Copy test files to build directory
  const testsDir = path.join(buildDir, 'tests')
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true })
  }

  // Copy seed.html
  const seedSource = path.join(__dirname, 'seed.html')
  const seedDest = path.join(testsDir, 'seed.html')
  if (fs.existsSync(seedSource)) {
    fs.copyFileSync(seedSource, seedDest)
    console.log('✅ Copied seed.html to build directory')
  }

  // Copy local test page
  const testPageSource = path.join(__dirname, 'local-test-page.html')
  const testPageDest = path.join(buildDir, 'local-test-page.html')
  if (fs.existsSync(testPageSource)) {
    fs.copyFileSync(testPageSource, testPageDest)
    console.log('✅ Copied local-test-page.html to build directory')
  }

  // 3. Load environment variables if .env.local exists
  const envPath = path.join(rootDir, '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    })
    console.log('✅ Loaded environment variables from .env.local')
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