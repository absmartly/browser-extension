# E2E Test Debugging Status

## Current State

**Test File:** `tests/e2e/ai-dom-generation.spec.ts`

### ✅ Working Components

1. **Test Page Loading** - Page loads correctly
2. **Sidebar Injection** - Sidebar injects and displays
3. **Experiment Creation** - New experiment form fills successfully
4. **AI Dialog Opening** - Dialog opens when "Generate with AI" button is clicked
5. **Prompt Filling** - Prompts are filled into textarea correctly
6. **Generate Button Click** - Fixed selector to click correct "Generate" button (not "Generate with AI")
7. **Console Logging** - Added extensive logging to track execution flow

### ❌ Current Issue

**Problem:** API key is being written to chrome.storage.local correctly but `getConfig()` returns object without `anthropicApiKey` field.

**Root Cause:** Storage format mismatch between test and extension

**Symptoms:**
- Storage contains: `{"v":{"anthropicApiKey":"sk-ant-api03..."}}`  ✅
- `getConfig()` returns: config object ✅
- But `config.anthropicApiKey` is `false` or `undefined` ❌
- Error: "Anthropic API key not configured. Please add it in Settings."

**Evidence from console logs:**
```
📋 Storage keys after setting: [ 'absmartly-config', 'sidebarState' ]
✓ absmartly-config exists: {"v":{"anthropicApiKey":"sk-ant-api03-..."}}

[AI Generate] 🤖 Starting generation, prompt: Change the text...
[AI Generate] Config loaded: YES Has API key: false
[AI Generate] ❌ AI generation failed: Error: Anthropic API key not configured
```

### Investigation Findings

1. **Button Selector Issue** - FIXED ✅
   - Original selector `button:has-text("Generate")` matched both "Generate with AI" and "Generate" buttons
   - Fixed with regex: `button.filter({ hasText: /^Generate$/ })`
   - Now correctly clicks the Generate button inside the dialog

2. **Storage Key Issue** - FIXED ✅
   - Originally used `'absmartly-settings'` key
   - Extension uses `'absmartly-config'` key
   - Fixed by using correct key

3. **Plasmo Storage Format** - PARTIALLY FIXED ⚠️
   - Plasmo Storage wraps values with `{v: value}` format
   - Test now writes: `{'absmartly-config': {v: {anthropicApiKey: '...'}}}`
   - Storage contains correct data in correct format
   - But `getConfig()` still returns object without `anthropicApiKey` field

4. **Sidebar Reload Issue** - DISCOVERED ❌
   - Reloading test page removes injected sidebar
   - Cannot use reload to pick up new storage values
   - Need different approach

### Possible Causes

1. **Plasmo Storage Unwrapping** - Plasmo's `storage.get()` should unwrap `{v: value}` automatically, but maybe it's not working?

2. **Storage Instance Isolation** - Sidebar iframe might have separate Storage instance that doesn't see service worker's writes?

3. **Type Mismatch** - Config object structure mismatch between what's stored and what's expected?

4. **Timing Issue** - Storage write happens after sidebar already loaded config?

### Next Steps

1. **Test storage.get() directly** - Add logging to see what `storage.get('absmartly-config')` actually returns
2. **Check Plasmo Storage source** - Verify if `{v: value}` unwrapping happens automatically
3. **Try alternative approach** - Set API key before sidebar is created/loaded
4. **Check for storage events** - See if sidebar listens for storage changes
5. **Manual testing** - Test if setting API key through Settings UI works in E2E test environment

### Test Configuration

```typescript
// API Key
anthropicApiKey: '***REMOVED_API_KEY***'

// Test Prompts (all tested successfully in unit tests)
1. 'Change the text in the paragraph with id "test-paragraph" to say "Modified text!"'
2. 'Hide the button with id "button-1" by setting its display style to none'
3. 'Remove the button with id "button-2" from the page completely'
4. 'Move the list item with id "item-2" to appear before the item with id "item-1"'
5. 'Replace the HTML content inside the div with id "test-container" with this: <h2>HTML Edited!</h2><p>New paragraph content</p>'

// Timeout
test.setTimeout(180000) // 3 minutes for 5 AI API calls
```

### Files Modified

- `tests/e2e/ai-dom-generation.spec.ts` - Main test file
- `src/lib/__tests__/ai-dom-generator.test.ts` - Unit tests (all passing)

### Unit Test Status

✅ All 9 unit tests passing:
- Text change generation
- Style change generation
- Remove element generation
- Move element generation
- HTML replacement generation
- Multiple changes in one request
- Invalid API key handling
- Minimal HTML handling
- Complex natural language prompts

This confirms the AI generator itself works correctly - the issue is in the E2E integration/UI update flow.

---

**Last Updated:** 2025-10-04
**Status:** Debugging in progress - AI generation works but UI not updating
