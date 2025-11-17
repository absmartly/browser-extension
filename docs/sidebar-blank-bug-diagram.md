# Sidebar Blank Bug - Visual Diagram

## DOM Structure

```
document.body (main page)
│
├── <page content>
│   ├── <header>
│   ├── <main>
│   │   ├── <h1>Page Title</h1>  ← Matched by "h1" selector
│   │   ├── <button>Click Me</button>  ← Matched by "button" selector
│   │   └── ...
│   └── <footer>
│
└── #absmartly-sidebar-root (div) ← ⚠️ PART OF MAIN PAGE DOM!
    └── #absmartly-sidebar-iframe (iframe)
        └── [Isolated iframe content]
            └── #__plasmo
                └── <ExtensionUI /> (React app)
```

## The Problem Flow

### Step 1: Preview Changes Applied (Works Fine)

```typescript
// PreviewManager.applyPreviewChange() - Line 61
const elements = document.querySelectorAll("body")
// Result: [<body>] - 1 element

// Body element gets marked and modified
body.setAttribute('data-absmartly-experiment', '__preview__')
body.setAttribute('data-absmartly-modified', 'true')
body.style.backgroundColor = 'red'  // Example change

// Sidebar is still inside body, still visible ✅
```

### Step 2: Preview Changes Removed (BUG OCCURS)

```typescript
// PreviewManager.removePreviewChanges() - Line 311
const markedElements = document.querySelectorAll(
  '[data-absmartly-experiment="__preview__"]'
)
// Result: [<body>] - Includes body element

// The restoration process (Line 314-369)
markedElements.forEach((element) => {
  if (element.hasAttribute('data-absmartly-original')) {
    const originalData = JSON.parse(element.getAttribute('data-absmartly-original'))

    // ⚠️ PROBLEM: If body's innerHTML was saved/restored:
    if (originalData.innerHTML !== undefined) {
      element.innerHTML = sanitizeHTML(originalData.innerHTML)
      // ❌ This WIPES OUT the sidebar container!
    }
  }
})
```

## Why Global Selectors Fail But Specific Selectors Work

### Global Selector: "body"

```
document.querySelectorAll("body")
→ Matches: <body> element
→ Sidebar container is INSIDE body
→ Restoring body can affect/remove sidebar
→ ❌ BUG OCCURS
```

### Global Selector: "h1"

```
document.querySelectorAll("h1")
→ Matches: All <h1> elements in page
→ Could match h1s in sidebar if any exist
→ May affect sidebar styling
→ ❌ POTENTIAL BUG
```

### Global Selector: "div"

```
document.querySelectorAll("div")
→ Matches: All <div> elements
→ Includes #absmartly-sidebar-root container!
→ ❌ DIRECT HIT - Will affect sidebar container
```

### Specific Selector: "[data-framer-name='Hero']"

```
document.querySelectorAll("[data-framer-name='Hero']")
→ Matches: Only elements with that attribute
→ Sidebar doesn't have this attribute
→ ✅ SAFE - Sidebar unaffected
```

## The Root Cause

```
┌─────────────────────────────────────────────────────────────┐
│ PreviewManager uses document.querySelectorAll()             │
│ without filtering out extension UI elements                 │
│                                                              │
│ document.querySelectorAll(change.selector)                  │
│         ↓                                                    │
│   Matches ALL elements in the main page DOM                 │
│   including the sidebar container and iframe                │
└─────────────────────────────────────────────────────────────┘
```

## Element State Capture Problem

When a global selector like `body` matches:

```typescript
// Step 1: Apply change - Line 82
const originalState = ElementStateManager.captureElementState(element)
// For body element, this captures:
{
  textContent: "...",
  innerHTML: "<header>...</header><main>...</main>...<div id='absmartly-sidebar-root'>...</div>",
  styles: {...},
  attributes: {...}
}

// Step 2: Store state
this.previewStateMap.set(element, {
  experimentName: '__preview__',
  originalState: {...},  // Includes sidebar in innerHTML!
  selector: 'body',
  changeType: 'style'
})
```

When removing preview:

```typescript
// Step 3: Restore state - Line 300
ElementStateManager.restoreElementState(element, data.originalState)

// If the original state included innerHTML:
// This would restore body to the state BEFORE sidebar was injected!
// Result: Sidebar container is REMOVED from DOM
```

## The Fix: Element Filtering

```typescript
// Add filter function
private shouldExcludeElement(element: Element): boolean {
  // 1. Check if it's the sidebar container or iframe
  if (element.id === 'absmartly-sidebar-root' ||
      element.id === 'absmartly-sidebar-iframe') {
    return true
  }

  // 2. Check if it's inside the sidebar
  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (sidebarContainer && sidebarContainer.contains(element)) {
    return true
  }

  return false
}

// Apply filter when querying
const allElements = document.querySelectorAll(change.selector)
const elements = Array.from(allElements).filter(el => !this.shouldExcludeElement(el))
```

