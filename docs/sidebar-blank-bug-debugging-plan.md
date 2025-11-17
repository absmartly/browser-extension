# Sidebar Goes Blank When Disabling Preview - Debugging Plan

## Problem Summary

The sidebar goes blank when turning off preview mode, **ONLY when the DOM changes include global selectors** like `body`, `h1`, `button`, etc. It works fine with more specific selectors like `[data-framer-name='Hero']` or `div[data-framer-name="home_page_header"] h1`.

### When it happens:
- ✅ Preview ON with global selectors (`body`, `h1`, `button`) - Works
- ❌ Preview OFF with global selectors - **Sidebar goes blank**
- ✅ Preview ON with specific selectors - Works
- ✅ Preview OFF with specific selectors - Works

### Known facts:
1. No JavaScript errors in logs
2. Logs show successful message handling before sidebar blanks
3. Empty `experimentName` in create mode gets converted to `__preview__`
4. User suspects global selectors might be matching elements inside the sidebar

---

## Architecture Analysis

### 1. How is the sidebar rendered?

**YES, the sidebar IS rendered in an iframe!**

Location: `/Users/joalves/git_tree/ext-dev1-claude-sdk/background/handlers/injection-handler.ts`

```typescript
// Lines 182-192
const iframe = document.createElement('iframe')
iframe.id = 'absmartly-sidebar-iframe'
iframe.style.cssText = `
  width: 100%;
  height: 100%;
  border: none;
`
iframe.src = chrome.runtime.getURL('tabs/sidebar.html')

container.appendChild(iframe)
document.body.appendChild(container)
```

**Key finding:** The sidebar iframe is injected directly into `document.body` of the main page, **NOT** into a shadow DOM or isolated container.

### 2. Is the iframe isolated?

**PARTIAL isolation:**
- ✅ The iframe has its own DOM context (separate document)
- ✅ JavaScript running in the main page cannot directly access iframe internals
- ❌ The iframe container (`absmartly-sidebar-root`) is a regular div in the main page DOM
- ❌ CSS rules from the main page can affect the iframe container

**Critical point:** The iframe container itself (`#absmartly-sidebar-root`) and the iframe element (`#absmartly-sidebar-iframe`) are part of the main page DOM!

### 3. How do preview changes get applied?

**PreviewManager flow:**

Location: `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/sdk-bridge/dom/preview-manager.ts`

```typescript
// Line 61 - THIS IS THE PROBLEM!
const elements = document.querySelectorAll(change.selector)
```

**CRITICAL FINDING:** PreviewManager uses `document.querySelectorAll()` which queries **the entire main page DOM**, including:
- All regular page elements
- The sidebar container div (`#absmartly-sidebar-root`)
- The sidebar iframe element (`#absmartly-sidebar-iframe`)

**When global selectors are used:**
- `body` selector: Matches the main page body (sidebar is attached to it)
- `h1` selector: Could match h1 elements in the main page AND affect styling
- `button` selector: Could match any buttons in the page

---

## Root Cause Hypothesis

### Theory: Global selectors are affecting the sidebar container or iframe

When preview mode is turned OFF, `PreviewManager.removePreviewChanges()` runs to restore elements:

1. **Line 311-313:** Queries for marked elements with the experiment name
   ```typescript
   const markedElements = document.querySelectorAll(
     `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
   )
   ```

2. **Problem scenario with global selectors:**
   - If changes were applied to `body`, the body element gets marked: `data-absmartly-experiment="__preview__"`
   - When removing preview, it tries to restore the body to its original state
   - The restoration might be removing or clearing the sidebar container

### Specific failure modes:

#### Mode 1: Body restoration removes sidebar
If `body` changes were tracked and restored, the restoration might:
- Reset `body.innerHTML` (would remove sidebar)
- Reset `body` children (would remove sidebar)
- Clear body styles that affect layout

#### Mode 2: CSS restoration breaks sidebar visibility
If global selectors like `h1`, `button` have `styleRules` changes:
- When removing preview, the stylesheet is removed (line 383-390)
- This could be affecting sidebar styles if there's CSS cascade pollution

#### Mode 3: Display:none applied to sidebar container
If a global selector like `div` or `*` has a `display: none` change:
- Line 148: Delete changes use `display: none`
- When restoring, this could be setting the sidebar container to `display: none`

---

## Detailed Debugging Plan

### Phase 1: Verify the hypothesis with logging

Add extensive logging to PreviewManager to track what elements are being affected:

**File:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/sdk-bridge/dom/preview-manager.ts`

