# URL Filtering Test Debugging Plan

## Analysis Summary

After reading the plugin source code at `/Users/joalves/git_tree/absmartly-sdk-plugins/`, the URL filtering feature **IS implemented** and appears correct. The tests are failing for a different reason.

## Plugin Architecture (Confirmed)

### Key Files
1. **URLMatcher** (`src/utils/URLMatcher.ts`) - ✅ EXISTS
   - Implements pattern matching with wildcard support
   - Supports `matchType`: `full-url`, `path`, `domain`, `query`, `hash`
   - Default matchType is `path`

2. **DOMChangesPluginLite** (`src/core/DOMChangesPluginLite.ts`) - ✅ IMPLEMENTS URL FILTERING
   - Line 93: Sets up URL change listener when `spa: true`
   - Line 204: `applyChanges()` gets current URL
   - Line 247: Checks if ANY variant matches URL
   - Line 257: Determines if visual changes should apply
   - Line 303: Applies changes only if URL matches

3. **VariantExtractor** (`src/parsers/VariantExtractor.ts`) - Need to verify
   - Should have `anyVariantMatchesURL()` method
   - Should have `getAllVariantsData()` method

## URL Matching Logic (From URLMatcher.ts)

### Default Behavior
```typescript
matchType: 'path' // Default
```

### URL Extraction for 'path' matchType
```typescript
// Line 54-55 in URLMatcher.ts
case 'path':
  return urlObj.pathname + urlObj.hash;
```

## **THE PROBLEM** 🔍

### Test URL
- Browser URL: `http://localhost:3456/url-filtering-test.html`
- After `history.pushState()`: pathname becomes `/products/123`
- **URLMatcher sees**: `/products/123` (pathname + hash)

### Filter Pattern
```typescript
urlFilter: {
  include: ['/products/*'],
  mode: 'simple',
  matchType: 'path'
}
```

### Pattern Matching
```typescript
// URLMatcher converts '/products/*' to regex: '^/products/.*$'
// Tests against: '/products/123'
// Should MATCH! ✅
```

## Hypothesis: Why Tests Are Failing

### Most Likely Issue: Plugin File Version
The browser extension is using `/public/absmartly-dom-changes-core.min.js` which:
- Was last modified: October 1st
- May not have the latest URL filtering implementation
- The dev build process should copy the latest build from the SDK plugin project

### Check 1: Verify Plugin Build
```bash
# Check if plugin has URL filtering
grep -o "anyVariantMatchesURL" /Users/joalves/git_tree/absmartly-browser-extension/public/absmartly-dom-changes-core.min.js
```

Expected: Should find the method if it's the latest build

### Check 2: Build Plugin from Source
```bash
cd /Users/joalves/git_tree/absmartly-sdk-plugins
npm run build
```

Then copy the built file to the browser extension:
```bash
cp dist/absmartly-dom-changes-core.min.js ../absmartly-browser-extension/public/
```

## Debugging Steps

### Step 1: Add Console Logging to Test
Add debug output to see what the plugin is doing:

```typescript
await testPage.evaluate(() => {
  // Enable debug mode
  window.localStorage.setItem('absmartly:debug', 'true');

  console.log('[DEBUG] Current URL:', window.location.href);
  console.log('[DEBUG] Pathname:', window.location.pathname);
  console.log('[DEBUG] Hash:', window.location.hash);
});
```

### Step 2: Check Plugin Version
```typescript
await testPage.evaluate(() => {
  console.log('[DEBUG] Plugin version:', (window as any).ABsmartlyDOM?.DOMChangesPlugin?.VERSION);
});
```

### Step 3: Verify customFieldValue Return
```typescript
await testPage.evaluate(() => {
  const context = (window as any).__testContext;
  const result = context.customFieldValue('url_filter_test', '__dom_changes');
  console.log('[DEBUG] customFieldValue returned:', JSON.stringify(result, null, 2));
});
```

