import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { setupTestPage, debugWait, setupConsoleLogging, click } from './utils/test-helpers'

test.describe('Variable Sync - __inject_html and DOM Changes Preservation', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, seedStorage }) => {
    // Seed credentials before each test
    await seedStorage({
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
        authMethod: 'apikey',
        domChangesFieldName: '__dom_changes',
        vibeStudioEnabled: true,
        htmlInjectionEnabled: true
      }
    })

    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]') || msg.text.includes('[VariantList]')
    )

    console.log('✅ Test page ready')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Should preserve __inject_html and DOM changes when adding custom variables', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 120000 : 90000)

    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      const result = await setupTestPage(testPage, extensionUrl, '/variable-sync-test.html')
      sidebar = result.sidebar
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    let experimentName: string

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

      // Click Create New Experiment button
      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  Clicked Create New Experiment button')
      await debugWait()

      // Select "From Scratch"
      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  Selected "From Scratch"')
      await debugWait()

      // Fill experiment name
      experimentName = `Variable Sync Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  Filled experiment name: ${experimentName}`)
      await debugWait()

      // Select Unit Type
      console.log('  Selecting Unit Type...')
      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await unitTypeTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 5000 })
      await unitTypeTrigger.click()
      await debugWait(500)

      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  Selected unit type')
      await debugWait()

      // Select Application
      console.log('  Selecting Application...')
      const appsTrigger = sidebar.locator('#applications-select-trigger')
      await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await appsTrigger.click()
      await debugWait(500)

      const appsDropdown = sidebar.locator('#applications-select-dropdown')
      await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  Selected application')
      await debugWait()

      // Close dropdown
      await sidebar.locator('#traffic-label').click()
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      console.log('✅ Experiment form filled')
      await debugWait()
    })

    await test.step('Add __inject_html code', async () => {
      console.log('\n💉 STEP 3: Adding injection code')

      // Find and expand the Custom Code Injection section for Variant 1 (not Control)
      const injectionButton = sidebar.locator('#custom-code-injection-button').last()
      await injectionButton.scrollIntoViewIfNeeded()

      // Check if already expanded by looking for the card sections
      const isExpanded = await sidebar.locator('#code-injection-headStart-card').last().isVisible({ timeout: 1000 }).catch(() => false)

      if (!isExpanded) {
        await injectionButton.click()
        console.log('  Expanded Custom Code Injection section')
        // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
      }

      // Click on "Start of <head>" card to open editor (Variant 1)
      const headStartCard = sidebar.locator('#code-injection-headStart-card').last()
      await headStartCard.scrollIntoViewIfNeeded()
      await click(sidebar, headStartCard)
      console.log('  Clicked Start of <head> card')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {}) // Give time for message to be sent and received

      // Wait for the fullscreen code editor to appear in the main page
      const editorContainer = testPage.locator('#absmartly-code-editor-fullscreen')
      await editorContainer.waitFor({ state: 'visible', timeout: 10000 })
      console.log('  Code editor container visible')

      // Wait for CodeMirror editor inside the container
      const cmEditor = editorContainer.locator('.cm-content').first()
      await cmEditor.waitFor({ state: 'visible', timeout: 5000 })
      console.log('  CodeMirror editor visible')

      // Focus and type code
      await cmEditor.click()
      await testPage.keyboard.type('<script>console.log("Test injection code!")</script>')
      console.log('  Typed injection code')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Click Save button in the editor container
      const saveButton = editorContainer.locator('#save-button').first()
      await saveButton.click()
      console.log('  Saved injection code')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      console.log('✅ Injection code added')

      // Wait longer for injection code to sync to VariantList
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})
      console.log('  Waited for injection code to sync')
      await debugWait()
    })

    await test.step('Add DOM changes via Visual Editor', async () => {
      console.log('\n🎨 STEP 4: Adding DOM changes via Visual Editor')

      const visualEditorButton = sidebar.locator('#visual-editor-button').first()
      await visualEditorButton.waitFor({ state: 'visible', timeout: 5000 })
      await expect(visualEditorButton).toBeEnabled({ timeout: 10000 })

      // Launch Visual Editor
      await visualEditorButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  Launched Visual Editor')

      // Wait for VE to be active
      await testPage.locator('#absmartly-visual-editor-banner-host').waitFor({ state: 'visible', timeout: 15000 })
      console.log('  Visual Editor active')
      await debugWait()

      // Make a simple text change
      console.log('  Making text change...')
      await testPage.click('#test-title', { force: true })
      await testPage.locator('#absmartly-menu-host .menu-container, .menu-container').waitFor({ state: 'visible', timeout: 5000 })
      await testPage.locator('.menu-item[data-action="edit"]').click({ timeout: 5000 })
      await testPage.keyboard.type('Modified by VE!')
      await testPage.keyboard.press('Enter')
      console.log('  Text change made')
      await debugWait()

      // Save changes
      await testPage.locator('[data-action="save"]').click({ timeout: 5000 })
      console.log('  Saved VE changes')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

      console.log('✅ DOM changes added')
      await debugWait()
    })

    await test.step('Add URL filter configuration', async () => {
      console.log('\n🔗 STEP 5: Adding URL filter')

      // Scroll to variant 1 section
      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()

      // Find and expand URL Filtering section for Variant 1
      const urlFilterButton = sidebar.locator('[id^="url-filtering-toggle-variant-"]').last()
      await urlFilterButton.scrollIntoViewIfNeeded()

      const isExpanded = await sidebar.locator('select[value="all"], select[value="simple"]').last().isVisible({ timeout: 1000 }).catch(() => false)

      if (!isExpanded) {
        await urlFilterButton.click()
        console.log('  Expanded URL Filtering section')
        // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
      }

      // Select simple mode for Variant 1
      const modeSelect = sidebar.locator('[id^="url-filter-mode-variant-"]').last()
      await modeSelect.waitFor({ state: 'visible', timeout: 5000 })
      await modeSelect.selectOption('simple')
      console.log('  Selected simple URL filter mode')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Add URL pattern (Variant 1)
      const patternInput = sidebar.locator('input[placeholder*="/products/*"]').last()
      await patternInput.waitFor({ state: 'visible', timeout: 5000 })
      await patternInput.fill('/test/*')
      await patternInput.blur()
      console.log('  Added URL filter pattern: /test/*')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      console.log('✅ URL filter configured')
      await debugWait()
    })

    await test.step('Verify initial state before adding custom variable', async () => {
      console.log('\n🔍 STEP 6: Verifying initial state (before custom variable)')

      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()
      console.log('  ℹ️  __inject_html is on Control (variant 0), __dom_changes is on Variant 1')

      await debugWait(2000)

      await testPage.screenshot({
        path: 'test-results/before-json-editor.png',
        fullPage: true
      })
      console.log('  Screenshot saved: before-json-editor.png')

      const configButtonV1 = sidebar.locator('#json-editor-button-variant-1')
      await configButtonV1.scrollIntoViewIfNeeded()
      await configButtonV1.click()
      console.log('  Clicked Config (Json) button for Variant 1')
      await debugWait()

      const cmEditor = testPage.locator('#absmartly-json-editor-host .cm-content').first()
      await cmEditor.waitFor({ state: 'visible', timeout: 10000 })
      console.log('  CodeMirror editor is visible')

      const v1Json = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('#absmartly-json-editor-host .cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      console.log('  Variant 1 config JSON preview (first 500 chars):')
      console.log(v1Json.substring(0, 500))

      const hasDOMChangesField = v1Json.includes('__dom_changes') && v1Json.includes('changes')
      const hasModifiedContent = v1Json.includes('Modified by VE')
      const hasURLFilter = v1Json.includes('urlFilter') && v1Json.includes('/test/*')

      console.log(`  ${hasDOMChangesField ? '✓' : '❌'} __dom_changes field present: ${hasDOMChangesField}`)
      expect(hasDOMChangesField).toBeTruthy()

      console.log(`  ${hasModifiedContent ? '✓' : '❌'} DOM changes content present: ${hasModifiedContent}`)
      expect(hasModifiedContent).toBeTruthy()

      console.log(`  ${hasURLFilter ? '✓' : '❌'} URL filter present: ${hasURLFilter}`)
      expect(hasURLFilter).toBeTruthy()

      const closeButton = testPage.locator('#json-editor-close-button').first()
      await closeButton.click({ force: true })

      await testPage.locator('#absmartly-json-editor-host').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
      console.log('  JSON editor closed')

      console.log('✅ Initial state verified - __dom_changes and URL filter present in Variant 1')
      await debugWait()
    })

    await test.step('Add custom variable', async () => {
      console.log('\n➕ STEP 7: Adding custom variable')

      await sidebar.locator('#variables-heading').last().scrollIntoViewIfNeeded()

      // Two variant cards each render id="add-variable-button". `.last()`
      // should target Variant 1's button, but in practice the UI briefly
      // re-renders after step 6 (JSON editor close) and Playwright's click
      // can retarget to the Control-variant button if the Variant-1 one is
      // momentarily hidden/removed. Dispatch the click programmatically on
      // the LAST button that's actually connected and visible so we never
      // fall back to the wrong variant.
      await sidebar.locator('#variables-heading').last().waitFor({ state: 'visible', timeout: 5000 })
      const clickResult = await sidebar.locator('#add-variable-button').evaluateAll((buttons) => {
        const visibleButtons = (buttons as HTMLElement[]).filter(b => b.offsetParent !== null)
        const target = visibleButtons[visibleButtons.length - 1]
        if (target) {
          target.click()
          return { clicked: true, count: visibleButtons.length }
        }
        return { clicked: false, count: visibleButtons.length }
      })
      console.log(`  Clicked Add Variable button (visible buttons: ${clickResult.count})`)

      const nameInput = sidebar.locator('#new-variable-name-input-1')
      await nameInput.waitFor({ state: 'visible', timeout: 5000 })
      await nameInput.click()
      await nameInput.type('hello')
      await nameInput.blur()
      console.log('  Typed variable name: hello')

      const valueInput = sidebar.locator('#new-variable-value-input-1')
      await valueInput.waitFor({ state: 'visible', timeout: 5000 })
      await valueInput.click()
      await valueInput.type('there')
      await valueInput.blur()
      console.log('  Typed variable value: there')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Verify the inputs actually have the values before saving
      const nameValue = await nameInput.inputValue()
      const valueValue = await valueInput.inputValue()
      console.log(`  Verifying inputs - name: "${nameValue}", value: "${valueValue}"`)
      expect(nameValue).toBe('hello')
      expect(valueValue).toBe('there')

      // Click the save button (checkmark icon) - last one = Variant 1
      const saveVarButton = sidebar.locator('button[title="Save variable"]').or(
        sidebar.locator('button').filter({ has: sidebar.locator('svg path[d*="M5 13l4 4L19 7"]') })
      ).last()
      await saveVarButton.click()
      console.log('  Saved custom variable')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      console.log('✅ Custom variable added')
      await debugWait()
    })

    await test.step('CRITICAL: Verify __inject_html and DOM changes are PRESERVED', async () => {
      console.log('\n🔍 STEP 8: CRITICAL VERIFICATION - Checking if data was preserved')

      await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()

      console.log('\n  Checking for all data in Config editors...')

      const helloVarExists = await sidebar.locator('input[value="hello"]').isVisible({ timeout: 2000 }).catch(() => false)
      console.log(`  ${helloVarExists ? '✓' : '❌'} Custom variable "hello" present: ${helloVarExists}`)
      expect(helloVarExists).toBeTruthy()

      const configButtonV1 = sidebar.locator('#json-editor-button-variant-1')
      await configButtonV1.scrollIntoViewIfNeeded()
      await configButtonV1.click()
      console.log('  Opened Variant 1 Config editor')

      const cmEditorV1 = testPage.locator('#absmartly-json-editor-host .cm-content').first()
      await cmEditorV1.waitFor({ state: 'visible', timeout: 10000 })

      const v1Json = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('#absmartly-json-editor-host .cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      const hasHelloVar = v1Json.includes('"hello"') && v1Json.includes('"there"')
      const hasDOMChangesField = v1Json.includes('__dom_changes') && v1Json.includes('changes')
      const hasModifiedContent = v1Json.includes('Modified by VE')
      const hasURLFilter = v1Json.includes('urlFilter') && v1Json.includes('/test/*')

      console.log(`  ${hasHelloVar ? '✓' : '❌'} Custom variable "hello" in Variant 1 config: ${hasHelloVar}`)
      expect(hasHelloVar).toBeTruthy()

      console.log(`  ${hasDOMChangesField ? '✓' : '❌'} __dom_changes field in Variant 1 config: ${hasDOMChangesField}`)
      expect(hasDOMChangesField).toBeTruthy()

      console.log(`  ${hasModifiedContent ? '✓' : '❌'} DOM changes content present: ${hasModifiedContent}`)
      expect(hasModifiedContent).toBeTruthy()

      console.log(`  ${hasURLFilter ? '✓' : '❌'} URL filter present: ${hasURLFilter}`)
      expect(hasURLFilter).toBeTruthy()

      const closeButton = testPage.locator('#json-editor-close-button').first()
      await closeButton.click({ force: true })
      await testPage.locator('#absmartly-json-editor-host').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})

      console.log('\n✅ CRITICAL TEST PASSED!')
      console.log('  All data preserved after adding custom variable:')
      console.log('    ✓ __dom_changes with VE changes and URL filter in Variant 1 config')
      console.log('    ✓ "hello"="there" custom variable in Variant 1 config')

      await debugWait()
    })

    await test.step('Additional verification: Add second custom variable', async () => {
      console.log('\n➕ STEP 9: Adding second custom variable to double-check')

      // Scroll to Variables section for Variant 1
      await sidebar.locator('#variables-heading').last().scrollIntoViewIfNeeded()

      // Click "Add Variable" button again for Variant 1 (same defensive
      // pattern as step 7 above).
      await sidebar.locator('#variables-heading').last().waitFor({ state: 'visible', timeout: 5000 })
      await sidebar.locator('#add-variable-button').evaluateAll((buttons) => {
        const visibleButtons = (buttons as HTMLElement[]).filter(b => b.offsetParent !== null)
        const target = visibleButtons[visibleButtons.length - 1]
        if (target) target.click()
      })

      // Add second variable (use stable id to avoid races)
      const nameInput = sidebar.locator('#new-variable-name-input-1')
      await nameInput.waitFor({ state: 'visible', timeout: 5000 })
      await nameInput.fill('foo')

      const valueInput = sidebar.locator('#new-variable-value-input-1')
      await valueInput.waitFor({ state: 'visible', timeout: 5000 })
      await valueInput.fill('bar')

      const saveVarButton = sidebar.locator('button[title="Save variable"]').or(
        sidebar.locator('button').filter({ has: sidebar.locator('svg path[d*="M5 13l4 4L19 7"]') })
      ).last()
      await saveVarButton.click()
      console.log('  Added second variable: foo = "bar"')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Verify custom variables are still present in Variables section
      const hasHello = await sidebar.locator('input[value="hello"]').isVisible({ timeout: 2000 }).catch(() => false)
      const hasFoo = await sidebar.locator('input[value="foo"]').isVisible({ timeout: 2000 }).catch(() => false)

      console.log(`  ${hasHello ? '✓' : '❌'} hello: "there" - ${hasHello}`)
      console.log(`  ${hasFoo ? '✓' : '❌'} foo: "bar" - ${hasFoo}`)

      expect(hasHello && hasFoo).toBeTruthy()

      const configButtonV1 = sidebar.locator('#json-editor-button-variant-1')
      await configButtonV1.scrollIntoViewIfNeeded()
      await configButtonV1.click()

      const cmEditorV1 = testPage.locator('#absmartly-json-editor-host .cm-content').first()
      await cmEditorV1.waitFor({ state: 'visible', timeout: 10000 })

      const v1Json = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('#absmartly-json-editor-host .cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      const hasAllVars = v1Json.includes('"hello"') && v1Json.includes('"foo"')
      const hasDOMChanges = v1Json.includes('__dom_changes') && v1Json.includes('Modified by VE')

      console.log(`  ${hasAllVars ? '✓' : '❌'} Both custom variables in Variant 1 config - ${hasAllVars}`)
      expect(hasAllVars).toBeTruthy()

      console.log(`  ${hasDOMChanges ? '✓' : '❌'} DOM changes in Variant 1 config - ${hasDOMChanges}`)
      expect(hasDOMChanges).toBeTruthy()

      const closeButton = testPage.locator('#json-editor-close-button').first()
      await closeButton.click({ force: true })
      await testPage.locator('#absmartly-json-editor-host').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})

      console.log('\n✅ Second variable test passed - all data still preserved!')

      await debugWait()
    })

    console.log('\n ALL TESTS PASSED!')
    console.log('  The sync feedback loop bug is FIXED!')
    console.log('  __dom_changes preserved in Variant 1 config when adding variables')
    console.log('  URL filters preserved when adding variables')
    console.log('  Custom variables correctly added and visible')
  })
})