#### 1.1 Log elements matched by global selectors

Add after line 61:
```typescript
const elements = document.querySelectorAll(change.selector)

// NEW LOGGING
Logger.log('[PreviewManager] Elements matched by selector:', {
  selector: change.selector,
  count: elements.length,
  elementTypes: Array.from(elements).map(el => ({
    tagName: el.tagName,
    id: el.id,
    classes: el.className,
    isSidebarContainer: el.id === 'absmartly-sidebar-root',
    isSidebarIframe: el.id === 'absmartly-sidebar-iframe'
  }))
})
```

#### 1.2 Log restoration process

Add after line 295 in `removePreviewChanges()`:
```typescript
// Before restoration loop
Logger.log('[PreviewManager] Starting preview removal:', {
  experimentName,
  trackedElementCount: this.previewStateMap.size,
  trackedElements: Array.from(this.previewStateMap.entries()).map(([el, data]) => ({
    tagName: el.tagName,
    id: el.id,
    changeType: data.changeType,
    selector: data.selector
  }))
})
```

Add after line 313:
```typescript
const markedElements = document.querySelectorAll(
  `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
)

// NEW LOGGING
Logger.log('[PreviewManager] Marked elements to restore:', {
  count: markedElements.length,
  elements: Array.from(markedElements).map(el => ({
    tagName: el.tagName,
    id: el.id,
    isSidebarContainer: el.id === 'absmartly-sidebar-root',
    isSidebarIframe: el.id === 'absmartly-sidebar-iframe',
    hasOriginalData: el.hasAttribute('data-absmartly-original')
  }))
})
```

### Phase 2: Filter out sidebar elements from DOM changes

**CRITICAL FIX:** Add filtering to exclude sidebar elements from all DOM operations.

#### 2.1 Create a filter function

Add at the top of PreviewManager class:
```typescript
/**
 * Check if an element is part of the sidebar or should be excluded
 */
private shouldExcludeElement(element: Element): boolean {
  // Check if element is the sidebar container or inside it
  if (element.id === 'absmartly-sidebar-root' || element.id === 'absmartly-sidebar-iframe') {
    return true
  }

  // Check if element is inside the sidebar container
  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (sidebarContainer && sidebarContainer.contains(element)) {
    return true
  }

  return false
}
```

#### 2.2 Apply filter in applyPreviewChange

Replace line 61-72 with:
```typescript
const allElements = document.querySelectorAll(change.selector)

// Filter out sidebar elements
const elements = Array.from(allElements).filter(el => !this.shouldExcludeElement(el))

if (elements.length === 0) {
  Logger.warn('No elements found for selector (excluding sidebar):', change.selector)
  return false
}