### Step 4: Check URLMatcher Directly
```typescript
await testPage.evaluate(() => {
  const URLMatcher = (window as any).ABsmartlyDOM.URLMatcher;
  const filter = {
    include: ['/products/*'],
    mode: 'simple',
    matchType: 'path'
  };
  const url = window.location.href;
  const matches = URLMatcher.matches(filter, url);
  console.log('[DEBUG] URLMatcher.matches result:', matches);
  console.log('[DEBUG] Filter:', filter);
  console.log('[DEBUG] URL:', url);
});
```

### Step 5: Check if Plugin is Applying Changes
```typescript
await testPage.evaluate(() => {
  const context = (window as any).__testContext;
  const plugin = context.__domPlugin;
  console.log('[DEBUG] Plugin exists:', !!plugin);
  console.log('[DEBUG] Plugin initialized:', plugin?.initialized);
});
```

## Action Plan

### Priority 1: Verify Plugin Build (Most Likely Issue)
1. Check if plugin file has latest code
2. Rebuild plugin from source
3. Copy to browser extension
4. Re-run tests

### Priority 2: Add Debug Logging
1. Enable plugin debug mode in tests
2. Add console.log statements to capture plugin behavior
3. Check browser console output in Playwright HTML report

### Priority 3: Verify Test Setup
1. Confirm SDK mock returns correct format
2. Verify history.pushState() sets pathname correctly
3. Confirm plugin initializes after URL is set

## Expected Debug Output (If Working)

```
[ABsmartly] === DOM Changes Application Starting ===
[ABsmartly] Target: all experiments
[ABsmartly] Current URL: http://localhost:3456/products/123
[ABsmartly] Experiments to process: ['url_filter_test']
[ABsmartly] Processing experiment 'url_filter_test' (variant 1):
  urlMatches: true
  changeCount: 1
  changes: [{ type: 'text', selector: '#test-element', trigger: 'immediate' }]
[ABsmartly] Applied change: text to #test-element
```

## Test Case Verification

### Current Test Setup ✅
```typescript
// 1. Load page
await testPage.goto(TEST_PAGE_URL)

// 2. Set URL BEFORE plugin
history.pushState({}, '', '/products/123')

// 3. Inject SDK mock
window.absmartly = { ... }

// 4. Load plugin
const plugin = new DOMChangesPlugin({ spa: true, ... })
plugin.initialize()

// 5. Check element
expect(element.textContent).toBe('Variant 1 Text - Products Only')
```

### Expected Plugin Behavior
1. Plugin calls `applyChanges()`
2. Gets `currentURL` = `window.location.href` = `http://localhost:3456/products/123`
3. Calls `anyVariantMatchesURL('url_filter_test', currentURL)`
4. Extracts pathname: `/products/123`
5. Tests against `/products/*` pattern
6. Match! Applies changes

## Quick Test to Run

```bash
# Test 1: Check if method exists in plugin file
grep -c "anyVariantMatchesURL" public/absmartly-dom-changes-core.min.js

# Test 2: Rebuild plugin
cd /Users/joalves/git_tree/absmartly-sdk-plugins
npm run build

# Test 3: Check build date
ls -lh dist/absmartly-dom-changes-core.min.js

# Test 4: Copy to extension
cp dist/absmartly-dom-changes-core.min.js ../absmartly-browser-extension/public/

# Test 5: Re-run tests
cd ../absmartly-browser-extension
npx playwright test tests/e2e/url-filtering.spec.ts:41 --workers=1
```

## Next Steps

1. ✅ Read plugin source code (DONE)
2. ⏳ Verify plugin file has latest build
3. ⏳ Rebuild plugin if needed
4. ⏳ Add debug logging to tests
5. ⏳ Capture and analyze plugin console output
6. ⏳ Fix any issues found

## Confidence Level

**HIGH** - The plugin code looks correct. The issue is most likely:
- Stale plugin build in browser extension
- OR missing debug output to see what's happening
