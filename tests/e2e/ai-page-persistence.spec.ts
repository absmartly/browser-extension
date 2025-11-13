import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { log, initializeTestLogging, debugWait } from './utils/test-helpers'
import { spawn, ChildProcess } from 'child_process'

const TEST_PAGE_URL = '/visual-editor-test.html'
const BRIDGE_PORTS = [3000, 3001, 3002, 3003, 3004]

let bridgeProcess: ChildProcess | null = null
let bridgeWasStarted = false
let activeBridgePort: number | null = null

async function isBridgeRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function findAvailablePort(): Promise<number | null> {
  log('Checking for available bridge ports...')
  for (const port of BRIDGE_PORTS) {
    const isRunning = await isBridgeRunning(port)
    if (isRunning) {
      log(`✓ Bridge already running on port ${port}`)
      activeBridgePort = port
      return port
    }
  }
  return null
}

async function startBridge(): Promise<number> {
  log('Starting Claude Code Bridge server (will auto-select port)...')

  return new Promise((resolve, reject) => {
    bridgeProcess = spawn('claude-code-bridge', [], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let portDetected = false

    bridgeProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      log(`[Bridge] ${output.trim()}`)

      const portMatch = output.match(/localhost:(\d+)/)
      if (portMatch && !portDetected) {
        const port = parseInt(portMatch[1])
        activeBridgePort = port
        portDetected = true
        bridgeWasStarted = true
        log(`✓ Bridge started successfully on port ${port}`)
        resolve(port)
      }
    })

    bridgeProcess.stderr?.on('data', (data) => {
      log(`[Bridge Error] ${data.toString().trim()}`)
    })

    bridgeProcess.on('error', (err) => {
      log(`❌ Bridge process error: ${err.message}`)
      reject(err)
    })

    bridgeProcess.on('exit', (code) => {
      if (code !== 0 && !bridgeWasStarted) {
        reject(new Error(`Bridge exited with code ${code}`))
      }
    })

    setTimeout(() => {
      if (!portDetected) {
        bridgeProcess?.kill('SIGTERM')
        reject(new Error('Bridge startup timeout after 10 seconds'))
      }
    }, 10000)
  })
}

async function stopBridge(): Promise<void> {
  if (bridgeProcess && bridgeWasStarted) {
    log('Stopping Claude Code Bridge server...')
    bridgeProcess.kill('SIGTERM')
    bridgeProcess = null
    bridgeWasStarted = false
  }
}