Logger.log(
  `Applying preview change to ${elements.length} element(s) (filtered from ${allElements.length}):`,
  change.selector,
  change.type
)
```

#### 2.3 Apply filter in removePreviewChanges

Replace line 310-313 with:
```typescript
const allMarkedElements = document.querySelectorAll(
  `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
)

// Filter out sidebar elements
const markedElements = Array.from(allMarkedElements).filter(el => !this.shouldExcludeElement(el))

Logger.log(`[PreviewManager] Restoring ${markedElements.length} elements (filtered from ${allMarkedElements.length})`)
```

### Phase 3: Add sidebar protection in content script

**File:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/content.ts`

Add monitoring for sidebar removal:

```typescript
// After line 700 (in removePreviewHeader function)
function removePreviewHeader() {
  const header = document.getElementById('absmartly-preview-header')
  if (header) {
    header.remove()
  }

  // NEW: Check if sidebar is still present
  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (!sidebarContainer) {
    console.error('[Content Script] CRITICAL: Sidebar container was removed during preview cleanup!')
    // Could re-inject sidebar here if needed
  }
}
```

### Phase 4: Add iframe isolation using shadow DOM (optional nuclear option)

If filtering doesn't work, move the sidebar container into a shadow DOM:

**File:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/background/handlers/injection-handler.ts`

Replace lines 162-192 with:
```typescript
// Create shadow host
const shadowHost = document.createElement('div')
shadowHost.id = 'absmartly-sidebar-shadow-host'
shadowHost.style.cssText = `
  position: fixed;
  top: 0;
  right: 0;
  width: 384px;
  height: 100vh;
  z-index: 2147483647;
`

// Attach shadow DOM
const shadow = shadowHost.attachShadow({ mode: 'open' })

// Create container inside shadow DOM
const container = document.createElement('div')
container.id = 'absmartly-sidebar-root'
container.style.cssText = `
  width: 100%;
  height: 100%;
  background-color: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
`

const iframe = document.createElement('iframe')
iframe.id = 'absmartly-sidebar-iframe'
iframe.style.cssText = `
  width: 100%;
  height: 100%;
  border: none;
`
iframe.src = chrome.runtime.getURL('tabs/sidebar.html')

container.appendChild(iframe)
shadow.appendChild(container)
document.body.appendChild(shadowHost)
```

**Pros:** Complete isolation from page DOM selectors
**Cons:** May break existing sidebar detection code, more complex to maintain

---

## Testing Strategy

### Test Case 1: Global body selector
```json
{
  "selector": "body",
  "type": "style",
  "styles": {
    "backgroundColor": "red"
  }
}
```

**Expected:** Body turns red in preview, returns to original when preview OFF, sidebar remains visible

### Test Case 2: Global h1 selector
```json
{
  "selector": "h1",
  "type": "style",
  "styles": {
    "color": "blue"
  }
}
```

**Expected:** All h1s turn blue, sidebar remains, preview OFF works

### Test Case 3: Global div selector
```json
{
  "selector": "div",
  "type": "style",
  "styles": {
    "border": "1px solid red"
  }
}
```

**Expected:** All divs get red border (except sidebar container), preview OFF works

### Test Case 4: Universal selector
```json
{
  "selector": "*",
  "type": "style",
  "styles": {
    "outline": "1px solid blue"
  }
}
```

**Expected:** Everything gets outline, sidebar survives

---

## Implementation Priority

1. **HIGH PRIORITY** - Phase 2.1-2.3: Add sidebar element filtering
   - This is the most likely fix
   - Non-invasive, low risk
   - Should solve the problem immediately

2. **MEDIUM PRIORITY** - Phase 1: Add comprehensive logging
   - Helps verify the fix worked
   - Useful for future debugging
   - Can be done in parallel with Phase 2

3. **LOW PRIORITY** - Phase 3: Add sidebar monitoring
   - Defense in depth
   - Helps catch edge cases

4. **FALLBACK** - Phase 4: Shadow DOM isolation
   - Only if filtering doesn't work
   - Major architectural change
   - Last resort option

---

## Code Locations Reference

### Key Files:
1. **Preview Manager:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/sdk-bridge/dom/preview-manager.ts`
   - Line 61: `querySelectorAll` that needs filtering
   - Line 311: Marked elements query that needs filtering
   - Lines 290-347: Preview apply/remove logic

2. **Sidebar Injection:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/background/handlers/injection-handler.ts`
   - Lines 182-192: Iframe creation
   - Line 189: Sidebar iframe gets added to main page body

3. **Content Script:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/content.ts`
   - Line 436: Sidebar iframe reference check
   - Lines 542-703: Preview header management

4. **Orchestrator:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/sdk-bridge/core/orchestrator.ts`
   - Lines 290-323: PREVIEW_CHANGES handler
   - Lines 328-347: REMOVE_PREVIEW handler

---

## Success Criteria

The fix is successful when:
1. ✅ Preview with global selectors (body, h1, button) works
2. ✅ Turning preview OFF with global selectors works
3. ✅ Sidebar remains visible throughout
4. ✅ No JavaScript errors in console
5. ✅ DOM changes are properly applied and removed
6. ✅ No regression with specific selectors

---

## Risk Assessment

### Low Risk Fixes:
- Adding `shouldExcludeElement()` filter
- Adding logging
- Adding monitoring

### Medium Risk Fixes:
- Modifying restoration logic
- Changing querySelector behavior

### High Risk Fixes:
- Moving to shadow DOM
- Changing sidebar injection architecture

---

## Next Steps

1. Implement Phase 2.1-2.3 (sidebar element filtering) immediately
2. Add Phase 1 logging for verification
3. Test with all test cases
4. If filtering works, commit the fix
5. If filtering doesn't work, investigate Phase 4 (shadow DOM)
6. Update this document with findings

---

## Additional Notes

### Why this wasn't caught earlier:
- Most test cases use specific selectors
- Global selectors are less common in real usage
- The bug is timing-dependent (only on preview OFF)
- No visual indication when sidebar is blank (no error message)

### Why specific selectors work:
- They don't match the sidebar container or iframe
- Example: `[data-framer-name='Hero']` only matches Framer elements
- Example: `div[data-framer-name="home_page_header"] h1` is very specific
- These selectors naturally exclude the sidebar elements
