import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

interface DiagnosticReport {
  timestamp: string
  iframeExists: boolean
  rootExists: boolean
  iframeContents: {
    exists: boolean
    hasPlasmoDiv: boolean
    plasmoHasChildren: number
    plasmoInnerHTML: string
    hasAIComponent: boolean
    bodyHTML: string
  } | null
  consoleErrors: Array<{ type: string; text: string }>
  screenshots: string[]
  reactLogs: Array<{ type: string; text: string }>
  componentState: string
}

test.describe('AI Chat Blank Screen Diagnostics', () => {
  let testPage: Page
  let allConsoleMessages: Array<{ type: string; text: string; timestamp: number }> = []
  let diagnosticReport: DiagnosticReport

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    allConsoleMessages = []

    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      const timestamp = Date.now()

      allConsoleMessages.push({ type: msgType, text: msgText, timestamp })

      if (
        msgText.includes('[AIDOMChangesPage]') ||
        msgText.includes('[ExtensionUI]') ||
        msgText.includes('[sidebar.tsx]') ||
        msgText.includes('ERROR') ||
        msgText.includes('⚠️')
      ) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }

    testPage.on('console', consoleHandler)
    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    const [serviceWorker] = context.serviceWorkers()
    if (serviceWorker) {
      serviceWorker.on('console', (msg: any) => {
        const msgType = msg.type()
        const msgText = msg.text()
        allConsoleMessages.push({ type: msgType, text: msgText, timestamp: Date.now() })
        console.log(`  🔧 [ServiceWorker] [${msgType}] ${msgText}`)
      })
    } else {
      context.on('serviceworker', (worker) => {
        worker.on('console', (msg: any) => {
          const msgType = msg.type()
          const msgText = msg.text()
          allConsoleMessages.push({ type: msgType, text: msgText, timestamp: Date.now() })
          console.log(`  🔧 [ServiceWorker] [${msgType}] ${msgText}`)
        })
      })
    }

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=1`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (diagnostic mode)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  async function captureDiagnosticSnapshot(label: string): Promise<DiagnosticReport> {
    console.log(`\n📊 Capturing diagnostic snapshot: ${label}`)

    const timestamp = new Date().toISOString()

    const rootExists = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-root') !== null
    })
    console.log(`  Root div exists: ${rootExists}`)

    const iframeExists = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-iframe') !== null
    })
    console.log(`  Iframe exists: ${iframeExists}`)

    let iframeContents: IframeContents | null = null
    if (iframeExists) {
      try {
        const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

        const plasmoDiv = sidebar.locator('#__plasmo')
        const aiComponent = sidebar.locator('[data-ai-dom-changes-page]')

        const hasPlasmoDiv = await plasmoDiv.count() > 0
        const hasAIComp = await aiComponent.count() > 0

        let plasmoChildren = 0
        let plasmoHTML = ''

        if (hasPlasmoDiv) {
          plasmoChildren = await plasmoDiv.locator('> *').count()
          plasmoHTML = await plasmoDiv.innerHTML().catch(() => '')
        }

        iframeContents = {
          exists: true,
          hasPlasmoDiv: hasPlasmoDiv,
          plasmoHasChildren: plasmoChildren,
          plasmoInnerHTML: plasmoHTML.substring(0, 1000),
          hasAIComponent: hasAIComp,
          bodyHTML: await sidebar.locator('body').innerHTML().catch(() => '').then(h => h.substring(0, 1000))
        }
      } catch (e) {
        iframeContents = {
          exists: true,
          hasPlasmoDiv: false,
          plasmoHasChildren: 0,
          plasmoInnerHTML: `Error accessing iframe: ${(e as Error).message}`,
          hasAIComponent: false,
          bodyHTML: ''
        }
      }
    }

    if (iframeContents) {
      console.log(`  Plasmo div exists: ${iframeContents.hasPlasmoDiv}`)
      console.log(`  Plasmo children count: ${iframeContents.plasmoHasChildren}`)
      console.log(`  AI component exists: ${iframeContents.hasAIComponent}`)
    } else {
      console.log(`  ❌ Could not access iframe contents`)
    }

    const consoleErrors = allConsoleMessages.filter((m) => m.type === 'error')
    if (consoleErrors.length > 0) {
      console.log(`  ⚠️  Found ${consoleErrors.length} console errors`)
    }

    const reactLogs = allConsoleMessages.filter(
      (m) =>
        m.text.includes('[AIDOMChangesPage]') ||
        m.text.includes('[ExtensionUI]') ||
        m.text.includes('[sidebar.tsx]')
    )
    console.log(`  React logs captured: ${reactLogs.length}`)

    let componentState = 'unknown'
    if (!iframeExists) {
      componentState = 'iframe_removed'
    } else if (!iframeContents) {
      componentState = 'iframe_inaccessible'
    } else if (!iframeContents.hasPlasmoDiv) {
      componentState = 'plasmo_div_missing'
    } else if (iframeContents.plasmoHasChildren === 0) {
      componentState = 'plasmo_div_empty'
    } else if (!iframeContents.hasAIComponent) {
      componentState = 'ai_component_not_rendered'
    } else {
      componentState = 'ai_component_rendered'
    }
    console.log(`  Component state: ${componentState}`)

    const screenshotPath = `test-results/diagnostic-${label.replace(/\s/g, '-')}.png`
    await testPage.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  Screenshot saved: ${screenshotPath}`)

    return {
      timestamp,
      iframeExists,
      rootExists,
      iframeContents,
      consoleErrors,
      screenshots: [screenshotPath],
      reactLogs,
      componentState
    }
  }

  test('Track what happens when clicking "Generate with AI"', async ({ extensionId, extensionUrl, context }) => {
    test.setTimeout(90000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Inject sidebar and verify availability', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')

      await testPage.evaluate((extUrl) => {
        console.log('🔵 Diagnostic Test: Injecting sidebar')

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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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

        console.log('🔵 Diagnostic Test: Sidebar injected successfully')
      }, extensionUrl('tabs/sidebar.html'))

      await sidebar.locator('body').waitFor({ timeout: 10000 })

      await sidebar.locator('#__plasmo').waitFor({ state: 'attached', timeout: 10000 })
      console.log('✅ Sidebar visible and responsive')

      const baselineSnapshot = await captureDiagnosticSnapshot('01-baseline')
      expect(baselineSnapshot.iframeExists).toBe(true)
      if (!baselineSnapshot.iframeContents?.hasPlasmoDiv) {
        console.error('❌ CRITICAL: Plasmo div not found in baseline. iframe contents:', baselineSnapshot.iframeContents)
      }
      expect(baselineSnapshot.iframeContents?.hasPlasmoDiv).toBe(true)
    })

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Clicked "Create New Experiment"')

      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch"')

      experimentName = `Diagnostic Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  ✓ Experiment name: ${experimentName}`)

      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 15000 })
      await unitTypeTrigger.click()
      console.log('  ✓ Clicked Unit Type dropdown')

      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 15000 })

      const firstUnitTypeOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstUnitTypeOption.waitFor({ state: 'visible', timeout: 15000 })
      await firstUnitTypeOption.click()
      console.log('  ✓ Unit type selected')

      const appsContainer = sidebar.locator('label:has-text("Applications")').locator('..')
      const appsClickArea = appsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await appsClickArea.click({ timeout: 5000 })

      const appsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstAppOption = appsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstAppOption.waitFor({ state: 'visible', timeout: 5000 })
      await firstAppOption.click()
      console.log('  ✓ Application selected')

      await sidebar.locator('label:has-text("Traffic")').click()
      const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

      console.log('✅ Experiment created successfully')

      const afterExperimentSnapshot = await captureDiagnosticSnapshot('02-after-experiment-creation')
      expect(afterExperimentSnapshot.iframeExists).toBe(true)
    })

    await test.step('DIAGNOSTIC: Monitor state when clicking "Generate with AI"', async () => {
      console.log('\n🔍 STEP 3: CRITICAL DIAGNOSTIC - Clicking "Generate with AI"')

      const beforeClickSnapshot = await captureDiagnosticSnapshot('03-before-ai-button-click')
      expect(beforeClickSnapshot.iframeExists).toBe(true)
      console.log('✅ Pre-click state captured')

      const aiButton = sidebar.locator('#generate-with-ai-button').first()
      await aiButton.waitFor({ state: 'visible', timeout: 5000 })
      console.log('  ✓ Found "Generate with AI" button')

      const clickTime = Date.now()
      console.log(`\n🎯 CLICKING "Generate with AI" at ${new Date(clickTime).toISOString()}`)

      await aiButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Button clicked')

      console.log('\n⚡ IMMEDIATE CAPTURE (100ms after click)')
      await testPage.waitForFunction(() => true, { timeout: 100 }).catch(() => {})
      const immediate100msSnapshot = await captureDiagnosticSnapshot('04-immediate-100ms-after-click')

      const pageAlive100ms = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  Page alive at 100ms: ${pageAlive100ms}`)

      console.log('\n⏱️  CAPTURE AT 500ms')
      await testPage.waitForFunction(() => true, { timeout: 400 }).catch(() => {})
      const after500msSnapshot = await captureDiagnosticSnapshot('05-after-500ms')

      const pageAlive500ms = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  Page alive at 500ms: ${pageAlive500ms}`)

      console.log('\n⏱️  CAPTURE AT 1 SECOND')
      await testPage.waitForFunction(() => true, { timeout: 500 }).catch(() => {})
      const after1secSnapshot = await captureDiagnosticSnapshot('06-after-1-second')

      const pageAlive1sec = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  Page alive at 1 second: ${pageAlive1sec}`)

      console.log('\n⏱️  CAPTURE AT 2 SECONDS (FINAL)')
      await testPage.waitForFunction(() => true, { timeout: 1000 }).catch(() => {})
      const after2secSnapshot = await captureDiagnosticSnapshot('07-after-2-seconds-final')

      const pageAlive2sec = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  Page alive at 2 seconds: ${pageAlive2sec}`)

      diagnosticReport = after2secSnapshot

      console.log('\n' + '='.repeat(80))
      console.log('📊 DIAGNOSTIC REPORT')
      console.log('='.repeat(80))

      console.log('\n🔍 IFRAME STATE PROGRESSION:')
      console.log(`  Before click: ${beforeClickSnapshot.componentState}`)
      console.log(`  After 100ms:  ${immediate100msSnapshot.componentState}`)
      console.log(`  After 500ms:  ${after500msSnapshot.componentState}`)
      console.log(`  After 1 sec:  ${after1secSnapshot.componentState}`)
      console.log(`  After 2 sec:  ${after2secSnapshot.componentState}`)

      console.log('\n🔍 IFRAME EXISTENCE:')
      console.log(`  Before: ${beforeClickSnapshot.iframeExists}`)
      console.log(`  100ms:  ${immediate100msSnapshot.iframeExists}`)
      console.log(`  500ms:  ${after500msSnapshot.iframeExists}`)
      console.log(`  1 sec:  ${after1secSnapshot.iframeExists}`)
      console.log(`  2 sec:  ${after2secSnapshot.iframeExists}`)

      if (after2secSnapshot.iframeContents) {
        console.log('\n🔍 IFRAME CONTENTS (2 seconds):')
        console.log(`  Plasmo div exists: ${after2secSnapshot.iframeContents.hasPlasmoDiv}`)
        console.log(`  Plasmo children: ${after2secSnapshot.iframeContents.plasmoHasChildren}`)
        console.log(`  AI component rendered: ${after2secSnapshot.iframeContents.hasAIComponent}`)
        console.log(`  Plasmo innerHTML preview: ${after2secSnapshot.iframeContents.plasmoInnerHTML.substring(0, 200)}...`)
      }

      const postClickLogs = allConsoleMessages.filter((m) => m.timestamp >= clickTime)
      const reactComponentLogs = postClickLogs.filter(
        (m) =>
          m.text.includes('[AIDOMChangesPage]') ||
          m.text.includes('[ExtensionUI]') ||
          m.text.includes('COMPONENT RENDER') ||
          m.text.includes('MOUNTED') ||
          m.text.includes('UNMOUNTED')
      )

      console.log('\n🔍 REACT COMPONENT LOGS (after click):')
      if (reactComponentLogs.length > 0) {
        reactComponentLogs.forEach((log) => {
          const timeSinceClick = log.timestamp - clickTime
          console.log(`  [+${timeSinceClick}ms] ${log.text}`)
        })
      } else {
        console.log('  ❌ NO React component logs found!')
      }

      const postClickErrors = postClickLogs.filter((m) => m.type === 'error')
      console.log('\n🔍 CONSOLE ERRORS (after click):')
      if (postClickErrors.length > 0) {
        postClickErrors.forEach((err) => {
          const timeSinceClick = err.timestamp - clickTime
          console.log(`  [+${timeSinceClick}ms] ${err.text}`)
        })
      } else {
        console.log('  ✅ No console errors')
      }

      console.log('\n🔍 KEY FINDINGS:')

      if (!after2secSnapshot.iframeExists) {
        console.log('  🚨 IFRAME WAS REMOVED FROM DOM')
        console.log('     → This suggests content script or Plasmo removed the iframe')
        console.log('     → Check: src/contents/sidebar.tsx cleanup code')
        console.log('     → Check: Plasmo HMR/reload logic')
      } else if (!after2secSnapshot.iframeContents?.hasPlasmoDiv) {
        console.log('  🚨 PLASMO DIV IS MISSING FROM IFRAME')
        console.log('     → This suggests Plasmo cleared the mount point')
        console.log('     → Check: tabs/sidebar.tsx mounting logic')
      } else if (after2secSnapshot.iframeContents?.plasmoHasChildren === 0) {
        console.log('  🚨 PLASMO DIV IS EMPTY (NO CHILDREN)')
        console.log('     → This suggests React unmounted without remounting')
        console.log('     → Check: ExtensionUI.tsx view routing logic')
        console.log('     → Check: React Strict Mode unmount/remount cycles')
      } else if (!after2secSnapshot.iframeContents?.hasAIComponent) {
        console.log('  🚨 AI COMPONENT NOT IN DOM')
        console.log('     → React rendered but AIDOMChangesPage not present')
        console.log('     → Check: Conditional rendering in ExtensionUI.tsx')
        console.log('     → Check: Component did mount but then unmounted')
      } else {
        console.log('  ✅ AI COMPONENT IS RENDERED IN DOM')
        console.log('     → Component exists, might be CSS hiding issue')
        console.log('     → Check computed styles with DevTools')
      }

      const messageLogs = postClickLogs.filter(
        (m) => m.text.includes('message') || m.text.includes('Message') || m.text.includes('channel')
      )
      if (messageLogs.length > 0) {
        console.log('\n🔍 MESSAGE PASSING LOGS:')
        messageLogs.forEach((log) => {
          const timeSinceClick = log.timestamp - clickTime
          console.log(`  [+${timeSinceClick}ms] ${log.text}`)
        })
      }

      console.log('\n' + '='.repeat(80))
      console.log('📸 SCREENSHOTS SAVED:')
      console.log('  1. test-results/diagnostic-03-before-ai-button-click.png')
      console.log('  2. test-results/diagnostic-04-immediate-100ms-after-click.png')
      console.log('  3. test-results/diagnostic-05-after-500ms.png')
      console.log('  4. test-results/diagnostic-06-after-1-second.png')
      console.log('  5. test-results/diagnostic-07-after-2-seconds-final.png')
      console.log('='.repeat(80) + '\n')

      console.log('✅ Diagnostic data collection complete')
    })

    await test.step('Generate final diagnostic report', async () => {
      console.log('\n📄 FINAL DIAGNOSTIC SUMMARY')
      console.log('=' .repeat(80))

      console.log('\n🎯 TEST OBJECTIVE: Track what happens when AI chat goes blank')
      console.log('\n📊 RESULTS:')
      console.log(`  Final component state: ${diagnosticReport.componentState}`)
      console.log(`  Iframe still exists: ${diagnosticReport.iframeExists}`)
      console.log(`  Total console errors: ${diagnosticReport.consoleErrors.length}`)
      console.log(`  React logs captured: ${diagnosticReport.reactLogs.length}`)

      console.log('\n💡 NEXT STEPS:')
      console.log('  1. Review screenshots in test-results/ directory')
      console.log('  2. Analyze console logs above for error patterns')
      console.log('  3. Check component state progression timeline')
      console.log('  4. Investigate the root cause based on findings')

      console.log('\n' + '='.repeat(80))

      expect(diagnosticReport).toBeDefined()
    })
  })

  test('Monitor iframe removal events in real-time', async ({ extensionUrl }) => {
    test.setTimeout(60000)

    await test.step('Setup iframe removal monitor', async () => {
      console.log('\n🔍 Setting up iframe removal monitor')

      await testPage.evaluate((extUrl) => {
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = 'position: fixed; top: 0; right: 0; width: 384px; height: 100vh; z-index: 2147483647;'

        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = extUrl

        container.appendChild(iframe)
        document.body.appendChild(container)

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const removedNode of Array.from(mutation.removedNodes)) {
              if (removedNode === iframe) {
                console.error('🚨 IFRAME REMOVED FROM DOM!')
                console.error('  Removed by:', mutation.target)
                console.trace('Stack trace:')
              }
            }
          }
        })

        observer.observe(container, { childList: true })

        console.log('✅ Iframe removal monitor active')
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })

      console.log('✅ Iframe monitor test setup complete')
      console.log('  Watch console for iframe removal events')

      await testPage.waitForFunction(() => true, { timeout: 5000 }).catch(() => {})

      const removalEvents = allConsoleMessages.filter((m) => m.text.includes('IFRAME REMOVED'))
      if (removalEvents.length > 0) {
        console.log(`\n🚨 Detected ${removalEvents.length} iframe removal events`)
        removalEvents.forEach((event) => console.log(`  ${event.text}`))
      } else {
        console.log('\n✅ No iframe removal events detected')
      }
    })
  })
})
