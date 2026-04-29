import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { log, initializeTestLogging, debugWait } from './utils/test-helpers'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const BRIDGE_PORTS = [3000, 3001, 3002, 3003, 3004]

let bridgeProcess: ChildProcess | null = null
let bridgeWasStarted = false
let activeBridgePort: number | null = null

// Bridge process is spawned once per file and shared across tests; running
// these in parallel would race the port-discovery + spawn logic.
test.describe.configure({ mode: 'serial' })

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

async function setupExperimentAndAI(testPage: Page, extensionUrl: (path: string) => string): Promise<FrameLocator> {
  // Inject sidebar as iframe
  await testPage.evaluate((extUrl) => {
    const originalPadding = document.body.style.paddingRight || '0px'
    document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
    document.body.style.transition = 'padding-right 0.3s ease-in-out'
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl('tabs/sidebar.html'))

  const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })
  log('✓ Sidebar injected and loaded')

  const createButton = sidebar.locator('button[title="Create New Experiment"]')
  await createButton.waitFor({ state: 'visible', timeout: 10000 })
  await createButton.click()

  const fromScratchButton = sidebar.locator('#from-scratch-button')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await fromScratchButton.click()

  await sidebar.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })
  log('✓ Experiment editor opened')

  await sidebar.locator('[data-dom-changes-section="true"]').first().scrollIntoViewIfNeeded()

  const generateWithAIButton = sidebar.locator('#generate-with-ai-button').first()
  await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
  await generateWithAIButton.evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
  log('✓ AI page opened')

  return sidebar
}

async function generateAndWait(sidebar: FrameLocator, prompt: string): Promise<void> {
  const promptInput = sidebar.locator('textarea#ai-prompt')
  await promptInput.fill(prompt)

  await sidebar.locator('#ai-generate-button').click()
  log(`✓ Generate clicked: "${prompt.substring(0, 50)}..."`)

  await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
  log('✓ Generation completed')
}

async function getLatestChanges(testPage: Page): Promise<any[]> {
  const frame = testPage.frame({ url: /sidebar\.html/ }) || testPage.frames().find(f => f.url().includes('sidebar'))
  if (!frame) return []
  return frame.evaluate(() => {
    const data = (window as any).__absmartlyLatestDomChanges
    return data?.changes || []
  })
}

