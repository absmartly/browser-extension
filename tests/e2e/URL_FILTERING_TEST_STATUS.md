# URL Filtering E2E Tests - Status Report

## Summary
Comprehensive E2E tests for URL filtering functionality have been created but are currently **failing** because the DOM changes plugin is not applying changes based on URL filters.

## Test Infrastructure ✅

All test infrastructure is properly set up and working:

- **HTTP Server**: Playwright webServer configuration serves test pages on http://localhost:3456
- **Test Pages**: Created url-filtering-test.html with proper test elements
- **SDK Mock**: Complete ABsmartly SDK mock with URL filter support
- **Plugin Loading**: Plugin loads successfully (v1.0.1) with correct configuration
- **Test Structure**: Three comprehensive test scenarios created

## Test Files Created

### tests/e2e/url-filtering.spec.ts
Contains 3 test scenarios:
1. **Single variant with URL filter** - Tests DOM changes applied only on matching URLs
2. **Multiple variants with different URL filters** - Tests different filters for different variants
3. **Different matchType options** - Tests path, query, and hash matching

### tests/test-pages/url-filtering-test.html
Simple test page with elements for DOM changes to target.

## Configuration Changes

### playwright.config.ts
Added webServer configuration:
```typescript
webServer: {
  command: 'npx http-server tests/test-pages -p 3456 --silent',
  port: 3456,
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000
}
```

## Plugin Configuration Tested

The tests initialize the plugin with:
```typescript
new DOMChangesPlugin({
  context,
  autoApply: true,
  spa: true, // Enable SPA mode for URL change detection
  dataSource: 'customField',
  dataFieldName: '__dom_changes',
  experiments: ['url_filter_test'],
  debug: true
})
```

## URL Filter Format

The tests use the correct URL filter format as defined in dom-changes.ts:
```typescript
{
  changes: [{
    selector: '#test-element',
    type: 'text',
    value: 'Variant 1 Text - Products Only'
  }],
  urlFilter: {
    include: ['/products/*'],
    mode: 'simple',
    matchType: 'path'
  }
}
```

## Test Flow

1. Load test page at http://localhost:3456/url-filtering-test.html
2. Set URL to /products/123 using `history.pushState()` **BEFORE** initializing plugin
3. Inject SDK mock that returns experiment config with URL filters
4. Initialize DOM changes plugin with `spa: true` and correct config
5. **EXPECT**: Element text changes to "Variant 1 Text - Products Only"
6. **ACTUAL**: Element remains "Original test content"

## Current Issue ❌

The plugin **loads successfully** but **does not apply changes** based on URL filters.

### Evidence:
- Console shows: `[ABsmartly] DOM plugin loaded successfully (v1.0.1)`
- Element text remains unchanged: "Original test content"
- Expected text: "Variant 1 Text - Products Only"

### Possible Causes:
1. **URL filtering logic not implemented** - The plugin may not have the URL filtering feature fully implemented
2. **URL matching not working** - The pattern matching `/products/*` against `/products/123` may not be working
3. **Plugin version outdated** - The plugin file (public/absmartly-dom-changes-core.min.js) may need updating
4. **Configuration issue** - There may be an undocumented configuration option needed

## Next Steps

To fix the failing tests, the DOM changes plugin needs to be investigated:

1. **Check plugin source code** - Verify URL filtering logic is implemented in the plugin
2. **Debug URL matching** - Add logging to see what URL the plugin is checking and why it's not matching
3. **Update plugin** - If available, use a newer version of the plugin with URL filtering support
4. **Test basic functionality** - Create a simple test without URL filters to confirm basic plugin functionality works

## Test Commands

```bash
# Run all URL filtering tests
npx playwright test tests/e2e/url-filtering.spec.ts --workers=1

# Run in headed mode with SLOW for debugging
export SLOW=1 && npx playwright test tests/e2e/url-filtering.spec.ts --headed --workers=1

# Run specific test
npx playwright test tests/e2e/url-filtering.spec.ts:41 --workers=1
```

## Related Files

- `/Users/joalves/git_tree/absmartly-browser-extension/tests/e2e/url-filtering.spec.ts`
- `/Users/joalves/git_tree/absmartly-browser-extension/tests/test-pages/url-filtering-test.html`
- `/Users/joalves/git_tree/absmartly-browser-extension/playwright.config.ts`
- `/Users/joalves/git_tree/absmartly-browser-extension/public/absmartly-dom-changes-core.min.js`
- `/Users/joalves/git_tree/absmartly-browser-extension/src/types/dom-changes.ts`

## User Note

User mentioned: "The url filtering logic should be fixed in the plugin now"

This suggests the plugin was recently updated with URL filtering logic. The issue may be that:
- The local plugin file needs to be updated with the latest version
- The plugin build needs to be regenerated
- The SDK plugin companion directory may need to be checked for updates
