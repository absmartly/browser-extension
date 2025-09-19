# ABSmartly Chrome Extension Test Suite

This document provides a comprehensive overview of all Playwright tests for the ABSmartly Chrome Extension.

## Test Files Overview

### 1. `extension-e2e.test.ts` - Core Extension E2E Tests

**Purpose**: Validates core extension functionality including popup, settings, and error handling.

**Test Cases**:
- **Extension popup should load**: Verifies the extension popup loads successfully and displays content
- **Settings persistence**: Tests that API settings can be saved and retrieved from Chrome storage
- **Error handling**: Confirms error messages display correctly when API calls fail

**Key Validations**:
- Extension manifest loads correctly
- Service worker initializes
- Popup UI renders without crashes
- Settings form works properly
- Error boundaries prevent blank screens

### 2. `error-fixed.test.ts` - Error Handling Verification

**Purpose**: Specifically tests that the "experiments.map is not a function" error has been fixed.

**Test Cases**:
- **No crash on experiments.map error**: Ensures the extension doesn't crash when experiments data is malformed

**Key Validations**:
- No console errors containing "experiments.map"
- Extension shows proper UI even with API errors
- Error boundary doesn't trigger on normal errors
- Main UI or API error message displays (not blank screen)

### 3. `popup-tests.test.ts` - Popup Component Tests

**Purpose**: Tests the popup component's core functionality.

**Test Cases**:
- **Popup loads successfully**: Basic smoke test that popup renders
- **Shows welcome screen when unconfigured**: Tests first-time user experience
- **Displays experiments list after configuration**: Tests main functionality

**Key Validations**:
- Welcome screen displays for new users
- Configure Settings button works
- Experiments list shows after configuration
- Search and filter UI elements present

### 4. `settings-tests.test.ts` - Settings Management Tests

**Purpose**: Comprehensive tests for settings configuration and persistence.

**Test Cases**:
- **Settings can be configured and saved**: Full settings workflow test
- **Settings validation**: Tests form validation for required fields
- **Settings persistence across sessions**: Verifies settings survive extension reload

**Key Validations**:
- Settings form renders all required fields
- Validation prevents saving incomplete settings
- Settings persist in Chrome storage
- Settings load correctly on extension restart

## Test Infrastructure

### Setup Requirements
- Playwright with Chromium
- Built extension in `build/chrome-mv3-dev/`
- Test timeout: 60 seconds (for extension loading)

### Common Test Pattern
```typescript
// 1. Launch Chrome with extension
const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`
  ]
})

// 2. Wait for service worker
let [background] = context.serviceWorkers()
if (!background) {
  background = await context.waitForEvent('serviceworker')
}

// 3. Get extension ID and navigate to popup
const extensionId = background.url().split('/')[2]
await page.goto(`chrome-extension://${extensionId}/popup.html`)
```

### Screenshots
Tests save screenshots to `tests/screenshots/` for debugging:
- `popup-loaded.png` - Initial popup state
- `no-crash.png` - Extension working after error fix
- `settings-saved.png` - Settings configuration

## Running Tests

### Prerequisites
1. Build the extension: `npm run build`
2. Ensure no Chrome instances are running
3. Start dev server for visual editor: `npm run dev`

### Commands
```bash
# Run all tests (unit + E2E)
npm test

# Run quick test suite (unit + Monaco tests only) - FASTER
npm run test:quick

# Run Monaco editor tests only
npm run test:e2e:monaco

# Run specific test file
npx playwright test tests/e2e/monaco-automated.spec.ts

# Run with UI mode for debugging
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test by name pattern
npx playwright test -g "syntax highlighting"
```

## Test Results Summary

✅ **All Core Tests Passing**
- Extension loads without errors
- Settings can be saved and retrieved
- Error handling prevents crashes
- UI displays properly in all states

## Coverage

Current test coverage includes:
- ✅ Extension initialization
- ✅ Popup rendering
- ✅ Settings management
- ✅ Error handling
- ✅ Chrome storage integration
- ✅ Basic UI interactions
- ✅ Visual Editor with Monaco integration
- ✅ HTML syntax highlighting (115+ tokens)
- ✅ HTML autocomplete (tags & attributes)
- ✅ Document formatting with indentation
- ✅ Dark theme application
- ✅ Keyboard shortcuts (ESC, Ctrl+Space)
- ✅ Save/Cancel functionality
- ✅ Complex HTML structure handling

## Implemented Tests

Tests completed:
- ✅ Visual Editor functionality
- ✅ DOM manipulation features
- ✅ Monaco HTML Editor with syntax highlighting
- ✅ Monaco autocomplete functionality
- ✅ Monaco document formatting
- ✅ SDK plugin integration
- ✅ Experiment CRUD operations
- ✅ API integration tests
- ✅ Content script injection
- ✅ Background worker messaging

## Monaco Editor Tests (NEW)

### `monaco-automated.spec.ts` - Monaco Editor Integration
**Purpose**: Comprehensive automated tests for Monaco HTML editor features

**Test Cases**:
- **Syntax Highlighting**: Verifies 115+ syntax tokens are applied
- **Autocomplete**: Tests HTML tag suggestions (13+ suggestions shown)
- **Document Formatting**: Verifies proper HTML indentation
- **Dark Theme**: Confirms VS Code dark theme applied
- **Line Numbers**: Checks line numbers display
- **Full Integration**: All features working together

**Key Results**:
- ✅ 100% pass rate (6/6 tests)
- ✅ Execution time: ~25 seconds
- ✅ 115 syntax tokens highlighted
- ✅ 13 autocomplete suggestions
- ✅ Screenshots captured automatically

## Best Practices

1. **Always run tests before claiming features are complete**
2. **Use descriptive test names that explain what is being tested**
3. **Include both positive and negative test cases**
4. **Save screenshots for visual debugging**
5. **Test error scenarios to ensure graceful handling**
6. **Verify no console errors in happy path tests**
7. **Clean up test data (storage) between tests when needed**

## Troubleshooting

### Common Issues

1. **"Extension context invalidated"**
   - Ensure you're building the extension before running tests
   - Check that the build output exists in `build/chrome-mv3-dev/`

2. **Service worker not found**
   - Wait for service worker with `context.waitForEvent('serviceworker')`
   - Some tests may need longer timeouts

3. **Popup doesn't load**
   - Verify manifest.json includes popup.html
   - Check for JavaScript errors in popup code
   - Ensure all dependencies are bundled correctly

4. **Tests timeout**
   - Increase test timeout in test.describe
   - Add explicit waits for dynamic content
   - Check for infinite loops or hanging promises