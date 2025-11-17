# Sidebar Blank Bug - Verification Steps

## How to Reproduce the Bug

### Prerequisites
1. Build the extension: `npm run build:dev`
2. Load extension in Chrome
3. Open any test page

### Reproduction Steps

1. **Open sidebar** (click extension icon)
2. **Create or edit experiment** in create mode (experimentName = '')
3. **Add a DOM change with global selector:**
   ```json
   {
     "selector": "body",
     "type": "style",
     "styles": {
       "backgroundColor": "#ffe0e0"
     }
   }
   ```
4. **Turn preview ON** ✅ (Should work - background turns light red)
5. **Turn preview OFF** ❌ (BUG: Sidebar goes blank!)

### Expected Behavior

- Preview ON: Background turns light red, sidebar visible
- Preview OFF: Background returns to original, **sidebar still visible**

### Actual Behavior (Bug)

- Preview ON: Background turns light red, sidebar visible ✅
- Preview OFF: Background returns to original, **sidebar completely blank** ❌

## Debug Logging to Add

### Before Implementing Fix

Add these logs to understand what's happening:

#### 1. In PreviewManager.applyPreviewChange() (Line 61)

```typescript
const elements = document.querySelectorAll(change.selector)

console.log('🔍 [PreviewManager] querySelectorAll results:', {
  selector: change.selector,
  totalMatched: elements.length,
  matchedElements: Array.from(elements).map(el => {
    const info = {
      tag: el.tagName,
      id: el.id || '(no id)',
      classes: el.className || '(no classes)',
      isBody: el.tagName === 'BODY',
      isSidebarRoot: el.id === 'absmartly-sidebar-root',
      isSidebarIframe: el.id === 'absmartly-sidebar-iframe'
    }

    // Flag if we matched sidebar elements
    if (info.isSidebarRoot || info.isSidebarIframe) {
      console.warn('⚠️ [PreviewManager] MATCHED SIDEBAR ELEMENT!', info)
    }

    return info
  })
})
```

#### 2. In PreviewManager.removePreviewChanges() (Line 311)

```typescript
const markedElements = document.querySelectorAll(
  `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
)

console.log('🔍 [PreviewManager] Removing preview for:', experimentName)
console.log('🔍 [PreviewManager] Marked elements:', {
  count: markedElements.length,
  elements: Array.from(markedElements).map(el => {
    const info = {
      tag: el.tagName,
      id: el.id || '(no id)',
      hasOriginalData: el.hasAttribute('data-absmartly-original'),
      originalDataSnippet: el.getAttribute('data-absmartly-original')?.substring(0, 200)
    }

    // Check if body element was marked
    if (el.tagName === 'BODY') {
      console.warn('⚠️ [PreviewManager] BODY ELEMENT WAS MARKED!')
      console.warn('⚠️ [PreviewManager] Restoring body might remove sidebar!')

      // Check if sidebar exists now
      const sidebarExists = document.getElementById('absmartly-sidebar-root')
      console.log('🔍 [PreviewManager] Sidebar exists before restoration:', !!sidebarExists)
    }

    return info
  })
})
```

#### 3. After restoration loop (Line 369)

```typescript
// After the markedElements.forEach() loop ends
console.log('🔍 [PreviewManager] Restoration complete')

// Critical check: Is sidebar still there?
const sidebarAfter = document.getElementById('absmartly-sidebar-root')
if (!sidebarAfter) {
  console.error('❌ [PreviewManager] CRITICAL: Sidebar was removed during restoration!')
} else {
  console.log('✅ [PreviewManager] Sidebar still exists after restoration')
}
```

### After Implementing Fix

Add these logs to verify the fix works:

#### 1. In shouldExcludeElement() method

```typescript
private shouldExcludeElement(element: Element): boolean {
  const isSidebarContainer = element.id === 'absmartly-sidebar-root'
  const isSidebarIframe = element.id === 'absmartly-sidebar-iframe'

  if (isSidebarContainer || isSidebarIframe) {
    console.log('✅ [PreviewManager] Excluding sidebar element:', element.tagName, element.id)
    return true
  }

  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (sidebarContainer && sidebarContainer.contains(element)) {
    console.log('✅ [PreviewManager] Excluding element inside sidebar:', element.tagName, element.id)
    return true
  }

  return false
}
```

#### 2. In filtered query results

```typescript
const allElements = document.querySelectorAll(change.selector)
const elements = Array.from(allElements).filter(el => !this.shouldExcludeElement(el))

console.log('🔍 [PreviewManager] Filter results:', {
  selector: change.selector,
  totalMatched: allElements.length,
  afterFiltering: elements.length,
  filtered: allElements.length - elements.length,
  keptElements: elements.map(el => ({ tag: el.tagName, id: el.id || '(none)' }))
})

if (allElements.length !== elements.length) {
  console.log('✅ [PreviewManager] Successfully filtered out',
    allElements.length - elements.length, 'sidebar elements')
}
```

## Test Scenarios

### Scenario 1: Body Selector (Critical Test)

**Setup:**
```json
{
  "selector": "body",
  "type": "style",
  "styles": {
    "backgroundColor": "#ffe0e0"
  }
}
```

**Expected Logs (Before Fix):**
```
🔍 [PreviewManager] querySelectorAll results:
  selector: "body"
  totalMatched: 1
  matchedElements: [{ tag: "BODY", id: "(no id)", ... }]

⚠️ [PreviewManager] BODY ELEMENT WAS MARKED!
⚠️ [PreviewManager] Restoring body might remove sidebar!
🔍 [PreviewManager] Sidebar exists before restoration: true

