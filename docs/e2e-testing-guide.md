# E2E Testing Guide for ABsmartly Browser Extension

## Overview

This guide explains how to write end-to-end (E2E) tests for the ABsmartly Browser Extension using Playwright. The tests simulate user interactions with the extension sidebar and web pages without requiring a real browser extension context.

## Core Testing Pattern

### Architecture: HTML Test Page + Sidebar Iframe

All E2E tests follow this pattern:

1. **HTML Test Page**: A simple HTML file with test elements (buttons, paragraphs, etc.)
2. **Sidebar Iframe**: The extension sidebar injected as an iframe on the test page
3. **Test Mode**: Special query parameters and flags to disable Shadow DOM and enable message polyfilling

This pattern allows us to test the extension's UI and functionality in isolation without Chrome extension APIs.

## Critical Test Mode Behaviors

### 1. Shadow DOM Disabling

**Problem**: Visual editor components (context menu, dialogs, banner) use Shadow DOM by default. Playwright cannot reliably interact with Shadow DOM elements.

**Solution**: Add query parameter `use_shadow_dom_for_visual_editor_context_menu=0` to disable Shadow DOM in tests.

```typescript
// Always use this pattern when loading test pages
await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
```

**Implementation locations**:
- `src/visual-editor/ui/components.ts:50` - Checks query param for dialogs/banner
- `src/visual-editor/core/context-menu.ts:30` - Checks query param for context menu

When `use_shadow_dom_for_visual_editor_context_menu=0`:
- Context menu is attached directly to document body (no shadow root)
- Image dialog is attached directly to document body
- Banner is attached directly to document body
- All visual editor UI becomes accessible via standard Playwright selectors

### 2. Chrome Runtime Message Polyfilling

**Problem**: Extension code uses `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`, which don't exist in test context.

**Solution**: The code automatically detects test mode and uses `window.postMessage` instead.

**Implementation** (`index.tsx:14-42`):

```typescript
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  // Real extension context - use chrome.runtime
  chrome.runtime.onMessage.addListener(...)
} else {
  // Test mode - use window.postMessage polyfill
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'absmartly-content-script' && event.data?.responseId) {
      // Receive polyfilled message

      // Send mock response
      window.postMessage({
        source: 'absmartly-extension',
        responseId: event.data.responseId,
        response: mockResponse
      }, '*')
    }
  })
}
```

**What this means for tests**:
- ✅ No need to mock `chrome.runtime`
- ✅ Messages automatically work via `window.postMessage`
- ✅ Both sidebar and content scripts can communicate seamlessly
- ✅ Works exactly like real extension messaging

### 3. Test Mode Flag

Additionally, set `__absmartlyTestMode` flag for extra test-friendly behavior:

```typescript
await testPage.evaluate(() => {
  (window as any).__absmartlyTestMode = true
})
```

## Step-by-Step: Creating a New E2E Test

### Step 1: Create HTML Test Page

Create a file in `tests/test-pages/my-feature-test.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Feature Test Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
    }
    .test-button {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 10px 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="main-title">Test Page Title</h1>
    <p id="test-paragraph">Test paragraph content</p>
    <button id="test-button-1" class="test-button">Button 1</button>
    <button id="test-button-2" class="test-button">Button 2</button>
  </div>
</body>
</html>
```

**Best practices**:
- Use semantic IDs (`test-paragraph`, `test-button-1`)
- Keep styling minimal but clear
- Include various element types you'll test (buttons, inputs, text, etc.)

### Step 2: Create Test Spec File

Create `tests/e2e/my-feature.spec.ts`:

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

  test('should perform feature workflow', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Test feature interaction', async () => {
      console.log('\n🧪 STEP 2: Testing feature')

      // Interact with sidebar
      await sidebar.locator('button:has-text("My Button")').click()
      console.log('  ✓ Clicked sidebar button')

      // Verify page change
      const text = await testPage.textContent('#test-paragraph')
      expect(text).toBe('Expected text')
      console.log('  ✓ Verified page text')

      await debugWait()
    })
  })
})
```

### Step 3: Implement Test Interactions

#### Sidebar Interactions

```typescript
// Click buttons
await sidebar.locator('button:has-text("Visual Editor")').click()

