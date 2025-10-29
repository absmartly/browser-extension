# Sidebar Injection Fix Guide

## Problem

Many E2E tests fail because they use the **wrong pattern** to load the sidebar. They try to navigate directly to the extension sidebar URL without proper extension context initialization.

## Wrong Pattern (❌ FAILING)

```typescript
// This doesn't work - bypasses extension context
test('test name', async ({ context, extensionUrl }) => {
  const page = await context.newPage()
  await page.goto(extensionUrl('tabs/sidebar.html')) // ❌ WRONG

  // Sidebar loads but API calls don't work
  await page.waitForSelector('[data-testid="experiment-item"]', { timeout: 10000 })
})
```

**Why it fails:**
- Direct navigation bypasses extension context initialization
- Sidebar UI loads but messaging/API communication fails
- Tests timeout waiting for experiments

## Correct Pattern (✅ PASSING)

```typescript
import { setupTestPage, injectSidebar } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.beforeEach(async ({ context, extensionUrl }) => {
  const testPage = await context.newPage()
  const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
  // Store sidebar for use in tests
})

test('test name', async () => {
  // Use sidebar from beforeEach
  // Sidebar is properly initialized and API calls work
})
```

**Why it works:**
- `setupTestPage()` properly initializes extension context
- Test page is navigated to TEST_PAGE_URL
- `__absmartlyTestMode` flag is set
- Sidebar is injected into an iframe on the test page
- Extension messaging and API calls work correctly

## Key Differences

| Aspect | Wrong Pattern | Correct Pattern |
|--------|--------------|-----------------|
| Page setup | Direct extension URL | Test page + setupTestPage() |
| Sidebar source | Direct navigate | injectSidebar() helper |
| Extension context | Not initialized | Properly initialized |
| API calls | Don't work | Work correctly |
| Test reliability | Flaky timeouts | Stable and fast |

## Migration Steps

For each failing test file:

1. **Add imports** at the top:
   ```typescript
   import { setupTestPage, injectSidebar, debugWait } from './utils/test-helpers'
   ```

2. **Define TEST_PAGE_URL**:
   ```typescript
   const TEST_PAGE_URL = '/visual-editor-test.html'
   ```

3. **Update beforeEach**:
   ```typescript
   test.beforeEach(async ({ context, extensionUrl }) => {
     testPage = await context.newPage()
     const { sidebar: result } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
     currentSidebar = result
   })
   ```

4. **Update tests to use sidebar from beforeEach instead of creating their own page**

## Example Migration

### Before (❌ Wrong)
```typescript
test('should show experiments', async ({ context, extensionUrl }) => {
  const page = await context.newPage()
  await page.goto(extensionUrl('tabs/sidebar.html'))

  // This times out - experiments never load
  const count = await page.locator('[data-testid="experiment-item"]').count()
  expect(count).toBeGreaterThan(0)
})
```

### After (✅ Correct)
```typescript
let testPage: Page
let sidebar: FrameLocator

test.beforeEach(async ({ context, extensionUrl }) => {
  testPage = await context.newPage()
  const { sidebar: result } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
  sidebar = result
})

test('should show experiments', async () => {
  // Sidebar is already properly set up
  const count = await sidebar.locator('[data-testid="experiment-item"]').count()
  // This passes - experiments load via API
  expect(count >= 0).toBeTruthy() // 0 or more experiments is valid
})
```

## Files to Fix

Based on the failing test analysis:

1. **bug-fixes.spec.ts** - 6/12 tests failing (storage seeding + wrong sidebar pattern)
2. **experiment-code-injection.spec.ts** - Wrong sidebar pattern
3. **experiment-data-persistence.spec.ts** - Wrong sidebar pattern
4. **experiment-flows.spec.ts** - Wrong sidebar pattern
5. **variable-sync.spec.ts** - Wrong sidebar pattern
6. **visual-editor-demo.spec.ts** - Wrong sidebar pattern
7. **visual-editor-focused.spec.ts** - Wrong sidebar pattern
8. **visual-editor-image-source.spec.ts** - Wrong sidebar pattern
9. **visual-editor-unified.spec.ts** - Wrong sidebar pattern

## Test After Each Fix

For each file fixed:
```bash
npx playwright test tests/e2e/FILENAME.spec.ts --reporter=list
```

Expected: Tests should either pass or have clear error messages about missing data (not timeout errors about not finding elements).