❌ [PreviewManager] CRITICAL: Sidebar was removed during restoration!
```

**Expected Logs (After Fix):**
```
🔍 [PreviewManager] Filter results:
  selector: "body"
  totalMatched: 1
  afterFiltering: 1
  filtered: 0

🔍 [PreviewManager] Removing preview for: __preview__
🔍 [PreviewManager] Marked elements: { count: 1, ... }

✅ [PreviewManager] Sidebar still exists after restoration
```

### Scenario 2: Div Selector (Critical Test)

**Setup:**
```json
{
  "selector": "div",
  "type": "style",
  "styles": {
    "border": "1px solid red"
  }
}
```

**Expected Logs (Before Fix):**
```
🔍 [PreviewManager] querySelectorAll results:
  selector: "div"
  totalMatched: 50  (example)
  matchedElements: [
    ...
    ⚠️ [PreviewManager] MATCHED SIDEBAR ELEMENT! { isSidebarRoot: true }
    ...
  ]
```

**Expected Logs (After Fix):**
```
🔍 [PreviewManager] Filter results:
  selector: "div"
  totalMatched: 50
  afterFiltering: 49
  filtered: 1

✅ [PreviewManager] Successfully filtered out 1 sidebar elements
✅ [PreviewManager] Excluding sidebar element: DIV absmartly-sidebar-root
```

### Scenario 3: Specific Selector (Regression Test)

**Setup:**
```json
{
  "selector": "[data-framer-name='Hero']",
  "type": "text",
  "value": "New Hero Text"
}
```

**Expected Logs:**
```
🔍 [PreviewManager] Filter results:
  selector: "[data-framer-name='Hero']"
  totalMatched: 1
  afterFiltering: 1
  filtered: 0

(No sidebar elements should be filtered since selector doesn't match them)
```

## Console Commands for Manual Verification

Open browser console and run these commands:

### Check if sidebar exists

```javascript
const sidebar = document.getElementById('absmartly-sidebar-root')
console.log('Sidebar exists:', !!sidebar)
console.log('Sidebar visible:', sidebar ? sidebar.offsetParent !== null : false)
```

### Check what body selector matches

```javascript
const bodyElements = document.querySelectorAll('body')
console.log('Body elements:', bodyElements.length)
console.log('Body contains sidebar:', bodyElements[0]?.contains(document.getElementById('absmartly-sidebar-root')))
```

### Check what div selector matches

```javascript
const divElements = document.querySelectorAll('div')
const sidebarRoot = document.getElementById('absmartly-sidebar-root')
const matchesSidebar = Array.from(divElements).includes(sidebarRoot)
console.log('Total divs:', divElements.length)
console.log('Matches sidebar root:', matchesSidebar)
```

### Manually test filtering logic

```javascript
function shouldExcludeElement(element) {
  if (element.id === 'absmartly-sidebar-root' ||
      element.id === 'absmartly-sidebar-iframe') {
    return true
  }

  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (sidebarContainer && sidebarContainer.contains(element)) {
    return true
  }

  return false
}

const divElements = document.querySelectorAll('div')
const filtered = Array.from(divElements).filter(el => !shouldExcludeElement(el))

console.log('Before filtering:', divElements.length)
console.log('After filtering:', filtered.length)
console.log('Sidebar was filtered out:', divElements.length > filtered.length)
```

## Automated Test Case

Add this test to verify the fix:

```typescript
// File: tests/e2e/sidebar-global-selectors.spec.ts

test('sidebar should remain visible when preview with global selectors is turned off', async ({ page, extensionId }) => {
  await page.goto('http://localhost:8080/test-page.html')

  // Open sidebar
  const sidebar = await openSidebar(page)

  // Create experiment with global body selector
  const change = {
    selector: 'body',
    type: 'style',
    styles: {
      backgroundColor: '#ffe0e0'
    }
  }

  // Turn preview ON
  await enablePreview(page, [change])

  // Verify preview is active
  const bodyBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  )
  expect(bodyBg).toBe('rgb(255, 224, 224)')

  // Verify sidebar is visible
  let sidebarVisible = await page.evaluate(() => {
    const el = document.getElementById('absmartly-sidebar-root')
    return el && el.offsetParent !== null
  })
  expect(sidebarVisible).toBe(true)

  // Turn preview OFF (this is where bug happens)
  await disablePreview(page)

  // Verify sidebar is STILL visible (this is the critical check)
  sidebarVisible = await page.evaluate(() => {
    const el = document.getElementById('absmartly-sidebar-root')
    return el && el.offsetParent !== null
  })
  expect(sidebarVisible).toBe(true) // ← Should pass after fix

  // Verify background was restored
  const bodyBgAfter = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  )
  expect(bodyBgAfter).not.toBe('rgb(255, 224, 224)')
})
```

## Success Checklist

After implementing the fix, verify all these pass:

- [ ] Body selector: Preview ON → sidebar visible ✅
- [ ] Body selector: Preview OFF → sidebar visible ✅
- [ ] Div selector: Preview ON → sidebar visible ✅
- [ ] Div selector: Preview OFF → sidebar visible ✅
- [ ] H1 selector: Preview ON → sidebar visible ✅
- [ ] H1 selector: Preview OFF → sidebar visible ✅
- [ ] Specific selector: Preview ON → sidebar visible ✅
- [ ] Specific selector: Preview OFF → sidebar visible ✅
- [ ] Console shows filtering logs ✅
- [ ] Console shows "Successfully filtered out N sidebar elements" ✅
- [ ] No JavaScript errors ✅
- [ ] Automated test passes ✅

## Rollback Plan

If the fix causes issues:

1. Remove `shouldExcludeElement()` method
2. Remove filtering from `applyPreviewChange()`
3. Remove filtering from `removePreviewChanges()`
4. Rebuild: `npm run build:dev`
5. Consider shadow DOM approach instead
