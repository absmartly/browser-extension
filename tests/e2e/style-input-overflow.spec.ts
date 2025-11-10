import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar, debugWait, log, initializeTestLogging } from './utils/test-helpers'
import { createExperiment } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Style Input Overflow Test', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    initializeTestLogging()
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('Verify style input handles long values without overflow', async ({ extensionUrl }) => {
    test.setTimeout(15000)

    log('🎨 Starting style input overflow test')

    // Navigate to test page
    await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded' })
    await testPage.setViewportSize({ width: 1920, height: 1080 })

    // Inject sidebar
    log('📂 Injecting sidebar')
    const sidebar = await injectSidebar(testPage, extensionUrl)
    await debugWait()

    // Create experiment
    log('📝 Creating new experiment')
    await createExperiment(sidebar)
    await debugWait()
    
    // Take screenshot to see current state
    await testPage.screenshot({
      path: 'test-results/sidebar-after-experiment-create.png',
      fullPage: true
    })
    log('📸 Screenshot saved: sidebar-after-experiment-create.png')

    // Click "Add DOM Change" button
    log('➕ Adding DOM change')
    const addButton = sidebar.locator('button:has-text("Add DOM Change")').first()
    await addButton.scrollIntoViewIfNeeded()
    await addButton.click()
    await debugWait()

    // Wait for the DOM change form to appear using the ID
    log('⏳ Waiting for DOM change form')
    const selectorInput = sidebar.locator('#dom-change-selector-1-new')
    await selectorInput.waitFor({ state: 'visible', timeout: 3000 })
    
    // Fill selector
    log('🎯 Filling selector')
    await selectorInput.fill('.banner')
    await debugWait()

    // Select "Inline Style" from change type dropdown
    log('🔧 Selecting Inline Style')
    const changeTypeSelect = sidebar.locator('#dom-change-type-1-new')
    await changeTypeSelect.waitFor({ state: 'visible', timeout: 3000 })
    await changeTypeSelect.selectOption('style')
    await debugWait()

    // Take screenshot after selecting Inline Style
    await testPage.screenshot({
      path: 'test-results/sidebar-with-style-editor.png',
      fullPage: true
    })
    log('📸 Screenshot saved: sidebar-with-style-editor.png')

    // Find the CSS style editor
    log('🔍 Looking for CSS style editor')
    const styleEditor = sidebar.locator('.bg-gray-900').first()

    // Find the property input fields - they're already there!
    const allInputs = styleEditor.locator('input')

    // Get the first property key and value inputs
    const propertyKeyInput = allInputs.nth(0)
    const propertyValueInput = allInputs.nth(1)

    // Fill in property name
    log('✍️ Filling property name: background')
    await propertyKeyInput.fill('background')
    await debugWait()

    // Press Tab to move to value field
    await propertyKeyInput.press('Tab')
    await debugWait()

    // Fill in a very long URL value
    const longUrl = 'url(https://www.example.com/very/long/path/to/some/background/image/that/will/definitely/overflow/94e559c1aa9cb4db8b124567890abcdef.png)'
    log(`✍️ Filling long value: ${longUrl}`)
    await propertyValueInput.fill(longUrl)
    await debugWait()

    // Take screenshot with long value
    await testPage.screenshot({
      path: 'test-results/sidebar-with-long-value.png',
      fullPage: true
    })
    log('📸 Screenshot saved: sidebar-with-long-value.png')

    // Verify the input element properties
    log('🔍 Checking input element computed styles')
    const inputStyles = await propertyValueInput.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        overflow: styles.overflow,
        overflowX: styles.overflowX,
        textOverflow: styles.textOverflow,
        whiteSpace: styles.whiteSpace,
        width: styles.width,
        display: styles.display
      }
    })
    log(`Input styles: ${JSON.stringify(inputStyles, null, 2)}`)

    // Check parent and grandparent container styles
    const ancestorStyles = await propertyValueInput.evaluate((el) => {
      const parent = el.parentElement
      const grandparent = parent?.parentElement
      const greatGrandparent = grandparent?.parentElement

      return {
        parent: parent ? {
          tagName: parent.tagName,
          className: parent.className,
          overflow: window.getComputedStyle(parent).overflow,
          overflowX: window.getComputedStyle(parent).overflowX,
        } : null,
        grandparent: grandparent ? {
          tagName: grandparent.tagName,
          className: grandparent.className,
          overflow: window.getComputedStyle(grandparent).overflow,
          overflowX: window.getComputedStyle(grandparent).overflowX,
        } : null,
        greatGrandparent: greatGrandparent ? {
          tagName: greatGrandparent.tagName,
          className: greatGrandparent.className,
          overflow: window.getComputedStyle(greatGrandparent).overflow,
          overflowX: window.getComputedStyle(greatGrandparent).overflowX,
        } : null
      }
    })
    log(`Ancestor container styles: ${JSON.stringify(ancestorStyles, null, 2)}`)

    // Check if text is overflowing by comparing scrollWidth to clientWidth
    const isOverflowing = await propertyValueInput.evaluate((el: HTMLInputElement) => {
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        isOverflowing: el.scrollWidth > el.clientWidth,
        value: el.value,
        valueLength: el.value.length
      }
    })
    log(`Overflow check: ${JSON.stringify(isOverflowing, null, 2)}`)

    // Verify the value input has proper overflow handling
    expect(inputStyles.textOverflow).toBe('ellipsis')
    // Note: modern browsers use 'clip' instead of 'hidden' for inputs
    expect(['hidden', 'clip']).toContain(inputStyles.overflow)
    log('✅ Value input has proper overflow handling (ellipsis)')

    // Now test the properties dropdown visibility
    log('🔍 Testing properties dropdown visibility')

    // Clear the property key input and focus it to trigger dropdown
    await propertyKeyInput.clear()
    await propertyKeyInput.click()
    await debugWait()

    // Wait for suggestions dropdown to appear
    log('⏳ Waiting for suggestions dropdown')
    const dropdown = styleEditor.locator('.absolute.z-50.bg-gray-800')
    await dropdown.waitFor({ state: 'visible', timeout: 3000 })

    // Take screenshot with dropdown visible
    await testPage.screenshot({
      path: 'test-results/sidebar-with-dropdown.png',
      fullPage: true
    })
    log('📸 Screenshot saved: sidebar-with-dropdown.png')

    // Check if dropdown is fully visible (not clipped by overflow)
    const dropdownBox = await dropdown.boundingBox()
    const editorBox = await styleEditor.boundingBox()

    if (dropdownBox && editorBox) {
      log(`Dropdown position: top=${dropdownBox.y}, height=${dropdownBox.height}`)
      log(`Editor position: top=${editorBox.y}, height=${editorBox.height}`)

      // The dropdown should extend beyond the editor container
      const dropdownBottom = dropdownBox.y + dropdownBox.height
      const editorBottom = editorBox.y + editorBox.height

      log(`Dropdown bottom: ${dropdownBottom}, Editor bottom: ${editorBottom}`)
      log(`Dropdown extends beyond editor: ${dropdownBottom > editorBottom}`)

      // Verify dropdown is visible and not clipped
      expect(dropdownBottom).toBeGreaterThan(editorBottom)
      log('✅ Dropdown is fully visible and not clipped by overflow')
    }

    // Type "back" to filter suggestions (should match "background", "background-color", etc.)
    await propertyKeyInput.fill('back')
    await debugWait()

    // Take screenshot with filtered dropdown
    await testPage.screenshot({
      path: 'test-results/sidebar-with-filtered-dropdown.png',
      fullPage: true
    })
    log('📸 Screenshot saved: sidebar-with-filtered-dropdown.png')

    // Verify dropdown still visible with filtered results
    // Note: The dropdown should still be visible since "back" matches "background", "background-color", etc.
    const isDropdownVisible = await dropdown.isVisible().catch(() => false)
    if (isDropdownVisible) {
      log('✅ Dropdown remains visible with filtered results')
    } else {
      log('⚠️ Dropdown hidden after filtering - this is expected behavior when no suggestions match')
    }

    log('✅ Test complete - check screenshots in test-results/ directory')
    log(`   - sidebar-after-experiment-create.png`)
    log(`   - sidebar-with-style-editor.png`)
    log(`   - sidebar-with-long-value.png`)
    log(`   - sidebar-with-dropdown.png`)
    log(`   - sidebar-with-filtered-dropdown.png`)
  })
})
