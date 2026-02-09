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

test.describe('AI DOM Granular Operations', () => {
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

  test('should handle append action - add new changes to existing ones', async ({ context, extensionUrl }) => {
    await test.step('Setup: Create experiment and navigate to AI page', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened')

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateWithAIButton.click()
      await debugWait(1000)

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ AI page opened (Vibe Studio)')
    })

    await test.step('Generate initial DOM changes', async () => {
      log('Generating initial changes: Make buttons orange...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make all buttons have an orange background')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()
      log('✓ Generate button clicked')

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-1-initial-changes.png', fullPage: true })
      log('Screenshot saved: granular-1-initial-changes.png')

      const chatContent = await testPage.locator('[class*="chat"], [role="log"], .space-y-4').textContent().catch(() => '')
      expect(chatContent).toBeTruthy()
      log('✅ Initial DOM changes generated')
    })

    await test.step('Test append action - add new changes', async () => {
      log('Testing append action: Add heading styles...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Also make all headings blue and bold')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-2-after-append.png', fullPage: true })
      log('Screenshot saved: granular-2-after-append.png')

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await expect(testPage.locator('text=Display Name')).toBeVisible({ timeout: 10000 })
      log('✓ Back at experiment editor')

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')
      log(`DOM changes content preview: ${domChangesText.substring(0, 200)}...`)

      const hasButtonChanges = domChangesText.includes('button') || domChangesText.includes('orange')
      const hasHeadingChanges = domChangesText.includes('h1') || domChangesText.includes('h2') || domChangesText.includes('blue')

      log(`Has button changes: ${hasButtonChanges}`)
      log(`Has heading changes: ${hasHeadingChanges}`)

      expect(hasButtonChanges).toBe(true)
      expect(hasHeadingChanges).toBe(true)
      log('✅ Append action worked - both button and heading changes present')
    })
  })

  test('should handle replace_all action - replace all existing changes', async ({ context, extensionUrl }) => {
    await test.step('Setup: Create experiment with initial changes', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.click()
      await debugWait(1000)

      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make all buttons orange')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('✓ Initial changes created')
    })

    await test.step('Test replace_all action', async () => {
      log('Testing replace_all action: Replace with heading styles...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Actually, forget the buttons. Instead make all headings green and italic')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-3-after-replace-all.png', fullPage: true })
      log('Screenshot saved: granular-3-after-replace-all.png')

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')

      const hasButtonChanges = domChangesText.includes('button') || domChangesText.includes('orange')
      const hasHeadingChanges = domChangesText.includes('h1') || domChangesText.includes('h2') || domChangesText.includes('green') || domChangesText.includes('italic')

      log(`Has button changes: ${hasButtonChanges}`)
      log(`Has heading changes: ${hasHeadingChanges}`)

      expect(hasButtonChanges).toBe(false)
      expect(hasHeadingChanges).toBe(true)
      log('✅ Replace_all action worked - old changes removed, new changes present')
    })
  })

  test('should handle replace_specific action - replace specific changes only', async ({ context, extensionUrl }) => {
    await test.step('Setup: Create experiment with multiple changes', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.click()
      await debugWait(1000)

      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make buttons orange and headings blue')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('✓ Initial changes created (buttons + headings)')
    })

    await test.step('Test replace_specific action', async () => {
      log('Testing replace_specific action: Change only button styles...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Change the buttons to red instead of orange, but keep the headings as they are')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-4-after-replace-specific.png', fullPage: true })
      log('Screenshot saved: granular-4-after-replace-specific.png')

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')

      const hasOrangeButtons = domChangesText.includes('orange')
      const hasRedButtons = domChangesText.includes('red')
      const hasBlueHeadings = domChangesText.includes('blue') && (domChangesText.includes('h1') || domChangesText.includes('h2'))

      log(`Has orange buttons: ${hasOrangeButtons}`)
      log(`Has red buttons: ${hasRedButtons}`)
      log(`Has blue headings: ${hasBlueHeadings}`)

      expect(hasOrangeButtons).toBe(false)
      expect(hasRedButtons).toBe(true)
      expect(hasBlueHeadings).toBe(true)
      log('✅ Replace_specific action worked - button changes replaced, heading changes kept')
    })
  })

  test('should handle remove_specific action - remove specific changes only', async ({ context, extensionUrl }) => {
    await test.step('Setup: Create experiment with multiple changes', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.click()
      await debugWait(1000)

      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make buttons orange, headings blue, and paragraphs italic')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('✓ Initial changes created (buttons + headings + paragraphs)')
    })

    await test.step('Test remove_specific action', async () => {
      log('Testing remove_specific action: Remove button changes...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Remove the button styling but keep everything else')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-5-after-remove-specific.png', fullPage: true })
      log('Screenshot saved: granular-5-after-remove-specific.png')

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')

      const hasButtonChanges = domChangesText.includes('button') || domChangesText.includes('orange')
      const hasHeadingChanges = domChangesText.includes('blue') && (domChangesText.includes('h1') || domChangesText.includes('h2'))
      const hasParagraphChanges = domChangesText.includes('italic') && domChangesText.includes('p')

      log(`Has button changes: ${hasButtonChanges}`)
      log(`Has heading changes: ${hasHeadingChanges}`)
      log(`Has paragraph changes: ${hasParagraphChanges}`)

      expect(hasButtonChanges).toBe(false)
      expect(hasHeadingChanges).toBe(true)
      expect(hasParagraphChanges).toBe(true)
      log('✅ Remove_specific action worked - button changes removed, other changes kept')
    })
  })

  test('should handle none action - conversational response only', async ({ context, extensionUrl }) => {
    await test.step('Setup: Create experiment with changes', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.click()
      await debugWait(1000)

      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make buttons orange')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('✓ Initial changes created')
    })

    await test.step('Test none action - question without DOM changes', async () => {
      log('Testing none action: Ask a question...')
      const promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('What colors work well for call-to-action buttons?')

      const generateButton = testPage.locator('#ai-generate-button')
      await generateButton.click()

      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-6-after-none-action.png', fullPage: true })
      log('Screenshot saved: granular-6-after-none-action.png')

      const chatContent = await testPage.locator('[class*="chat"], [role="log"], .space-y-4').textContent().catch(() => '')
      const hasResponse = chatContent.length > 100
      log(`Chat response length: ${chatContent.length}`)
      log(`Response preview: ${chatContent.substring(0, 200)}...`)

      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')
      const hasButtonChanges = domChangesText.includes('button') && domChangesText.includes('orange')

      log(`Has conversational response: ${hasResponse}`)
      log(`DOM changes still contain original button changes: ${hasButtonChanges}`)

      expect(hasResponse).toBe(true)
      expect(hasButtonChanges).toBe(true)
      log('✅ None action worked - conversational response given, DOM changes unchanged')
    })
  })

  test('should maintain change history across multiple operations', async ({ context, extensionUrl }) => {
    await test.step('Setup and perform multiple operations', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.click()
      await debugWait(1000)

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.click()
      await debugWait(1000)

      log('Step 1: Create initial changes')
      let promptInput = testPage.locator('textarea#ai-prompt')
      await promptInput.fill('Make buttons orange')
      await testPage.locator('#ai-generate-button').click()
      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('Step 2: Append heading changes')
      await promptInput.fill('Also make headings blue')
      await testPage.locator('#ai-generate-button').click()
      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('Step 3: Ask a question (none action)')
      await promptInput.fill('What is the current color scheme?')
      await testPage.locator('#ai-generate-button').click()
      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      log('Step 4: Replace button color')
      await promptInput.fill('Change buttons to red')
      await testPage.locator('#ai-generate-button').click()
      await testPage.locator('button:has-text("Generating")').waitFor({ state: 'hidden', timeout: 60000 })
      await debugWait(1000)

      await testPage.screenshot({ path: 'test-results/granular-7-chat-history.png', fullPage: true })
      log('Screenshot saved: granular-7-chat-history.png')
    })

    await test.step('Verify final state', async () => {
      const backButton = testPage.locator('button').filter({ has: testPage.locator('svg') }).first()
      await backButton.click()
      await debugWait(1000)

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const domChangesText = await testPage.locator('[class*="monaco-editor"]').textContent().catch(() => '')

      const hasOrangeButtons = domChangesText.includes('orange')
      const hasRedButtons = domChangesText.includes('red')
      const hasBlueHeadings = domChangesText.includes('blue')

      log('Final state check:')
      log(`  Has orange buttons: ${hasOrangeButtons} (should be false)`)
      log(`  Has red buttons: ${hasRedButtons} (should be true)`)
      log(`  Has blue headings: ${hasBlueHeadings} (should be true)`)

      expect(hasOrangeButtons).toBe(false)
      expect(hasRedButtons).toBe(true)
      expect(hasBlueHeadings).toBe(true)
      log('✅ Change history maintained correctly across multiple operations')
    })
  })
})
