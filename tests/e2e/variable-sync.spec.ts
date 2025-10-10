import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging, click } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'variable-sync-test.html')

test.describe('Variable Sync - __inject_html and DOM Changes Preservation', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, seedStorage }) => {
    // Seed credentials before each test
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })

    testPage = await context.newPage()

    // Set up console listener
    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]') || msg.text.includes('[VariantList]')
    )

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Should preserve __inject_html and DOM changes when adding custom variables', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 60000 : 45000)

    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
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
      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
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
      await sidebar.locator('label:has-text("Traffic")').click()
      await testPage.waitForTimeout(1000)

      console.log('✅ Experiment form filled')
      await debugWait()
    })

    await test.step('Add __inject_html code', async () => {
      console.log('\n💉 STEP 3: Adding injection code')

      // Find and expand the Custom Code Injection section
      const injectionButton = sidebar.locator('button:has-text("Custom Code Injection")').first()
      await injectionButton.scrollIntoViewIfNeeded()

      // Check if already expanded by looking for the card sections
      const isExpanded = await sidebar.locator('text="Start of <head>"').isVisible({ timeout: 1000 }).catch(() => false)

      if (!isExpanded) {
        await injectionButton.click()
        console.log('  Expanded Custom Code Injection section')
        await testPage.waitForTimeout(500)
      }

      // Click on "Start of <head>" card to open editor
      const headStartCard = sidebar.locator('text="Start of <head>"').first()
      await headStartCard.scrollIntoViewIfNeeded()
      await click(sidebar, headStartCard)
      console.log('  Clicked Start of <head> card')
      await testPage.waitForTimeout(2000) // Give time for message to be sent and received

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
      await testPage.waitForTimeout(500)

      // Click Save button in the editor container
      const saveButton = editorContainer.locator('button:has-text("Save")').first()
      await saveButton.click()
      console.log('  Saved injection code')
      await testPage.waitForTimeout(1000)

      console.log('✅ Injection code added')

      // Wait longer for injection code to sync to VariantList
      await testPage.waitForTimeout(2000)
      console.log('  Waited for injection code to sync')
      await debugWait()
    })

    await test.step('Add DOM changes via Visual Editor', async () => {
      console.log('\n🎨 STEP 4: Adding DOM changes via Visual Editor')

      const visualEditorButton = sidebar.locator('button:has-text("Visual Editor")').first()
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
      await testPage.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
      await testPage.locator('.menu-item:has-text("Edit Text")').click({ timeout: 5000 })
      await testPage.keyboard.type('Modified by VE!')
      await testPage.keyboard.press('Enter')
      console.log('  Text change made')
      await debugWait()

      // Save changes
      await testPage.locator('[data-action="save"]').click({ timeout: 5000 })
      console.log('  Saved VE changes')
      await testPage.waitForTimeout(2000)

      console.log('✅ DOM changes added')
      await debugWait()
    })

    await test.step('Add URL filter configuration', async () => {
      console.log('\n🔗 STEP 5: Adding URL filter')

      // Scroll to variant 1 section
      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()

      // Find and expand URL Filtering section
      const urlFilterButton = sidebar.locator('button:has-text("URL Filtering")').first()
      await urlFilterButton.scrollIntoViewIfNeeded()

      const isExpanded = await sidebar.locator('select[value="all"], select[value="simple"]').first().isVisible({ timeout: 1000 }).catch(() => false)

      if (!isExpanded) {
        await urlFilterButton.click()
        console.log('  Expanded URL Filtering section')
        await testPage.waitForTimeout(500)
      }

      // Select simple mode
      const modeSelect = sidebar.locator('select').filter({ has: sidebar.locator('option:has-text("Apply on all pages")') }).first()
      await modeSelect.waitFor({ state: 'visible', timeout: 5000 })
      await modeSelect.selectOption('simple')
      console.log('  Selected simple URL filter mode')
      await testPage.waitForTimeout(500)

      // Add URL pattern
      const patternInput = sidebar.locator('input[placeholder*="/products/*"]').first()
      await patternInput.waitFor({ state: 'visible', timeout: 5000 })
      await patternInput.fill('/test/*')
      await patternInput.blur()
      console.log('  Added URL filter pattern: /test/*')
      await testPage.waitForTimeout(500)

      console.log('✅ URL filter configured')
      await debugWait()
    })

    await test.step('Verify initial state before adding custom variable', async () => {
      console.log('\n🔍 STEP 6: Verifying initial state (before custom variable)')

      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()

      // NOTE: __inject_html should NOT appear as a regular variable in the Variables section
      // It's a special field that should only be visible in the Config editor JSON
      console.log('  ℹ️  __inject_html and __dom_changes are special fields, not regular variables')

      // Open Config editor to check full variant configuration
      const configButton = sidebar.locator('button:has-text("Config")').first()
      await configButton.scrollIntoViewIfNeeded()
      await configButton.click()
      console.log('  Opened Variant Config editor')
      await testPage.waitForTimeout(1000)

      // Get JSON content (this is the full variant config)
      const jsonContent = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('.cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      console.log('  Variant config JSON preview (first 500 chars):')
      console.log(jsonContent.substring(0, 500))

      // Verify all three elements: __inject_html, __dom_changes, and DOM changes content
      const hasInjectHtml = jsonContent.includes('__inject_html') && jsonContent.includes('Test injection code')
      const hasDOMChangesField = jsonContent.includes('__dom_changes') && jsonContent.includes('changes')
      const hasModifiedContent = jsonContent.includes('Modified by VE')
      const hasURLFilter = jsonContent.includes('urlFilter') && jsonContent.includes('/test/*')

      console.log(`  ${hasInjectHtml ? '✓' : '❌'} __inject_html field present: ${hasInjectHtml}`)
      expect(hasInjectHtml).toBeTruthy()

      console.log(`  ${hasDOMChangesField ? '✓' : '❌'} __dom_changes field present: ${hasDOMChangesField}`)
      expect(hasDOMChangesField).toBeTruthy()

      console.log(`  ${hasModifiedContent ? '✓' : '❌'} DOM changes content present: ${hasModifiedContent}`)
      expect(hasModifiedContent).toBeTruthy()

      console.log(`  ${hasURLFilter ? '✓' : '❌'} URL filter present: ${hasURLFilter}`)
      expect(hasURLFilter).toBeTruthy()

      // Close JSON editor
      const closeButton = testPage.locator('button:has-text("Cancel"), button:has-text("Close")').first()
      await closeButton.click()
      await testPage.waitForTimeout(500)

      console.log('✅ Initial state verified - all three elements present')
      await debugWait()
    })

    await test.step('Add custom variable', async () => {
      console.log('\n➕ STEP 7: Adding custom variable')

      // Scroll to Variables section
      await sidebar.locator('h5:has-text("Variables")').first().scrollIntoViewIfNeeded()

      // Click "Add Variable" button
      const addVarButton = sidebar.locator('button:has-text("Add Variable")').first()
      await addVarButton.scrollIntoViewIfNeeded()
      await addVarButton.click()
      console.log('  Clicked Add Variable button')
      await testPage.waitForTimeout(500)

      // The inline form should now be visible
      const nameInput = sidebar.locator('input[placeholder="Variable name"]').first()
      await nameInput.waitFor({ state: 'visible', timeout: 5000 })
      await nameInput.click()
      await nameInput.type('hello')
      await nameInput.blur() // Trigger onChange by blurring
      console.log('  Typed variable name: hello')
      await testPage.waitForTimeout(200)

      const valueInput = sidebar.locator('input[placeholder="Variable value"]').first()
      await valueInput.waitFor({ state: 'visible', timeout: 5000 })
      await valueInput.click()
      await valueInput.type('there')
      await valueInput.blur() // Trigger onChange by blurring
      console.log('  Typed variable value: there')
      await testPage.waitForTimeout(500) // Longer wait for React state to update

      // Verify the inputs actually have the values before saving
      const nameValue = await nameInput.inputValue()
      const valueValue = await valueInput.inputValue()
      console.log(`  Verifying inputs - name: "${nameValue}", value: "${valueValue}"`)
      expect(nameValue).toBe('hello')
      expect(valueValue).toBe('there')

      // Click the save button (checkmark icon)
      const saveVarButton = sidebar.locator('button[title="Save variable"]').or(
        sidebar.locator('button').filter({ has: sidebar.locator('svg path[d*="M5 13l4 4L19 7"]') })
      ).first()
      await saveVarButton.click()
      console.log('  Saved custom variable')
      await testPage.waitForTimeout(1000)

      console.log('✅ Custom variable added')
      await debugWait()
    })

    await test.step('CRITICAL: Verify __inject_html and DOM changes are PRESERVED', async () => {
      console.log('\n🔍 STEP 8: CRITICAL VERIFICATION - Checking if data was preserved')

      // Wait a moment for React state to settle
      await testPage.waitForTimeout(1000)

      await sidebar.locator('input[value="Variant 1"]').scrollIntoViewIfNeeded()

      // CRITICAL CHECKS: All three elements MUST be present
      console.log('\n  🔬 Checking for all data in Config editor...')

      // Check 1: Custom variable "hello" in Variables section
      const helloVarExists = await sidebar.locator('input[value="hello"]').isVisible({ timeout: 2000 }).catch(() => false)
      console.log(`  ${helloVarExists ? '✓' : '❌'} Custom variable "hello" present: ${helloVarExists}`)
      expect(helloVarExists).toBeTruthy()

      // Skip checking input value - go straight to JSON config
      // The value input might not update properly in tests, but the actual config should be correct

      // Check Full variant config via Config editor
      const configButton = sidebar.locator('button:has-text("Config")').first()
      await configButton.scrollIntoViewIfNeeded()
      await configButton.click()
      console.log('  Opened Variant Config editor')
      await testPage.waitForTimeout(1000)

      const jsonContent = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('.cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      // Verify all fields in the config
      const hasHelloVar = jsonContent.includes('"hello"') && jsonContent.includes('"there"')
      const hasInjectHtmlField = jsonContent.includes('__inject_html') && jsonContent.includes('Test injection code')
      const hasDOMChangesField = jsonContent.includes('__dom_changes') && jsonContent.includes('changes')
      const hasModifiedContent = jsonContent.includes('Modified by VE')
      const hasURLFilter = jsonContent.includes('urlFilter') && jsonContent.includes('/test/*')

      console.log(`  ${hasHelloVar ? '✓' : '❌'} Custom variable "hello" in config: ${hasHelloVar}`)
      expect(hasHelloVar).toBeTruthy()

      console.log(`  ${hasInjectHtmlField ? '✓' : '❌'} __inject_html field in config: ${hasInjectHtmlField}`)
      expect(hasInjectHtmlField).toBeTruthy()

      console.log(`  ${hasDOMChangesField ? '✓' : '❌'} __dom_changes field in config: ${hasDOMChangesField}`)
      expect(hasDOMChangesField).toBeTruthy()

      console.log(`  ${hasModifiedContent ? '✓' : '❌'} DOM changes content present: ${hasModifiedContent}`)
      expect(hasModifiedContent).toBeTruthy()

      console.log(`  ${hasURLFilter ? '✓' : '❌'} URL filter present: ${hasURLFilter}`)
      expect(hasURLFilter).toBeTruthy()

      // Close JSON editor
      const closeButton = testPage.locator('button:has-text("Cancel"), button:has-text("Close")').first()
      await closeButton.click()
      await testPage.waitForTimeout(500)

      console.log('\n✅ CRITICAL TEST PASSED!')
      console.log('  All data preserved after adding custom variable:')
      console.log('    ✓ __inject_html (in full config JSON)')
      console.log('    ✓ __dom_changes with VE changes and URL filter (in full config JSON)')
      console.log('    ✓ "hello"="there" custom variable')

      await debugWait()
    })

    await test.step('Additional verification: Add second custom variable', async () => {
      console.log('\n➕ STEP 9: Adding second custom variable to double-check')

      // Scroll to Variables section
      await sidebar.locator('h5:has-text("Variables")').first().scrollIntoViewIfNeeded()

      // Click "Add Variable" button again
      const addVarButton = sidebar.locator('button:has-text("Add Variable")').first()
      await addVarButton.scrollIntoViewIfNeeded()
      await addVarButton.click()
      await testPage.waitForTimeout(500)

      // Add second variable
      const nameInput = sidebar.locator('input[placeholder="Variable name"]').first()
      await nameInput.fill('foo')

      const valueInput = sidebar.locator('input[placeholder="Variable value"]').first()
      await valueInput.fill('bar')

      const saveVarButton = sidebar.locator('button[title="Save variable"]').or(
        sidebar.locator('button').filter({ has: sidebar.locator('svg path[d*="M5 13l4 4L19 7"]') })
      ).first()
      await saveVarButton.click()
      console.log('  Added second variable: foo = "bar"')
      await testPage.waitForTimeout(1000)

      // Verify custom variables are still present in Variables section
      const hasHello = await sidebar.locator('input[value="hello"]').isVisible({ timeout: 2000 }).catch(() => false)
      const hasFoo = await sidebar.locator('input[value="foo"]').isVisible({ timeout: 2000 }).catch(() => false)

      console.log(`  ${hasHello ? '✓' : '❌'} hello: "there" - ${hasHello}`)
      console.log(`  ${hasFoo ? '✓' : '❌'} foo: "bar" - ${hasFoo}`)

      expect(hasHello && hasFoo).toBeTruthy()

      // Check full variant config via Config editor
      const configButton = sidebar.locator('button:has-text("Config")').first()
      await configButton.scrollIntoViewIfNeeded()
      await configButton.click()
      await testPage.waitForTimeout(1000)

      const jsonContent = await testPage.evaluate(() => {
        const cmEditor = document.querySelector('.cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      // Verify all variables are in the config
      const hasAllVars = jsonContent.includes('"hello"') && jsonContent.includes('"foo"') && jsonContent.includes('__inject_html')
      const hasDOMChanges = jsonContent.includes('__dom_changes') && jsonContent.includes('Modified by VE')

      console.log(`  ${hasAllVars ? '✓' : '❌'} All variables in config - ${hasAllVars}`)
      expect(hasAllVars).toBeTruthy()

      console.log(`  ${hasDOMChanges ? '✓' : '❌'} DOM changes in config - ${hasDOMChanges}`)
      expect(hasDOMChanges).toBeTruthy()

      console.log('\n✅ Second variable test passed - all data still preserved!')

      // Close JSON editor
      const closeButton = testPage.locator('button:has-text("Cancel"), button:has-text("Close")').first()
      await closeButton.click()

      await debugWait()
    })

    console.log('\n🎉 ALL TESTS PASSED!')
    console.log('  The sync feedback loop bug is FIXED!')
    console.log('  ✓ __inject_html preserved when adding variables (visible in full config)')
    console.log('  ✓ __dom_changes preserved when adding variables (visible in full config)')
    console.log('  ✓ URL filters preserved when adding variables')
    console.log('  ✓ Custom variables correctly added and visible')
  })
})