// Fill text inputs
await sidebar.locator('input[placeholder="Experiment name"]').fill('Test Name')

// Select dropdowns
await sidebar.locator('select[name="unitType"]').selectOption('user')

// Verify sidebar content
const title = await sidebar.locator('h1').textContent()
expect(title).toContain('Experiments')

// Scroll within sidebar
await sidebar.locator('.some-element').scrollIntoViewIfNeeded()
```

#### Page Interactions

```typescript
// Click page elements
await testPage.click('#test-button-1')

// Fill page inputs
await testPage.fill('#test-input', 'test value')

// Get page element text
const text = await testPage.textContent('#test-paragraph')

// Evaluate JavaScript on page
const result = await testPage.evaluate(() => {
  const elem = document.querySelector('#test-element')
  return elem?.textContent
})

// Wait for page conditions
await testPage.waitForFunction(() => {
  return document.querySelector('#dynamic-content') !== null
}, { timeout: 5000 })
```

#### Visual Editor Interactions (No Shadow DOM)

Since shadow DOM is disabled in test mode, visual editor elements work like regular DOM:

```typescript
// Click element to show context menu
await testPage.click('#test-paragraph')
await testPage.locator('.menu-container').waitFor({ state: 'visible' })

// Click context menu item
await testPage.locator('.menu-item:has-text("Edit Text")').click()

// Interact with CodeMirror editor
await testPage.locator('.cm-editor').waitFor({ state: 'visible' })
await testPage.keyboard.press('Meta+A')
await testPage.keyboard.type('New content')

// Click banner buttons
await testPage.locator('[data-action="save"]').click()
await testPage.locator('[data-action="undo"]').click()
await testPage.locator('[data-action="exit"]').click()

// Interact with image dialog
await testPage.locator('.dialog-input').fill('https://example.com/image.jpg')
await testPage.locator('.dialog-button-apply').click()
```

### Step 4: Handle React Components in Headless Mode

React event handlers sometimes don't fire with regular clicks in headless mode. Use `dispatchEvent`:

```typescript
// Standard approach (may not work in headless)
await sidebar.locator('button:has-text("Create")').click()

// Reliable approach for React components
await sidebar.locator('button:has-text("Create")').evaluate((button) => {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})

// Also works for page elements
await testPage.locator('#react-button').evaluate((btn) => {
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})
```

**When to use `dispatchEvent`**:
- ✅ React components in sidebar
- ✅ Components in create/edit forms
- ✅ Dropdown triggers and menu items
- ✅ When regular `.click()` fails silently in headless mode

### Step 5: Debug with Screenshots and Logging

```typescript
// Take screenshots at key points
await testPage.screenshot({
  path: 'test-results/after-action.png',
  fullPage: true
})
console.log('  📸 Screenshot saved: after-action.png')

// Check console messages (already captured by setupConsoleLogging)
console.log(`  📋 Captured ${allConsoleMessages.length} console messages`)
const errors = allConsoleMessages.filter(m => m.type === 'error')
if (errors.length > 0) {
  console.log('  ❌ Console errors:', errors)
}

// Log test progress
console.log('  ✓ Step completed successfully')

// Wait in slow mode for visual inspection
await debugWait(1000) // Only waits if SLOW=1 env var
```

## Helper Functions

### injectSidebar(page, extensionUrl)

Injects the extension sidebar as an iframe on the test page.

```typescript
const sidebar = await injectSidebar(testPage, extensionUrl)

// Returns a FrameLocator for the sidebar iframe
await sidebar.locator('button').click()
```

**Implementation** (`tests/e2e/utils/test-helpers.ts:9-46`):
- Creates fixed-position sidebar on right side
- Sets up iframe with extension sidebar URL
- Returns Playwright FrameLocator for interactions

### debugWait(ms)

Conditional wait that only executes in slow mode (SLOW=1 env var).

```typescript
await debugWait(500) // Waits 500ms if SLOW=1, otherwise returns immediately
```

Useful for:
- Visual inspection during development
- Recording demo videos
- Debugging flaky tests

### setupConsoleLogging(page, filter)

Sets up console message capture for debugging.

```typescript
const messages = setupConsoleLogging(
  testPage,
  (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Error]')
)