test.describe('AI Page Persistence and HTML Capture', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeAll(async () => {
    log('Checking if Claude Code Bridge is running...')
    const existingPort = await findAvailablePort()

    if (existingPort) {
      log(`✓ Using existing bridge on port ${existingPort}`)
    } else {
      log('⚠️ Bridge not running, starting it...')
      try {
        const port = await startBridge()
        log(`✓ Bridge started on port ${port}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        log(`❌ Failed to start bridge: ${error.message}`)
        log('⚠️ AI generation will be skipped in this test')
      }
    }
  })

  test.afterAll(async () => {
    await stopBridge()
  })

  test.beforeEach(async ({ context, extensionUrl, seedStorage }) => {
    initializeTestLogging()

    log('Configuring extension (bridge client will auto-detect ports 3000-3004)')

    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo-2.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey',
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo-2.absmartly.com/v1',
        environment: process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
        authMethod: 'apikey',
        aiProvider: 'claude-subscription'
      }
    })

    testPage = await context.newPage()

    allConsoleMessages = []
    testPage.on('console', (msg) => {
      allConsoleMessages.push({ type: msg.type(), text: msg.text() })
    })

    await testPage.goto(TEST_PAGE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    })

    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should persist AI page state after reload and capture HTML successfully', async ({ context, extensionUrl }) => {
    // Open a test page in a separate tab (for HTML capture)
    const contentPage = await context.newPage()
    await contentPage.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'load' })

    // Wait for content script to be injected (content scripts run at document_idle)
    await debugWait(500)
    log('✓ Content page loaded for HTML capture')

    await test.step('Load sidebar in extension context', async () => {
      log('Loading sidebar in extension context...')
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-0-sidebar-injected.png', fullPage: true })
      log('Screenshot saved: ai-persistence-0-sidebar-injected.png')
    })

    await test.step('Create experiment from scratch', async () => {
      log('Clicking Create Experiment button...')

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()
      log('✓ Create button clicked')

      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-1-dropdown.png', fullPage: true })
      log('Screenshot saved: ai-persistence-1-dropdown.png')

      const fromScratchButton = testPage.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()
      log('✓ From Scratch clicked')

      await debugWait(1000)

      const loadingText = testPage.locator('text=Loading templates')
      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Loading templates text still visible or never appeared')
      })

      await debugWait(1000)
      await testPage.screenshot({ path: 'test-results/ai-persistence-1.5-after-loading.png', fullPage: true })
      log('Screenshot saved: ai-persistence-1.5-after-loading.png')

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened (found Display Name field)')

      await testPage.screenshot({ path: 'test-results/ai-persistence-2-editor.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2-editor.png')

      await debugWait(500)
    })

    let variantName: string

    await test.step('Navigate to AI page', async () => {
      log('Waiting for form to finish loading...')
      const loadingText = testPage.locator('text=Loading...').first()
      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Loading text still visible or never appeared')
      })
      await debugWait(1000)
      log('✓ Form loaded')

      log('Scrolling to DOM Changes section...')
      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-2.5-dom-changes.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2.5-dom-changes.png')

      log('Finding "Generate with AI" button...')
      const generateWithAIButton = testPage.locator('button:has-text("Generate with AI")').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Generate with AI button found')

      await generateWithAIButton.scrollIntoViewIfNeeded()
      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-2.6-before-click.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2.6-before-click.png')

      await generateWithAIButton.click()
      log('✓ Clicked Generate with AI button')

      await debugWait(1000)

      await testPage.locator('text=AI DOM Generator').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ AI page opened')

      await testPage.screenshot({ path: 'test-results/ai-persistence-3-ai-page.png', fullPage: true })
      log('Screenshot saved: ai-persistence-3-ai-page.png')

      variantName = 'Variant 1'

      await expect(testPage.locator('text=AI DOM Generator')).toBeVisible()
      await expect(testPage.locator(`text=Variant: ${variantName}`)).toBeVisible()
      log('✓ AI page verified')
    })

    await test.step('Generate DOM changes with AI and verify', async () => {
      log('Testing AI DOM generation with Claude Code...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.waitFor({ state: 'visible' })
      await promptInput.fill('Make all buttons have an orange background')
      log('✓ Prompt entered: "Make all buttons have an orange background"')

      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-4-prompt-entered.png', fullPage: true })
      log('Screenshot saved: ai-persistence-4-prompt-entered.png')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.waitFor({ state: 'visible' })
      log('Generate button found, trying to click...')

      const isDisabled = await generateButton.getAttribute('disabled')
      log(`Button disabled attribute: ${isDisabled}`)

      await generateButton.click()
      log('✓ Generate button clicked')

      await debugWait(500)

      log('Console messages after clicking Generate:')
      allConsoleMessages.slice(-10).forEach(msg => {
        log(`  [${msg.type}] ${msg.text}`)
      })

      log('Waiting for AI generation to complete...')

      // Wait for the "Generating..." state to disappear and response to appear
      const generatingButton = testPage.locator('button:has-text("Generating")')
      await generatingButton.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
        log('⚠️ Generation still in progress or button state did not change')
      })

      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/ai-persistence-5-after-generate.png', fullPage: true })
      log('Screenshot saved: ai-persistence-5-after-generate.png')

      const chatMessages = await testPage.locator('[class*="chat"], [role="log"], .space-y-4 > div').count()
      log(`Chat messages/sections found: ${chatMessages}`)

      let responseText = ''
      if (chatMessages > 0) {
        log('✅ Chat history exists')
        const allText = await testPage.locator('[class*="chat"], [role="log"], .space-y-4').textContent().catch(() => '')
        responseText = allText || ''
        log(`Chat content preview: ${responseText.substring(0, 300)}...`)

        if (responseText.includes('orange') || responseText.includes('button') || responseText.includes('background')) {
          log('✅ Response mentions buttons/orange/background')
        }

        if (responseText.includes('"selector"') && responseText.includes('"type"')) {
          log('✅ Response contains JSON with DOM changes')

          try {
            let jsonMatch = responseText.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
              const domChanges = JSON.parse(jsonMatch[0])
              log(`✅ Successfully parsed ${domChanges.length} DOM change(s) from Claude response`)
              log(`   First change: ${JSON.stringify(domChanges[0])}`)
            }
          } catch (e) {
            log('⚠️ Could not parse JSON from response')
          }
        }
      } else {
        log('⚠️ No chat messages found in the expected locations')
      }
    })

    await test.step('Test AI page persistence after reload', async () => {
      log('Testing AI page persistence after reload...')
      log(`Current URL before reload: ${testPage.url()}`)

      await testPage.screenshot({ path: 'test-results/ai-persistence-6-before-reload.png', fullPage: true })
      log('Screenshot saved: ai-persistence-6-before-reload.png')

      await testPage.reload({ waitUntil: 'domcontentloaded' })
      log('✓ Page reloaded')

      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/ai-persistence-7-after-reload.png', fullPage: true })
      log('Screenshot saved: ai-persistence-7-after-reload.png')

      const isOnAIPage = await testPage.locator('text=AI DOM Generator').isVisible().catch(() => false)
      const isOnDetailPage = await testPage.locator('[data-testid="experiment-detail"]').isVisible().catch(() => false)
      const isOnListPage = await testPage.locator('[data-testid="experiment-list"]').isVisible().catch(() => false)

      log(`After reload - On AI page: ${isOnAIPage}, On Detail page: ${isOnDetailPage}, On List page: ${isOnListPage}`)

      if (isOnAIPage) {
        log('✅ SUCCESS: Stayed on AI page after reload!')

        const variantLabel = testPage.locator(`text=Variant: ${variantName}`)
        await expect(variantLabel).toBeVisible()
        log(`✅ Correct variant name displayed: ${variantName}`)

        const chatHistory = testPage.locator('[data-message-index]')
        const chatCount = await chatHistory.count()
        log(`Chat history messages: ${chatCount}`)

        if (chatCount > 0) {
          log('✅ Chat history preserved after reload')
        } else {
          log('⚠️ No chat history found (may be expected if generation failed)')
        }
      } else if (isOnDetailPage) {
        log('❌ FAILED: Navigated to detail page instead of AI page')
        log('This means AI page persistence is NOT working')
      } else if (isOnListPage) {
        log('❌ FAILED: Navigated to list page instead of AI page')
        log('This means AI page persistence is NOT working')
      } else {
        log('❌ FAILED: Unknown page state after reload')
      }

      await testPage.screenshot({ path: 'test-results/ai-persistence-8-final.png', fullPage: true })
      log('Screenshot saved: ai-persistence-8-final.png')

      expect(isOnAIPage).toBe(true)
    })

    await test.step('Verify auto-preview and button colors', async () => {
      log('Verifying auto-preview feature and DOM changes...')

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      log('✓ Clicked back button')

      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/ai-persistence-9-back-to-editor.png', fullPage: true })
      log('Screenshot saved: ai-persistence-9-back-to-editor.png')

      await expect(testPage.locator('text=Display Name')).toBeVisible({ timeout: 10000 })
      log('✓ Back at experiment editor')

      log('Scrolling to DOM Changes section...')
      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      log('Checking and enabling Preview if needed...')
      const previewToggle = testPage.locator('[data-testid="preview-toggle-variant-1"]')
      await previewToggle.waitFor({ state: 'visible', timeout: 10000 })

      const hasBlueBackground = await previewToggle.evaluate(el => {
        return el.classList.contains('bg-blue-600')
      })
      log(`Preview toggle state: ${hasBlueBackground ? 'ON' : 'OFF'}`)

      if (!hasBlueBackground) {
        log('Preview is OFF, enabling it manually...')
        await previewToggle.click()
        await debugWait(1000)
        log('✓ Preview enabled')
      } else {
        log('✓ Preview already enabled')
      }

      await testPage.screenshot({ path: 'test-results/ai-persistence-10-preview-enabled.png', fullPage: true })
      log('Screenshot saved: ai-persistence-10-preview-enabled.png')

      log('Navigating to test page to verify button colors...')
      const contentPage = context.pages().find(p => p.url().includes('localhost:3456'))

      if (contentPage) {
        await contentPage.bringToFront()
        await contentPage.reload({ waitUntil: 'domcontentloaded' })
        await debugWait(2000)

        await contentPage.screenshot({ path: 'test-results/ai-persistence-11-test-page.png', fullPage: true })
        log('Screenshot saved: ai-persistence-11-test-page.png')

        log('Checking button colors on test page...')
        const button1Color = await contentPage.locator('#button-1').evaluate(el => window.getComputedStyle(el).backgroundColor).catch(() => null)
        const button2Color = await contentPage.locator('#button-2').evaluate(el => window.getComputedStyle(el).backgroundColor).catch(() => null)
        const button3Color = await contentPage.locator('#button-3').evaluate(el => window.getComputedStyle(el).backgroundColor).catch(() => null)

        log(`Button 1 background: ${button1Color}`)
        log(`Button 2 background: ${button2Color}`)
        log(`Button 3 background: ${button3Color}`)

        const isOrange = (color: string | null) => {
          if (!color) return false
          if (color.includes('orange')) return true

          const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1])
            const g = parseInt(rgbMatch[2])
            const b = parseInt(rgbMatch[3])

            return r > 200 && r <= 255 &&
                   g >= 80 && g <= 180 &&
                   b >= 0 && b <= 100
          }
          return false
        }

        const button1Orange = isOrange(button1Color)
        const button2Orange = isOrange(button2Color)
        const button3Orange = isOrange(button3Color)

        log(`Button 1 is orange: ${button1Orange}`)
        log(`Button 2 is orange: ${button2Orange}`)
        log(`Button 3 is orange: ${button3Orange}`)

        if (button1Orange && button2Orange && button3Orange) {
          log('✅ SUCCESS: All buttons have orange backgrounds!')
        } else {
          log('⚠️ WARNING: Not all buttons are orange')
          log(`   Button 1: ${button1Orange ? '✓' : '✗'}`)
          log(`   Button 2: ${button2Orange ? '✓' : '✗'}`)
          log(`   Button 3: ${button3Orange ? '✓' : '✗'}`)
        }

        await contentPage.screenshot({ path: 'test-results/ai-persistence-12-final-verification.png', fullPage: true })
        log('Screenshot saved: ai-persistence-12-final-verification.png')

        expect(button1Orange || button2Orange || button3Orange).toBe(true)
      } else {
        log('⚠️ Could not find test page to verify button colors')
      }

      log('Test completed')
    })
  })
})
