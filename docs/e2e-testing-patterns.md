# E2E Testing Patterns for ABsmartly Extension

This document captures the proven patterns used in `tests/e2e/visual-editor-complete.spec.ts` - the comprehensive working E2E test that serves as the gold standard for all E2E tests in this project.

## Table of Contents

1. [Test Page Setup](#test-page-setup)
2. [Sidebar Injection](#sidebar-injection)
3. [Extension Context](#extension-context)
4. [Clicking React Elements](#clicking-react-elements)
5. [Waiting Strategies](#waiting-strategies)
6. [Test Organization](#test-organization)
7. [Console Logging & Debugging](#console-logging--debugging)
8. [Helper Functions](#helper-functions)
9. [Common Pitfalls](#common-pitfalls)

## Test Page Setup

### Pattern: Use Static HTML Test Pages

E2E tests must load a **static HTML page** in the browser where the extension can apply changes. This simulates a real-world web page with DOM elements.

**Example:**
```typescript
const TEST_PAGE_URL = '/visual-editor-test.html'

// In beforeEach:
testPage = await context.newPage()

const { sidebar, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
```

**Why this works:**
- Provides a controlled test environment with known DOM structure
- HTML file contains elements with predictable IDs for easy selection
- Static page loads consistently without external dependencies

**HTML test page structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <h1 id="main-title">Welcome to Test Page</h1>
  <p id="test-paragraph">This is a test paragraph</p>
  <button id="hero-cta" class="button primary">Get Started</button>
  <!-- More test elements with IDs -->
</body>
</html>
```

### Pattern: Use setupTestPage Helper

The `setupTestPage` helper consolidates all page initialization:

```typescript
const { sidebar, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
```

**What it does:**
1. Navigates to the test page URL
2. Sets viewport size to 1920x1080 (consistent testing environment)
3. Waits for body to be loaded
4. Sets test mode flag: `window.__absmartlyTestMode = true`
5. Injects the sidebar iframe
6. Captures all console messages in `allMessages` array
7. Returns sidebar frame locator and messages

## Sidebar Injection

### Pattern: Inject Sidebar Using Helper Function

**ALWAYS use `injectSidebar()` helper** - never try to inject manually.

```typescript
const sidebar = await injectSidebar(testPage, extensionUrl)
```

**Why this is critical:**
- The sidebar is loaded via `chrome-extension://` URL, giving it proper extension context
- The iframe can communicate with background script and content scripts
- Direct injection ensures the iframe has access to Chrome APIs

**How it works:**
```typescript
export async function injectSidebar(
  page: Page,
  extensionUrl: (path: string) => string
): Promise<FrameLocator> {
  const sidebarUrl = extensionUrl('tabs/sidebar.html')

  await page.evaluate((url) => {
    // Create sidebar container
    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = '...'  // Positioning styles

    // Create iframe with extension URL
    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.src = url  // chrome-extension://[id]/tabs/sidebar.html

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, sidebarUrl)

  // Return frame locator for interacting with sidebar
  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })

  return sidebar
}
```

**Key points:**
- Sidebar URL: `chrome-extension://[extension-id]/tabs/sidebar.html`
- Returns `FrameLocator` for interacting with sidebar content
- Waits for sidebar body to be loaded before returning

## Extension Context

### Pattern: Extension Fixtures Provide Context

The extension fixtures in `tests/fixtures/extension.ts` provide:

```typescript
{
  context: BrowserContext,      // Chromium context with extension loaded
  extensionId: string,           // Extension ID extracted from service worker
  extensionUrl: (path) => string // Helper to build chrome-extension:// URLs
}
```

**How extension is loaded:**
```typescript
const context = await chromium.launchPersistentContext('', {
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
  viewport: { width: 1920, height: 1080 },
})
```

**Building extension URLs:**
```typescript
// Fixture provides this helper:
extensionUrl: async ({ extensionId }, use) => {
  await use((p: string) => `chrome-extension://${extensionId}/${p.replace(/^\//, '')}`)
}

// Usage in test:
const sidebarUrl = extensionUrl('tabs/sidebar.html')
// Result: chrome-extension://abcdef123456/tabs/sidebar.html
```

## Clicking React Elements

### Pattern: Use Custom Click Helper

**NEVER use Playwright's `.click()` directly on React elements** - it's flaky and unreliable.

**ALWAYS use the `click()` helper function:**

```typescript
import { click } from '../utils/test-helpers'

// Click a button in the sidebar
await click(sidebar, 'button[title="Create New Experiment"]', 5000)

// Click with locator
await click(sidebar, createButton)
```

**Why Playwright click fails:**
- React's synthetic event system doesn't always respond to Playwright clicks
- Event bubbling might not work correctly
- Timing issues with React rendering

**How the helper works:**
```typescript
export async function click(
  target: FrameLocator | Page,
  selectorOrLocator: string | Locator,
  waitVisibleTimeout: number = 5000
): Promise<void> {
  // Get locator from selector or use provided locator
  let locator: Locator
  if (typeof selectorOrLocator === 'string') {
    locator = target.locator(selectorOrLocator)
  } else {
    locator = selectorOrLocator
  }

  // Wait for element to be visible
  await locator.waitFor({ state: 'visible', timeout: waitVisibleTimeout })

  // Dispatch native MouseEvent - this works with React
  await locator.evaluate((el: Element) => {
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }))
  })
}
```

**Example from working test:**
```typescript
// Create experiment
await click(sidebar, 'button[title="Create New Experiment"]', 5000)
await debugWait()

// Select "From Scratch"
await click(sidebar, 'button:has-text("From Scratch")', 5000)
await debugWait()
```

### Pattern: Use evaluate() for Complex Interactions

For dropdowns and complex React components, use `.evaluate()`:

```typescript
// Click dropdown option
await firstOwnerOption.evaluate((el) => {
  el.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true
  }))
})
```

## Waiting Strategies

### ⚠️ CRITICAL: NEVER Use waitForTimeout()

**ABSOLUTE RULE:** `waitForTimeout()` is **FORBIDDEN** in all tests.

```typescript
// ❌ FORBIDDEN - DO NOT DO THIS
await page.waitForTimeout(1000)

// ✅ CORRECT - Wait for specific state
await element.waitFor({ state: 'visible' })
```

**Why waitForTimeout is banned:**
- Makes tests flaky and unreliable
- Causes random test failures
- Can cause page crashes
- Wastes time waiting arbitrarily

### Pattern: Use debugWait() Instead

`debugWait()` is **ONLY** for SLOW mode debugging - it does nothing in normal runs:

```typescript
export async function debugWait(ms: number = 300): Promise<void> {
  const SLOW_MODE = process.env.SLOW === '1'
  if (SLOW_MODE) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Usage:
await click(sidebar, createButton)
await debugWait()  // Only waits if SLOW=1
```

**When to use debugWait:**
- After user actions (clicks, typing)
- Between UI state transitions
- When you need to visually observe what's happening (SLOW=1 mode)

**Running in SLOW mode:**
```bash
SLOW=1 npx playwright test
```

### Pattern: Wait for Specific Element States

**Always wait for specific conditions:**

```typescript
// Wait for element to be visible
await sidebar.locator('button:has-text("Save")').waitFor({
  state: 'visible',
  timeout: 5000
})

// Wait for element to be hidden
await dropdown.waitFor({ state: 'hidden', timeout: 3000 })

// Wait for element to be attached to DOM
await menuContainer.waitFor({ state: 'attached', timeout: 2000 })

// Wait for element to be detached from DOM
await menuContainer.waitFor({ state: 'detached', timeout: 2000 })
```

### Pattern: Use waitForFunction for Custom Conditions

Wait for specific JavaScript conditions:

```typescript
// Wait for Visual Editor to be active
await page.waitForFunction(() => {
  const editor = (window as any).__absmartlyVisualEditor
  return editor && editor.isActive === true
}, { timeout: 5000 })

// Wait for element to have specific content
await page.waitForFunction(() => {
  const para = document.querySelector('#test-paragraph')
  return para?.textContent?.includes('Expected text')
})

// Wait for element to be removed
await page.waitForFunction(() => {
  return document.getElementById('some-element') === null
}, { timeout: 5000 })
```

### Pattern: Wait for Network/Loading States

```typescript
// Wait for network to be idle
await testPage.waitForLoadState('networkidle', { timeout: 10000 })

// Wait for DOM content loaded
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })

// Wait for full page load
await page.goto(url, { waitUntil: 'load' })
```

### Pattern: Proper Error Handling for Waits

```typescript
// Use .catch() for optional waits
await loadingText.waitFor({ state: 'hidden', timeout: 10000 })
  .catch(() => {
    log('⚠️ Loading text still visible or never appeared')
  })

// Use try-catch for critical waits
try {
  await sidebar.locator('text="Success"').waitFor({
    state: 'visible',
    timeout: 3000
  })
} catch (e) {
  throw new Error('Expected success message did not appear')
}
```

## Test Organization

### Pattern: Use test.step() for Structure

Organize tests into logical steps with `test.step()`:

```typescript
test('Complete workflow test', async ({ extensionId, extensionUrl }) => {
  test.setTimeout(process.env.SLOW === '1' ? 90000 : 15000)

  let sidebar: any
  let experimentName: string

  // ========================================
  // SETUP PHASE
  // ========================================

  await test.step('Inject sidebar', async () => {
    sidebar = await injectSidebar(testPage, extensionUrl)
    await debugWait()
  })

  await test.step('Create new experiment', async () => {
    experimentName = await createExperiment(sidebar)
  })

  // ========================================
  // TESTING PHASE
  // ========================================

  await test.step('Test feature X', async () => {
    // Test implementation
  })
})
```

**Benefits:**
- Clear test structure in reports
- Easy to identify which step failed
- Better debugging experience
- Self-documenting test flow

### Pattern: Extract Helper Functions

Extract complex test logic into helper functions in `tests/e2e/helpers/`:

```typescript
// helpers/ve-experiment-setup.ts
export async function createExperiment(
  sidebar: FrameLocator
): Promise<string> {
  await click(sidebar, 'button[title="Create New Experiment"]', 5000)
  await debugWait()

  // ... rest of setup

  return experimentName
}

// In test:
await test.step('Create new experiment', async () => {
  experimentName = await createExperiment(sidebar)
})
```

**Helper categories:**
- `ve-experiment-setup.ts` - Experiment creation and setup
- `ve-actions.ts` - Visual editor actions
- `ve-verification.ts` - Verification/assertion helpers
- `ve-undo-redo.ts` - Undo/redo functionality
- `ve-preview.ts` - Preview mode testing

## Console Logging & Debugging

### Pattern: Use Logging Utilities

**Initialize logging at test start:**
```typescript
import { initializeTestLogging, log } from './utils/test-helpers'

test.beforeEach(async ({ context, extensionUrl }) => {
  initializeTestLogging()  // Resets timer
  // ...
})
```

**Use log() function with levels:**
```typescript
log('Creating experiment', 'info')       // Shows in normal mode
log('Dropdown state: open', 'debug')     // Only in DEBUG=1 mode
log('ERROR: Test failed', 'error')       // Always shows
```

**Log output format:**
```
[+0.234s] Creating experiment
[+1.456s] Dropdown state: open
```

### Pattern: Capture Console Messages

```typescript
let allConsoleMessages: Array<{type: string, text: string}> = []

const { sidebar, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
allConsoleMessages = allMessages

// Later: analyze messages
const errors = allConsoleMessages.filter(m => m.type === 'error')
```

### Pattern: Debug-Only Sidebar Console Logging

```typescript
if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
  testPage.on('console', msg => {
    const msgText = msg.text()
    if (msgText.includes('[DOMChanges') ||
        msgText.includes('[ExperimentDetail]')) {
      log(`  [Sidebar Console] ${msgText}`)
    }
  })
}
```

### Pattern: Step Numbering (Optional)

For visual debugging in SLOW mode:

```typescript
let stepNumber = 1

const step = (title: string, emoji = '📋') => {
  if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
    log(`\n${emoji} STEP ${stepNumber++}: ${title}`)
  } else {
    stepNumber++  // Track even if not logging
  }
}

// Usage:
await test.step('Inject sidebar', async () => {
  step('Injecting sidebar', '📂')
  sidebar = await injectSidebar(testPage, extensionUrl)
})
```

## Helper Functions

### setupTestPage

Centralized page setup with sidebar injection:

```typescript
export async function setupTestPage(
  page: Page,
  extensionUrl: (path: string) => string,
  testPageUrl: string = '/visual-editor-test.html'
): Promise<{
  sidebar: FrameLocator
  allMessages: Array<{type: string, text: string}>
}>
```

**Usage:**
```typescript
const { sidebar, allMessages } = await setupTestPage(
  testPage,
  extensionUrl,
  '/visual-editor-test.html'
)
```

### injectSidebar

Injects sidebar with proper extension context:

```typescript
export async function injectSidebar(
  page: Page,
  extensionUrl: (path: string) => string
): Promise<FrameLocator>
```

### click

Clicks React elements reliably using MouseEvent:

```typescript
export async function click(
  target: FrameLocator | Page,
  selectorOrLocator: string | Locator,
  waitVisibleTimeout: number = 5000
): Promise<void>
```

### debugWait

Conditional wait only in SLOW mode:

```typescript
export async function debugWait(ms: number = 300): Promise<void>
```

### log

Structured logging with elapsed time:

```typescript
export function log(
  message: string,
  level: 'debug' | 'info' | 'error' = 'info'
): void
```

### initializeTestLogging

Resets the test timer:

```typescript
export function initializeTestLogging(): void
```

## Common Pitfalls

### ❌ Don't: Use Playwright Click on React Elements
```typescript
// BAD - Flaky with React
await sidebar.locator('button:has-text("Save")').click()
```

### ✅ Do: Use Click Helper
```typescript
// GOOD - Reliable
await click(sidebar, 'button:has-text("Save")')
```

---

### ❌ Don't: Use waitForTimeout
```typescript
// BAD - Makes tests flaky
await page.waitForTimeout(1000)
```

### ✅ Do: Wait for Specific State
```typescript
// GOOD - Wait for condition
await element.waitFor({ state: 'visible' })
await debugWait()  // Only waits in SLOW=1 mode
```

---

### ❌ Don't: Access Sidebar Directly from Page
```typescript
// BAD - Won't find elements in iframe
await testPage.locator('button:has-text("Save")').click()
```

### ✅ Do: Use Sidebar Frame Locator
```typescript
// GOOD - Properly scoped to iframe
await sidebar.locator('button:has-text("Save")').waitFor({ state: 'visible' })
```

---

### ❌ Don't: Hard-code URLs
```typescript
// BAD - Extension ID changes
await page.goto('chrome-extension://abcd1234/tabs/sidebar.html')
```

### ✅ Do: Use extensionUrl Helper
```typescript
// GOOD - Uses actual extension ID
const sidebarUrl = extensionUrl('tabs/sidebar.html')
await page.goto(sidebarUrl)
```

---

### ❌ Don't: Skip Waiting for Element States
```typescript
// BAD - Race condition
const button = sidebar.locator('button')
await click(sidebar, button)  // Might not be visible yet
```

### ✅ Do: Explicitly Wait First
```typescript
// GOOD - Ensure element is ready
const button = sidebar.locator('button')
await button.waitFor({ state: 'visible', timeout: 5000 })
await click(sidebar, button)
```

---

### ❌ Don't: Assume Elements Exist
```typescript
// BAD - No error handling
await sidebar.locator('text="Success"').waitFor({ state: 'visible' })
```

### ✅ Do: Handle Wait Errors
```typescript
// GOOD - Graceful error handling
await sidebar.locator('text="Success"')
  .waitFor({ state: 'visible', timeout: 5000 })
  .catch((e) => {
    throw new Error('Success message did not appear')
  })
```

---

### ❌ Don't: Mix Page and Sidebar Locators
```typescript
// BAD - Looking for sidebar element in main page
await testPage.locator('#create-experiment-button').click()
```

### ✅ Do: Use Correct Context
```typescript
// GOOD - Sidebar elements in sidebar, page elements in page
await sidebar.locator('#create-experiment-button').waitFor({ state: 'visible' })
await testPage.locator('#test-paragraph').waitFor({ state: 'visible' })
```

## Running Tests

### Normal Mode
```bash
npx playwright test tests/e2e/visual-editor-complete.spec.ts
```

### Debug Mode (with console logging)
```bash
DEBUG=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts
```

### Slow Mode (visual debugging)
```bash
SLOW=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts
```

### UI Mode (interactive)
```bash
npx playwright test --ui
```

### With Headed Browser
```bash
npx playwright test --headed
```

### Combined
```bash
SLOW=1 DEBUG=1 npx playwright test --headed tests/e2e/visual-editor-complete.spec.ts
```

## Summary of Key Patterns

1. **Always build first:** `npm run build:dev` before running tests
2. **Use static HTML test pages** with known DOM structure
3. **Inject sidebar with helper** for proper extension context
4. **Never use Playwright click** - use custom click helper
5. **Never use waitForTimeout** - wait for specific states
6. **Use debugWait()** for visual debugging in SLOW=1 mode
7. **Organize with test.step()** for clear structure
8. **Extract helpers** for reusable test logic
9. **Use proper logging** with log() function
10. **Handle errors gracefully** with .catch() or try-catch
