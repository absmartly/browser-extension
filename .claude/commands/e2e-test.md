# E2E Test Builder

You are helping to create an end-to-end (E2E) test for the ABsmartly Browser Extension using Playwright.

## Test Architecture Pattern

All E2E tests in this project follow a specific pattern to work outside of a real browser extension context:

### 1. HTML Test Page + Sidebar Iframe Pattern

**Always create or use an HTML test page** and inject the sidebar as an iframe. This is the ONLY pattern we use.

Example from `visual-editor-complete.spec.ts:87-103`:
```typescript
const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

await test.step('Inject sidebar', async () => {
  console.log('\n📂 STEP 1: Injecting sidebar')
  sidebar = await injectSidebar(testPage, extensionUrl)
  console.log('✅ Sidebar visible')

  // ... rest of test setup
})
```

The `injectSidebar` helper (from `tests/e2e/utils/test-helpers.ts`) creates a fixed-position iframe on the right side of the page.

### 2. Query String Parameters for Test Mode

**CRITICAL**: Always add these query parameters to the test page URL to disable shadow DOM and enable test-friendly behavior:

```typescript
await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
```

**Why this matters:**
- Visual editor components (context menu, dialogs, banner) normally use Shadow DOM
- Playwright cannot interact with Shadow DOM elements reliably
- The query param `use_shadow_dom_for_visual_editor_context_menu=0` disables Shadow DOM in visual editor components
- This is checked in `src/visual-editor/ui/components.ts:50` and `src/visual-editor/core/context-menu.ts:30`

Example from `visual-editor-complete.spec.ts:65-72`:
```typescript
await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
await testPage.setViewportSize({ width: 1920, height: 1080 })
await testPage.waitForLoadState('networkidle')

// Enable test mode to disable shadow DOM for easier testing
await testPage.evaluate(() => {
  (window as any).__absmartlyTestMode = true
})
```

### 3. Message Polyfilling Pattern

In a real extension, components use `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`. In tests, these APIs don't exist.

**The code automatically detects test mode** and uses `window.postMessage` instead:

From `index.tsx:14-42`:
```typescript
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  // Real extension context - use chrome.runtime
  chrome.runtime.onMessage.addListener(...)
} else {
  // Test mode - use window.postMessage polyfill
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'absmartly-content-script' && event.data?.responseId) {
      // Handle polyfilled messages
      window.postMessage({
        source: 'absmartly-extension',
        responseId: event.data.responseId,
        response: response
      }, '*')
    }
  })
}
```

**You don't need to mock chrome.runtime** - the code handles this automatically!

## Step-by-Step Test Creation Guide

When creating a new E2E test, follow these steps:

### Step 1: Create HTML Test Page (if needed)

Create a simple HTML file in `tests/test-pages/` with test elements:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Feature Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .test-element { padding: 20px; margin: 20px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="test-title">Test Page Title</h1>
    <p id="test-paragraph">Test content</p>
    <button id="test-button">Test Button</button>
  </div>
</body>
</html>
```

### Step 2: Create Test Spec File

Create a new test file in `tests/e2e/` following this template:

```typescript
import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'my-feature-test.html')

test.describe('My Feature Tests', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener for debugging
    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    // CRITICAL: Add query param to disable shadow DOM
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

  test('should test my feature', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Test my feature', async () => {
      console.log('\n🧪 STEP 2: Testing feature...')

      // Your test code here
      // Use sidebar.locator() for sidebar elements
      // Use testPage.locator() for page elements

      await debugWait()
    })

    // Add more test steps as needed
  })
})
```

### Step 3: Key Testing Patterns

**Interacting with sidebar elements:**
```typescript
// Click buttons in sidebar
await sidebar.locator('button:has-text("Visual Editor")').click()

// Fill inputs in sidebar
await sidebar.locator('input[placeholder="Experiment name"]').fill('Test Experiment')

// Select dropdown options in sidebar
await sidebar.locator('select[name="unitType"]').selectOption('user')
```

**Interacting with page elements:**
```typescript
// Click elements on test page
await testPage.click('#test-button')

// Type in page elements
await testPage.fill('#test-input', 'test value')

// Verify page content
const text = await testPage.textContent('#test-paragraph')
expect(text).toBe('Expected text')
```

**Interacting with visual editor (no shadow DOM):**
```typescript
// Context menu works directly (no shadow DOM in test mode)
await testPage.click('#test-element')
await testPage.locator('.menu-container').waitFor({ state: 'visible' })
await testPage.locator('.menu-item:has-text("Edit Text")').click()

// Banner buttons work directly
await testPage.locator('[data-action="save"]').click()
await testPage.locator('[data-action="exit"]').click()
```

### Step 4: Use dispatchEvent for React Components

In headless mode, React handlers sometimes don't fire with regular clicks. Use `dispatchEvent`:

```typescript
// Use dispatchEvent for React buttons in headless mode
await sidebar.locator('button:has-text("Create")').evaluate((button) => {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})
```

### Step 5: Debug with Screenshots

Take screenshots at key points to debug test failures:

```typescript
await testPage.screenshot({
  path: 'test-results/feature-state.png',
  fullPage: true
})
console.log('  📸 Screenshot saved: feature-state.png')
```

## Common Helpers from test-helpers.ts

```typescript
// Inject sidebar iframe
const sidebar = await injectSidebar(testPage, extensionUrl)

// Wait in slow mode (for debugging)
await debugWait(500) // only waits if SLOW=1 env var

// Set up console logging
const messages = setupConsoleLogging(testPage, (msg) =>
  msg.text.includes('[ABsmartly]')
)
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (visual debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/my-feature.spec.ts

# Run in debug mode with console logs
DEBUG=1 npx playwright test tests/e2e/my-feature.spec.ts

# Run in slow mode (with debugWait delays for visual inspection)
SLOW=1 npx playwright test tests/e2e/my-feature.spec.ts --headed
```

## Key Takeaways

1. ✅ **Always use HTML test page + sidebar iframe pattern**
2. ✅ **Always add `?use_shadow_dom_for_visual_editor_context_menu=0` query param**
3. ✅ **Set `__absmartlyTestMode = true` in page context**
4. ✅ **Use `dispatchEvent` for React components in headless mode**
5. ✅ **No need to mock chrome.runtime** - automatic polyfilling via postMessage
6. ✅ **Take screenshots for debugging**
7. ✅ **Use test.step() for clear test organization**

## Example: Full Reference Test

See `tests/e2e/visual-editor-complete.spec.ts` for a comprehensive example that demonstrates:
- Creating experiments from scratch
- Launching visual editor
- Making DOM changes (text, hide, delete, HTML, images)
- Undo/redo functionality
- Preview toggle
- URL filtering
- Multiple VE launches
- Saving changes

This is the gold standard reference for E2E test patterns in this project.