// Later: check captured messages
console.log(`Captured ${messages.length} messages`)
const errors = messages.filter(m => m.type === 'error')
```

Returns array of `{type: string, text: string}` objects.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/my-feature.spec.ts

# Run with UI mode (visual debugging)
npm run test:e2e:ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode (with console logs)
DEBUG=1 npx playwright test tests/e2e/my-feature.spec.ts

# Run in slow mode (with debugWait delays)
SLOW=1 npx playwright test tests/e2e/my-feature.spec.ts --headed

# Run specific test by name
npx playwright test -g "should perform feature workflow"
```

## Common Patterns and Solutions

### Waiting for Elements

```typescript
// Wait for element to be visible
await testPage.locator('#element').waitFor({ state: 'visible', timeout: 5000 })

// Wait for element to be hidden
await testPage.locator('#element').waitFor({ state: 'hidden', timeout: 5000 })

// Wait for element to be enabled
await expect(sidebar.locator('button')).toBeEnabled({ timeout: 10000 })

// Wait for custom condition
await testPage.waitForFunction(() => {
  return (window as any).__visualEditorActive === true
}, { timeout: 5000 })
```

### Handling Dropdowns and Selects

```typescript
// Standard select element
await sidebar.locator('select[name="type"]').selectOption('value')

// Custom dropdown (click to open, then select)
await sidebar.locator('[data-testid="dropdown-trigger"]').click()
await sidebar.locator('[data-testid="dropdown-menu"]').waitFor({ state: 'visible' })
await sidebar.locator('div:has-text("Option 1")').click()

// Verify dropdown closed
await sidebar.locator('[data-testid="dropdown-menu"]').waitFor({ state: 'hidden' })
```

### Form Filling

```typescript
// Fill experiment creation form
await sidebar.locator('input[placeholder*="xperiment"]').fill('Test Experiment')

// Select unit type
await sidebar.locator('[data-testid="unit-type-select-trigger"]').click()
await sidebar.locator('[data-testid="unit-type-select-dropdown"]').waitFor({ state: 'visible' })
await sidebar.locator('div[class*="cursor-pointer"]').first().click()

// Verify form validation
await expect(sidebar.locator('button:has-text("Save")')).toBeEnabled()
```

### Testing Visual Editor Actions

```typescript
// Edit text
await testPage.click('#test-paragraph')
await testPage.locator('.menu-container').waitFor({ state: 'visible' })
await testPage.locator('.menu-item:has-text("Edit Text")').click()
await testPage.keyboard.type('New text')
await testPage.keyboard.press('Enter')

// Hide element
await testPage.click('#test-button')
await testPage.locator('.menu-item:has-text("Hide")').click()

// Verify element hidden
const display = await testPage.evaluate(() => {
  const elem = document.querySelector('#test-button')
  return window.getComputedStyle(elem).display
})
expect(display).toBe('none')

// Edit HTML with CodeMirror
await testPage.click('#test-container')
await testPage.locator('.menu-item:has-text("Edit HTML")').click()
await testPage.locator('.cm-editor').waitFor({ state: 'visible' })
await testPage.keyboard.press('Meta+A')
await testPage.keyboard.type('<div>New HTML</div>')
await testPage.locator('.editor-button-save').click()
```

### Undo/Redo Testing

```typescript
// Make multiple changes
for (let i = 0; i < 3; i++) {
  await testPage.click('#test-paragraph')
  await testPage.locator('.menu-item:has-text("Edit Text")').click()
  await testPage.fill('#test-paragraph', `Change ${i + 1}`)
  await testPage.locator('body').click({ position: { x: 5, y: 5 } })
}

// Test undo
await testPage.locator('[data-action="undo"]').click()
const text = await testPage.textContent('#test-paragraph')
expect(text).toBe('Change 2')

// Test redo
await testPage.locator('[data-action="redo"]').click()
const newText = await testPage.textContent('#test-paragraph')
expect(newText).toBe('Change 3')

// Verify button states
await expect(testPage.locator('[data-action="undo"]')).toBeEnabled()
await expect(testPage.locator('[data-action="redo"]')).toBeDisabled()
```

## Troubleshooting

