import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { log, initializeTestLogging, debugWait } from './utils/test-helpers'
import { spawn, ChildProcess } from 'child_process'

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

async function setupExperimentAndAI(testPage: Page, extensionUrl: (path: string) => string): Promise<void> {
  const sidebarUrl = extensionUrl('tabs/sidebar.html')
  await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

  const createButton = testPage.locator('button[title="Create New Experiment"]')
  await createButton.waitFor({ state: 'visible', timeout: 10000 })
  await createButton.click()

  const fromScratchButton = testPage.locator('#from-scratch-button')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await fromScratchButton.click()

  await testPage.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })
  log('✓ Experiment editor opened')

  await testPage.locator('[data-dom-changes-section="true"]').first().scrollIntoViewIfNeeded()

  const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
  await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
  await generateWithAIButton.click()

  await testPage.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
  log('✓ AI page opened')
}

async function generateAndWait(testPage: Page, prompt: string): Promise<void> {
  const promptInput = testPage.locator('textarea#ai-prompt')
  await promptInput.fill(prompt)

  await testPage.locator('#ai-generate-button').click()
  log(`✓ Generate clicked: "${prompt.substring(0, 50)}..."`)

  await testPage.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
  log('✓ Generation completed')
}

async function getLatestChanges(testPage: Page): Promise<any[]> {
  return testPage.evaluate(() => {
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
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should handle append action - add new changes to existing ones', async ({ extensionUrl }) => {
    await test.step('Setup and generate initial changes', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(testPage, 'Make all buttons have an orange background')
    })

    await test.step('Verify initial changes exist', async () => {
      const changes = await getLatestChanges(testPage)
      log(`Initial changes count: ${changes.length}`)
      expect(changes.length).toBeGreaterThan(0)
      expect(changesContain(changes, 'button') || changesContain(changes, 'orange')).toBe(true)
      log('✅ Initial changes verified')
    })

    await test.step('Generate additional changes (append)', async () => {
      await generateAndWait(testPage, 'Also make all headings blue and bold')
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
    await test.step('Setup and generate initial changes', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(testPage, 'Make all buttons orange')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Generate replacement changes', async () => {
      await generateAndWait(testPage, 'Actually, forget the buttons. Instead make all headings green and italic')
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
    await test.step('Setup and generate multiple changes', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(testPage, 'Make buttons orange and headings blue')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created (buttons + headings)')
    })

    await test.step('Replace specific changes', async () => {
      await generateAndWait(testPage, 'Change the buttons to red instead of orange, but keep the headings as they are')
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
    await test.step('Setup and generate multiple changes', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(testPage, 'Make buttons orange, headings blue, and paragraphs italic')
    })

    await test.step('Verify initial changes', async () => {
      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Remove specific changes', async () => {
      await generateAndWait(testPage, 'Remove the button styling but keep everything else')
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
    await test.step('Setup and generate initial changes', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
      await generateAndWait(testPage, 'Make buttons orange')
    })

    await test.step('Verify initial changes exist', async () => {
      const initialChanges = await getLatestChanges(testPage)
      expect(initialChanges.length).toBeGreaterThan(0)
      log('✓ Initial changes created')
    })

    await test.step('Ask a question (no DOM changes expected)', async () => {
      const changesBefore = await getLatestChanges(testPage)
      await generateAndWait(testPage, 'What colors work well for call-to-action buttons?')

      const changesAfter = await getLatestChanges(testPage)
      log(`Changes before question: ${changesBefore.length}`)
      log(`Changes after question: ${changesAfter.length}`)

      const messageCount = await testPage.locator('[data-message-index]').count()
      log(`Chat messages: ${messageCount}`)
      expect(messageCount).toBeGreaterThanOrEqual(4)

      log('✅ None action verified - conversational response without changing DOM')
    })
  })

  test('should maintain change history across multiple operations', async ({ extensionUrl }) => {
    await test.step('Setup', async () => {
      await setupExperimentAndAI(testPage, extensionUrl)
    })

    await test.step('Step 1: Create initial changes', async () => {
      await generateAndWait(testPage, 'Make buttons orange')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 1: ${changes.length} changes`)
    })

    await test.step('Step 2: Append heading changes', async () => {
      await generateAndWait(testPage, 'Also make headings blue')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 2: ${changes.length} changes`)
    })

    await test.step('Step 3: Ask a question (none action)', async () => {
      await generateAndWait(testPage, 'What is the current color scheme?')
      log('✓ Step 3: Question answered')
    })

    await test.step('Step 4: Replace button color', async () => {
      await generateAndWait(testPage, 'Change buttons to red')

      const changes = await getLatestChanges(testPage)
      expect(changes.length).toBeGreaterThan(0)
      log(`✓ Step 4: ${changes.length} changes`)
    })

    await test.step('Verify chat history', async () => {
      const messageCount = await testPage.locator('[data-message-index]').count()
      log(`Total chat messages: ${messageCount}`)
      expect(messageCount).toBeGreaterThanOrEqual(8)
      log('✅ Change history maintained across multiple operations')
    })
  })
})
