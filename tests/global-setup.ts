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
  // CI runs e2e against the production bundle so Parcel/Plasmo bundling
  // regressions are caught before they reach Chrome Web Store. Locally we
  // keep using chrome-mv3-dev because `bun run build:dev` (plasmo dev
  // --no-hot-reload) is the normal authoring loop. CI's workflow is
  // responsible for running `bun run build` before invoking the e2e job;
  // this script never tries to produce the prod bundle on its own.
  const buildName = process.env.CI ? 'chrome-mv3-prod' : 'chrome-mv3-dev'
  const buildDir = path.join(rootDir, 'build', buildName)
  const manifestPath = path.join(buildDir, 'manifest.json')

  // 1. Check if extension needs to be built.
  //
  // Note: we deliberately do NOT gate the rebuild on the presence of
  // ../absmartly-visual-editor-bundles/visual-editor-injection.bundle here.
  // That sister-repo file is unrelated to whether the extension build is up
  // to date, and treating it as a trigger forced `plasmo build --tag=dev` to
  // run on every CI invocation (the sister dir is never present in CI).
  // That second build wiped the working artifact produced by
  // `bun run build:dev` (plasmo dev --no-hot-reload) and replaced it with a
  // production-style bundle in which Parcel externalises @plasmohq/storage,
  // making every iframe sidebar load fail with
  //   "PAGE ERROR: Cannot find module '@plasmohq/storage'"
  // and 116 e2e tests time out waiting for a body that React never gets to
  // render. If a contributor genuinely needs the visual-editor bundle they
  // can run its own build separately.
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
    latestSourceMtime > buildMtime

  if (needsRebuild) {
    if (process.env.CI) {
      // CI: don't auto-rebuild. The workflow is responsible for running
      // `bun run build` before this point. If we got here without a manifest
      // something upstream is wrong; fail loudly.
      throw new Error(
        `CI: production extension build missing at ${buildDir}. The CI workflow must run 'bun run build' before invoking e2e tests.`
      )
    }

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
    console.log(`✅ Extension already built (${buildName})`)
    console.log(`⚠️  Note: Using existing build at ${buildDir}. Delete its manifest.json to force rebuild.`)
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

  // 5. Pre-fetch /v1/* editor resources ONCE so every test context can
  // seed its cache instead of triggering 6 concurrent calls per sidebar
  // mount. Under workers=4 + 4 CI shards = 16 sidebars in flight that
  // burst saturates the API and the unit-type-select dropdown stays
  // disabled for 30-90s. Pre-fetch reduces it to 6 calls total per CI
  // shard at suite start.
  if (apiKey && apiEndpoint) {
    const cachePath = path.join(rootDir, '.editor-resources-cache.json')
    // Endpoint env var sometimes ends in /v1 and sometimes doesn't, depending
    // on which environment the workflow points at. Strip the trailing slash
    // and the optional /v1 so we can append /v1/<resource> deterministically.
    const baseEndpoint = apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
    const fetchOne = async (resource: string): Promise<unknown[]> => {
      try {
        const res = await fetch(`${baseEndpoint}/v1/${resource}?items=200`, {
          headers: {
            Authorization: `Api-Key ${apiKey}`,
            Accept: 'application/json'
          }
        })
        if (!res.ok) {
          console.warn(`[globalSetup] Pre-fetch ${resource} failed: ${res.status}`)
          return []
        }
        const data = await res.json()
        const arr = data?.[resource] ?? (Array.isArray(data) ? data : [])
        return Array.isArray(arr) ? arr : []
      } catch (err) {
        console.warn(`[globalSetup] Pre-fetch ${resource} threw:`, (err as Error).message)
        return []
      }
    }
    const [applications, unitTypes, metrics, tags, owners, teams] = await Promise.all([
      fetchOne('applications'),
      fetchOne('unit_types'),
      fetchOne('metrics'),
      fetchOne('experiment_tags'),
      fetchOne('users'),
      fetchOne('teams')
    ])
    fs.writeFileSync(
      cachePath,
      JSON.stringify({ applications, unitTypes, metrics, tags, owners, teams, timestamp: Date.now() })
    )
    console.log(`✅ Pre-fetched editor resources (apps:${applications.length}, unitTypes:${unitTypes.length}, metrics:${metrics.length}, tags:${tags.length}, owners:${owners.length}, teams:${teams.length}) → ${cachePath}`)

    // Pre-fetch the experiments list too. Several tests
    // (ai-chat-mount, ai-chat-fix-test) navigate to a page and click on
    // the first .experiment-item, which requires /v1/experiments to
    // return — under workers=4 + 4 CI shards = 16 concurrent fetches that
    // call can take 60s+. Seeding chrome.storage.local's
    // experiments-cache lets the sidebar render the list immediately
    // from cache while the fresh fetch happens in the background.
    const experimentsCachePath = path.join(rootDir, '.experiments-cache.json')
    try {
      const res = await fetch(
        `${baseEndpoint}/v1/experiments?items=20&page=1`,
        {
          headers: {
            Authorization: `Api-Key ${apiKey}`,
            Accept: 'application/json'
          }
        }
      )
      if (res.ok) {
        const data = await res.json()
        const experiments = (data?.experiments as unknown[]) ?? []
        // Strip aggressively to fit chrome.storage.sync's 8KB per-item
        // quota. Tests just need .experiment-item to render — they don't
        // touch variants or any other heavy field. The validation schema
        // (CachedExperimentSchema) requires id, name, state.
        const minimal = (Array.isArray(experiments) ? experiments : []).map(
          (exp: any) => ({
            id: exp.id,
            name: exp.name,
            display_name: exp.display_name ?? exp.name,
            state: exp.state ?? 'ready',
            variants: []
          })
        )
        fs.writeFileSync(
          experimentsCachePath,
          JSON.stringify({ version: 1, experiments: minimal, timestamp: Date.now() })
        )
        console.log(`✅ Pre-fetched experiments (count:${minimal.length}) → ${experimentsCachePath}`)
      } else {
        console.warn(`[globalSetup] Pre-fetch experiments failed: ${res.status}`)
      }
    } catch (err) {
      console.warn(`[globalSetup] Pre-fetch experiments threw:`, (err as Error).message)
    }
  }

  console.log('✅ Global setup completed successfully')
  console.log('---')
}

export default globalSetup