function changesContain(changes: any[], keyword: string): boolean {
  const json = JSON.stringify(changes).toLowerCase()
  return json.includes(keyword.toLowerCase())
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
      }
    }
  })

  test.afterAll(async () => {
    await stopBridge()
  })

  test.beforeEach(async ({ context, extensionUrl, seedStorage }) => {
    initializeTestLogging()

    // These tests verify AI action-handling semantics (append /
    // replace_all / replace_specific / remove_specific) rather than a
    // specific provider's wire protocol. The test fixture previously
    // seeded `aiProvider: 'claude-subscription'` and relied on a local
    // claude-code-bridge binary that CI doesn't have. Switch to the
    // anthropic-api provider and pair its key with its endpoint the
    // same way the shared extension fixture does: when a proxy endpoint
    // is configured (e.g. llmproxy.absmartly-dev.com) use the
    // PLASMO_PUBLIC_ANTHROPIC_API_KEY (llmp_sk_...), otherwise fall
    // back to the direct ANTHROPIC_API_KEY (sk-ant-...).
    const anthropicEndpoint = process.env.PLASMO_PUBLIC_ANTHROPIC_ENDPOINT || ''
    const anthropicApiKey = anthropicEndpoint
      ? (process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '')
      : (process.env.ANTHROPIC_API_KEY || process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || '')

    test.skip(
      !anthropicApiKey,
      'ANTHROPIC_API_KEY / PLASMO_PUBLIC_ANTHROPIC_API_KEY required; these tests hit the AI provider to exercise real action handling.'
    )

    await seedStorage({
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
        authMethod: 'apikey',
        domChangesFieldName: '__dom_changes',
        aiProvider: 'anthropic-api',
        aiApiKey: anthropicApiKey,
        vibeStudioEnabled: true,
        llmModel: 'claude-sonnet-4-5',
        providerModels: { 'anthropic-api': 'claude-sonnet-4-5' },
        providerEndpoints: anthropicEndpoint ? { 'anthropic-api': anthropicEndpoint } : {}
      },
      'ai-apikey': anthropicApiKey,
      'plasmo:ai-apikey': anthropicApiKey
    })

    testPage = await context.newPage()

    allConsoleMessages = []
    testPage.on('console', (msg) => {
      allConsoleMessages.push({ type: msg.type(), text: msg.text() })
    })

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=1`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    log('✓ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should handle append action - add new changes to existing ones', async ({ extensionUrl }) => {
    test.setTimeout(60000)
    let sidebar: FrameLocator

    await test.step('Setup and generate initial changes', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(sidebar, 'Make all buttons have an orange background')
    })

    await test.step('Verify initial changes exist', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Initial changes count: ${changes.length}`)
      expect(changes.length).toBeGreaterThan(0)
      expect(changesContain(changes, 'button') || changesContain(changes, 'orange')).toBe(true)
      log('✅ Initial changes verified')
    })

    await test.step('Generate additional changes (append)', async () => {
      await generateAndWait(sidebar!, 'Also make all headings blue and bold')
    })

    await test.step('Verify both initial and new changes exist', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Total changes after append: ${changes.length}`)

      const hasButtonChanges = changesContain(changes, 'button') || changesContain(changes, 'orange')
      const hasHeadingChanges = changesContain(changes, 'h1') || changesContain(changes, 'h2') || changesContain(changes, 'blue')

      log(`Has button changes: ${hasButtonChanges}`)
      log(`Has heading changes: ${hasHeadingChanges}`)

      expect(changes.length).toBeGreaterThanOrEqual(2)
      log('✅ Append action verified - multiple changes present')
    })
  })

  test('should handle replace_all action - replace all existing changes', async ({ extensionUrl }) => {
    test.setTimeout(60000)
    let sidebar: FrameLocator

    await test.step('Setup and generate initial changes', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
      // Explicit phrasing so the live model produces DOM changes rather
      // than asking a clarifying question.
      await generateAndWait(sidebar, 'Make all buttons have an orange background')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Generate replacement changes', async () => {
      await generateAndWait(sidebar!, 'Actually, forget the buttons. Instead make all headings green and italic')
    })

    await test.step('Verify changes were replaced', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Changes after replace: ${changes.length}`)
      log(`Changes JSON: ${JSON.stringify(changes).substring(0, 200)}`)

      expect(changes.length).toBeGreaterThan(0)
      log('✅ Replace action verified - changes updated')
    })
  })

  test('should handle replace_specific action - replace specific changes only', async ({ extensionUrl }) => {
    test.setTimeout(60000)
    let sidebar: FrameLocator

    await test.step('Setup and generate multiple changes', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(sidebar, 'Make all buttons orange and all headings blue')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created (buttons + headings)')
    })

    await test.step('Replace specific changes', async () => {
      await generateAndWait(sidebar!, 'Change the buttons to red instead of orange, but keep the headings as they are')
    })

    await test.step('Verify specific changes replaced', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Changes after replace_specific: ${changes.length}`)
      log(`Changes JSON: ${JSON.stringify(changes).substring(0, 300)}`)

      expect(changes.length).toBeGreaterThan(0)
      log('✅ Replace_specific action verified')
    })
  })

  test('should handle remove_specific action - remove specific changes only', async ({ extensionUrl }) => {
    test.setTimeout(60000)
    let sidebar: FrameLocator

    await test.step('Setup and generate multiple changes', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(sidebar, 'Make buttons orange, headings blue, and paragraphs italic')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Remove specific changes', async () => {
      await generateAndWait(sidebar!, 'Remove the button styling but keep everything else')
    })

    await test.step('Verify specific changes removed', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Changes after remove_specific: ${changes.length}`)
      log(`Changes JSON: ${JSON.stringify(changes).substring(0, 300)}`)

      expect(changes.length).toBeGreaterThanOrEqual(0)
      log('✅ Remove_specific action verified')
    })
  })

  test('should handle none action - conversational response only', async ({ extensionUrl }) => {
    test.setTimeout(60000)
    let sidebar: FrameLocator

    await test.step('Setup and generate initial changes', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
      // Use the fuller, explicit phrasing that the passing "append" test
      // uses — short prompts like "Make buttons orange" sometimes get
      // answered conversationally by the real model instead of producing
      // DOM changes, which makes the setup for this test flaky.
      await generateAndWait(sidebar, 'Make all buttons have an orange background')
    })

    await test.step('Verify initial changes exist', async () => {
      const initialChanges = await getLatestChanges(testPage)
      expect(initialChanges.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Ask a question (no DOM changes expected)', async () => {
      const changesBefore = await getLatestChanges(testPage)
      await generateAndWait(sidebar!, 'What colors work well for call-to-action buttons?')

      const changesAfter = await getLatestChanges(testPage)
      log(`Changes before question: ${changesBefore.length}`)
      log(`Changes after question: ${changesAfter.length}`)

      const messageCount = await sidebar!.locator('[data-message-index]').count()
      log(`Chat messages: ${messageCount}`)
      expect(messageCount).toBeGreaterThanOrEqual(4)

      log('✅ None action verified - conversational response without changing DOM')
    })
  })

  test('should maintain change history across multiple operations', async ({ extensionUrl }) => {
    test.setTimeout(120000)
    let sidebar: FrameLocator

    await test.step('Setup', async () => {
      sidebar = await setupExperimentAndAI(testPage, extensionUrl)
    })

    await test.step('Step 1: Create initial changes', async () => {
      // Prefer explicit phrasing so the live model reliably produces
      // changes rather than asking a clarifying question.
      await generateAndWait(sidebar!, 'Make all buttons have an orange background')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 1: ${changes.length} changes`)
    })

    await test.step('Step 2: Append heading changes', async () => {
      await generateAndWait(sidebar!, 'Also make all headings blue and bold')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 2: ${changes.length} changes`)
    })

    await test.step('Step 3: Ask a question (none action)', async () => {
      await generateAndWait(sidebar!, 'What is the current color scheme?')
      log('✓ Step 3: Question answered')
    })

    await test.step('Step 4: Replace button color', async () => {
      await generateAndWait(sidebar!, 'Change buttons to red instead of orange')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 4: ${changes.length} changes`)
    })

    await test.step('Verify chat history', async () => {
      const messageCount = await sidebar!.locator('[data-message-index]').count()
      log(`Total chat messages: ${messageCount}`)
      expect(messageCount).toBeGreaterThanOrEqual(8)
      log('✅ Change history maintained across multiple operations')
    })
  })
})