## Before Fix vs After Fix

### Before Fix (Current Behavior)

```
document.querySelectorAll("div")
→ [<div class="page-header">, <div class="content">, <div id="absmartly-sidebar-root">, ...]
                                                       ↑
                                                    ❌ PROBLEM!
                                                    Sidebar gets modified/restored
```

### After Fix (Expected Behavior)

```
document.querySelectorAll("div")
→ [<div class="page-header">, <div class="content">, <div id="absmartly-sidebar-root">, ...]
                                                       ↓
                                              Filter applied
                                                       ↓
→ [<div class="page-header">, <div class="content">, ...]
                                                    ✅ FIXED!
                                                    Sidebar excluded
```

## Timing Diagram

```
User clicks Preview OFF
        ↓
Content script receives message
        ↓
Sends REMOVE_PREVIEW to SDK bridge
        ↓
Orchestrator.handleRemovePreview()
        ↓
PreviewManager.removePreviewChanges('__preview__')
        ↓
Query for marked elements: querySelectorAll('[data-absmartly-experiment="__preview__"]')
        ↓
    ┌───────────────────────────────────┐
    │ If body was marked:               │
    │   → Restore body's original state │
    │   → body.innerHTML = originalHTML │
    │   → ❌ Sidebar container removed  │
    └───────────────────────────────────┘
        ↓
Sidebar iframe loses parent container
        ↓
Sidebar goes BLANK 💥
```

## Why No JavaScript Errors?

```
The sidebar iframe is still technically "alive":
- The iframe element was removed from DOM
- But the iframe's internal document still exists
- React app inside iframe is still running
- No errors thrown, just invisible/disconnected

This is why logs show "successful" message handling
but the UI appears blank to the user.
```

## Testing Scenarios

### Scenario A: Body Selector (High Risk)

```
Change: { selector: "body", type: "style", styles: { backgroundColor: "red" } }

Risk Level: 🔴 CRITICAL
Why: Body contains the sidebar
Fix Priority: IMMEDIATE
```

### Scenario B: Div Selector (High Risk)

```
Change: { selector: "div", type: "style", styles: { border: "1px solid blue" } }

Risk Level: 🔴 CRITICAL
Why: Sidebar container is a div
Fix Priority: IMMEDIATE
```

### Scenario C: H1 Selector (Medium Risk)

```
Change: { selector: "h1", type: "style", styles: { color: "red" } }

Risk Level: 🟡 MEDIUM
Why: If sidebar has h1 elements, they'll be affected
Fix Priority: RECOMMENDED
```

### Scenario D: Specific Selector (Low Risk)

```
Change: { selector: "[data-framer-name='Hero']", type: "text", value: "New Text" }

Risk Level: 🟢 LOW
Why: Selector won't match sidebar elements
Fix Priority: NONE (already works)
```

## Prevention Strategy

### Current Behavior (Vulnerable)

```
┌──────────────────────────────────────────────┐
│ Main Page DOM                                │
│ ┌──────────────────────────────────────────┐ │
│ │ Page Content                             │ │
│ │ (Safe to modify)                         │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ Sidebar Container                        │ │
│ │ ❌ Can be modified by global selectors   │ │
│ │ ❌ Can be removed during restoration     │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Fixed Behavior (Protected)

```
┌──────────────────────────────────────────────┐
│ Main Page DOM                                │
│ ┌──────────────────────────────────────────┐ │
│ │ Page Content                             │ │
│ │ ✅ Safe to modify                        │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ Sidebar Container                        │ │
│ │ ✅ Filtered out of all queries           │ │
│ │ ✅ Protected during restoration          │ │
│ │                                          │ │
│ │ shouldExcludeElement() → true            │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Alternative: Shadow DOM Isolation

If filtering doesn't work, use shadow DOM:

```
document.body
│
├── <page content>
│   └── ...
│
└── #absmartly-sidebar-shadow-host (div)
    └── #shadow-root (shadow DOM) ← 🛡️ Complete isolation
        └── #absmartly-sidebar-root
            └── #absmartly-sidebar-iframe
                └── [iframe content]
```

Benefits:
- ✅ `document.querySelectorAll()` cannot reach inside shadow DOM
- ✅ Complete CSS isolation
- ✅ Guaranteed protection

Drawbacks:
- ⚠️ More complex architecture
- ⚠️ Harder to debug
- ⚠️ May break existing code that expects sidebar in main DOM
