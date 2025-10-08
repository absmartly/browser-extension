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

### Step 3: Use Proper Test Selectors

**Avoid complex, fragile selectors. Use stable selectors or add data-testid to components.**

**Selector priority** (best to worst):
1. ✅ `data-testid` attributes (most stable)
2. ✅ Semantic IDs (`#save-button`)
3. ✅ ARIA labels (`button[aria-label="Close"]`)
4. ⚠️ Text content (`button:has-text("Save")`)
5. ❌ CSS classes (fragile)
6. ❌ Complex combinators (very fragile)

**When selectors get complex, ADD data-testid to the component:**

```tsx
// ❌ BAD: Fragile selector
await sidebar.locator('div.flex > div > button.bg-blue-500').click()

// ✅ GOOD: Add data-testid to component
<button data-testid="create-button" onClick={handleCreate}>Create</button>

// Then use in test:
await sidebar.locator('[data-testid="create-button"]').click()
```

### Step 4: Key Testing Patterns

**Interacting with sidebar elements:**
```typescript
// Prefer data-testid when available
await sidebar.locator('[data-testid="visual-editor-button"]').click()

// Fallback to text content
await sidebar.locator('button:has-text("Visual Editor")').click()

// Fill inputs
await sidebar.locator('[data-testid="experiment-name-input"]').fill('Test')

// Select dropdowns
await sidebar.locator('select[name="unitType"]').selectOption('user')
```

**Interacting with page elements:**
```typescript
// Use IDs for test page elements
await testPage.click('#test-button')
await testPage.fill('#test-input', 'test value')

// Verify content
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

**IMPORTANT**: Playwright's `.click()` does NOT work reliably with React components in headless mode. Regular HTML works fine, but React event handlers often don't fire.

```typescript
// ❌ DON'T: Regular .click() fails for React components in headless
await sidebar.locator('button:has-text("Create")').click()

// ✅ DO: Use dispatchEvent for React components
await sidebar.locator('button:has-text("Create")').evaluate((button) => {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})

// ✅ OK: Regular .click() works fine for plain HTML
await testPage.click('#html-button')
```

**When to use dispatchEvent**:
- ✅ ALL React components in sidebar (buttons, dropdowns, etc.)
- ✅ Any element with `onClick` JSX handlers
- ❌ NOT needed for plain HTML elements in test pages

**When regular .click() works**:
- ✅ Plain HTML elements without React
- ✅ Visual editor UI (not React components)

**Why**: React's synthetic event system in headless Chrome doesn't receive native click events properly. `dispatchEvent` creates DOM events that trigger React handlers correctly.

### Step 5: Debug with Screenshots and Slow Mode

**Add `debugWait()` after each test step** for better visual inspection:

```typescript
await test.step('Click button', async () => {
  await sidebar.locator('[data-testid="save-button"]').evaluate(btn =>
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  )
  console.log('  ✓ Clicked save button')
  await debugWait() // Only waits if SLOW=1 - allows visual inspection
})

// Take screenshots at key points
await testPage.screenshot({
  path: 'test-results/after-save.png',
  fullPage: true
})
console.log('  📸 Screenshot saved: after-save.png')
```

**Run in slow mode to see test execution**:
```bash
SLOW=1 npx playwright test tests/e2e/my-test.spec.ts --headed
```

## Common Helpers from test-helpers.ts

```typescript
// Inject sidebar iframe
const sidebar = await injectSidebar(testPage, extensionUrl)

// Wait in slow mode (300ms default, does nothing if SLOW != 1)
await debugWait()
await debugWait(500) // Custom duration

// Set up console logging
const messages = setupConsoleLogging(testPage, (msg) =>
  msg.text.includes('[ABsmartly]')
)
```

**Best practice**: Add `await debugWait()` after every significant action (clicks, fills, waits) to make headed test execution more watchable.

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
4. ✅ **Use `dispatchEvent` for React components** - `.click()` fails for React in headless mode
5. ✅ **Prefer `data-testid` selectors** - add them to components when needed
6. ✅ **No need to mock chrome.runtime** - automatic polyfilling via postMessage
7. ✅ **Take screenshots for debugging**
8. ✅ **Use test.step() for clear test organization**

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