### Test Fails: "Element not found"

**Cause**: Shadow DOM is enabled, or element not loaded yet.

**Solutions**:
1. Verify query param: `?use_shadow_dom_for_visual_editor_context_menu=0`
2. Add wait: `await element.waitFor({ state: 'visible' })`
3. Take screenshot to see actual state: `await testPage.screenshot({ path: 'debug.png' })`

### Test Fails: "Button click has no effect"

**Cause**: React handler not firing in headless mode.

**Solution**: Use `dispatchEvent`:
```typescript
await sidebar.locator('button').evaluate((btn) => {
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})
```

### Test Fails: "chrome.runtime is not defined"

**Cause**: Code trying to use chrome APIs in test context.

**Solution**: This should be handled automatically by the polyfill. Check:
1. Is `index.tsx` loaded in the sidebar?
2. Are you testing a code path that directly accesses `chrome.runtime` without checking for existence?

### Flaky Tests

**Common causes**:
1. **Race conditions**: Add explicit waits
2. **React state updates**: Add `await testPage.waitForTimeout(200)` after state changes
3. **Network delays**: Use `waitForLoadState('networkidle')`
4. **Animation timing**: Disable animations or wait for completion

**Solutions**:
```typescript
// Increase timeout for flaky elements
await element.waitFor({ state: 'visible', timeout: 10000 })

// Wait for network to settle
await testPage.waitForLoadState('networkidle')

// Add retry logic
let success = false
for (let i = 0; i < 3; i++) {
  try {
    await testPage.click('#flaky-button')
    success = true
    break
  } catch (e) {
    if (i === 2) throw e
    await testPage.waitForTimeout(1000)
  }
}
```

## Best Practices

### ✅ DO

- Use test.step() to organize tests into logical sections
- Add console.log statements to track test progress
- Take screenshots at key points
- Use descriptive variable names
- Add comments explaining complex interactions
- Use debugWait() for visual inspection during development
- Verify both UI state and DOM state
- Test both happy paths and edge cases

### ❌ DON'T

- Use arbitrary timeouts (`await page.waitForTimeout(5000)`) - use explicit waits instead
- Skip test cleanup (always close pages in afterEach)
- Test without the query param `use_shadow_dom_for_visual_editor_context_menu=0`
- Assume element exists without waiting
- Use .click() for React components without trying dispatchEvent first
- Write tests that depend on specific timing (make them deterministic)

## Reference Test

For a comprehensive example demonstrating all patterns, see:
- **File**: `tests/e2e/visual-editor-complete.spec.ts`
- **Coverage**: ~1800 lines covering complete workflow
- **Features tested**:
  - Experiment creation from scratch
  - Visual editor launch and interactions
  - DOM changes (text, hide, delete, HTML, images)
  - Undo/redo with multiple changes
  - Preview mode toggle
  - URL filtering configuration
  - Multiple VE launches
  - Change persistence

This test is the gold standard for E2E testing patterns in this project.

## Quick Reference Checklist

When creating a new E2E test:

- [ ] Create HTML test page in `tests/test-pages/`
- [ ] Create test spec in `tests/e2e/`
- [ ] Use query param: `?use_shadow_dom_for_visual_editor_context_menu=0`
- [ ] Set `__absmartlyTestMode = true` in page context
- [ ] Set up console logging with `setupConsoleLogging()`
- [ ] Use `injectSidebar()` helper
- [ ] Use `test.step()` for organization
- [ ] Use `dispatchEvent` for React components
- [ ] Add screenshots for debugging
- [ ] Use `debugWait()` for visual inspection
- [ ] Add proper waits (no arbitrary timeouts)
- [ ] Test both sidebar and page interactions
- [ ] Clean up in `afterEach()`

## Summary

The E2E testing pattern for this project is unique because it:

1. **Works without real extension context** - uses HTML page + iframe pattern
2. **Disables Shadow DOM** - via query parameter for Playwright compatibility
3. **Auto-polyfills chrome.runtime** - transparent message passing via window.postMessage
4. **Supports visual debugging** - with screenshots, console logs, and slow mode

By following these patterns and using the provided helpers, you can write robust, maintainable E2E tests that accurately simulate user interactions with the extension.
