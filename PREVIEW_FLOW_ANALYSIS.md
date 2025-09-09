# DOM Changes Preview Flow Analysis

This document provides a comprehensive analysis of how DOM changes preview functionality works in the ABSmartly browser extension, including the complete message flow and potential causes of duplicate operations.

## Overview

The DOM changes preview flow involves several components working together:

1. **Extension UI** (`ExperimentDetail.tsx` + `DOMChangesInlineEditor.tsx`)
2. **Content Script** (`content.ts`)
3. **Injected Script** (`inject-sdk-plugin.js`)
4. **SDK Plugin** (`absmartly-dom-changes-sdk-plugin`)

## Complete Flow Analysis

### 1. Initial Preview Toggle (Enable Preview)

When a user enables preview for a variant, the following sequence occurs:

#### Step 1: Preview Toggle in UI
**File**: `/src/components/ExperimentDetail.tsx`
**Function**: `handlePreviewToggleForVariant(enabled: boolean, variantKey: string)`

```typescript
// Line 656-698
const handlePreviewToggleForVariant = (enabled: boolean, variantKey: string) => {
  debugLog('🎯 handlePreviewToggleForVariant called:', { enabled, variantKey })
  setPreviewEnabled(enabled)
  setActivePreviewVariant(enabled ? variantKey : null)
  
  if (enabled) {
    const changes = variantData[variantKey]?.dom_changes || []
    const enabledChanges = changes.filter(c => c.enabled !== false)
    
    chrome.tabs.sendMessage(tabId, {
      type: 'ABSMARTLY_PREVIEW',
      action: 'apply',
      changes: enabledChanges,
      experimentName: experiment.name,
      variantName: variantName,
      experimentId: experiment.id
    })
  }
}
```

**Key Points**:
- Filters out disabled changes (`c.enabled !== false`)
- Sends only enabled changes to content script
- Uses `action: 'apply'` for initial preview

#### Step 2: Content Script Handling
**File**: `/content.ts`
**Lines**: 124-143

```typescript
if (message.type === 'ABSMARTLY_PREVIEW' && message.action === 'apply') {
  // Create preview header
  createPreviewHeader(message.experimentName, message.variantName)
  
  // Send message to SDK plugin
  window.postMessage({
    source: 'absmartly-extension',
    type: 'PREVIEW_CHANGES',
    payload: {
      changes: message.changes || [],
      experimentName: message.experimentName,
      variantName: message.variantName,
      experimentId: message.experimentId
    }
  }, '*')
}
```

**Key Points**:
- Creates visual preview header on the page
- Transforms extension message to window postMessage
- Changes message type from `ABSMARTLY_PREVIEW` to `PREVIEW_CHANGES`

#### Step 3: SDK Plugin Injection Script
**File**: `/public/inject-sdk-plugin.js`
**Lines**: 598-762

```javascript
if (event.data.type === 'PREVIEW_CHANGES') {
  const { changes, updateMode } = event.data.payload || {};
  
  // Find plugin instance (multiple fallback strategies)
  let plugin = findPluginInstance();
  
  if (plugin) {
    // Always remove existing changes first
    if (typeof plugin.removeChanges === 'function') {
      plugin.removeChanges(experimentName);
    }
    
    // Apply new changes
    if (typeof plugin.applyChange === 'function') {
      for (const change of (changes || [])) {
        plugin.applyChange(change, experimentName);
      }
    }
  }
}
```

**Key Points**:
- Always removes existing changes first (`removeChanges()`)
- Applies changes one by one using `applyChange()`
- Has multiple fallback strategies to find the plugin instance

#### Step 4: SDK Plugin Processing
**File**: `/absmartly-dom-changes-sdk-plugin/src/core/DOMChangesPlugin.ts`

```typescript
// Public API method called by injection script
applyChange(change: DOMChange, experimentName: string): boolean {
  return this.domManipulator.applyChange(change, experimentName);
}

removeChanges(experimentName?: string): AppliedChange[] {
  return this.domManipulator.removeChanges(experimentName);
}
```

**Key Points**:
- `applyChange()` delegates to `DOMManipulator`
- `removeChanges()` removes all changes for the experiment
- Each change is tracked for undo/redo functionality

### 2. Single DOM Change Checkbox Toggle

When a user toggles an individual DOM change checkbox:

#### Step 1: Checkbox Toggle in UI
**File**: `/src/components/DOMChangesInlineEditor.tsx`
**Lines**: 1827-1839

```typescript
const handleToggleChange = (index: number) => {
  const newChanges = [...changes]
  const wasEnabled = newChanges[index].enabled !== false
  newChanges[index] = { ...newChanges[index], enabled: !wasEnabled }
  
  onChange(newChanges) // Calls handleDOMChangesUpdate
}
```

**Key Points**:
- Toggles the `enabled` property of a single change
- Calls `onChange()` which triggers `handleDOMChangesUpdate()`

#### Step 2: Update Handler in ExperimentDetail
**File**: `/src/components/ExperimentDetail.tsx`
**Lines**: 359-440

```typescript
const handleDOMChangesUpdate = (variantName: string, changes: DOMChange[], options?: { isReorder?: boolean }) => {
  // Update local state
  setVariantData(prev => ({
    ...prev,
    [variantName]: { ...prev[variantName], dom_changes: changes }
  }))
  
  // Save to storage
  storage.set(`experiment-${experiment.id}-variants`, updated)
  
  // Re-apply preview if enabled (key condition)
  if (previewEnabled === true && 
      activePreviewVariant === variantName && 
      enabledChanges.length > 0 && 
      !options?.isReorder) {
    
    const enabledChanges = changes.filter(c => c.enabled !== false)
    
    chrome.tabs.sendMessage(tabId, {
      type: 'ABSMARTLY_PREVIEW',
      action: 'update',  // Different action!
      changes: enabledChanges,
      experimentName: experiment.name,
      variantName: variantName
    })
  }
}
```

**Key Points**:
- Updates local state and saves to storage
- **Only re-applies preview if already enabled**
- Uses `action: 'update'` instead of `'apply'`
- Filters to only enabled changes before sending

#### Step 3: Content Script Update Handling
**File**: `/content.ts`
**Lines**: 144-159

```typescript
else if (message.action === 'update') {
  // Update changes WITHOUT recreating the header
  window.postMessage({
    source: 'absmartly-extension',
    type: 'PREVIEW_CHANGES',
    payload: {
      changes: message.changes || [],
      experimentName: message.experimentName,
      variantName: message.variantName,
      experimentId: message.experimentId,
      updateMode: 'replace' // Important flag!
    }
  }, '*')
}
```

**Key Points**:
- Does NOT recreate the preview header
- Adds `updateMode: 'replace'` to the payload
- Same `PREVIEW_CHANGES` message type to plugin

#### Step 4: SDK Plugin Handles Update
**File**: `/public/inject-sdk-plugin.js`
**Lines**: 641-660

```javascript
// Always remove all changes first for now
if (typeof plugin.removeChanges === 'function') {
  plugin.removeChanges(expName);
}

// Apply changes using the public applyChange method
if (typeof plugin.applyChange === 'function') {
  for (const change of (changes || [])) {
    plugin.applyChange(change, expName);
  }
}
```

**Key Points**:
- **Same logic as initial apply**: remove all, then apply all
- Does not differentiate between `apply` and `update` actions
- Always does full remove/reapply cycle

## Root Cause of Potential Duplicate Operations

### Issue 1: Full Remove/Reapply on Every Checkbox Toggle

**Problem**: When a user toggles a single checkbox, the entire set of changes is removed and reapplied, not just the toggled change.

**Flow**:
1. User unchecks one DOM change
2. `handleDOMChangesUpdate()` is called with ALL changes
3. Plugin receives ALL enabled changes
4. Plugin removes ALL changes for the experiment
5. Plugin reapplies ALL remaining enabled changes

**Impact**: 
- Causes visual flickering
- Potentially expensive DOM operations
- May cause layout shifts

### Issue 2: No Incremental Change Support

**Problem**: The SDK plugin doesn't support incremental updates - it only supports "all or nothing" operations.

**Current Plugin API**:
```typescript
applyChange(change: DOMChange, experimentName: string): boolean  // Apply one change
removeChanges(experimentName?: string): AppliedChange[]         // Remove ALL changes
```

**Missing API**:
```typescript
removeChange(change: DOMChange, experimentName: string): boolean // Remove one change
updateChange(change: DOMChange, experimentName: string): boolean // Update one change
```

### Issue 3: Plugin Detection and Multiple Instances

**Problem**: The injection script has complex fallback logic to find plugin instances, which could lead to multiple plugins being affected.

**Detection Strategy** (Lines 603-629):
```javascript
// First try from context
if (cachedContext && cachedContext.__domPlugin) {
  plugin = cachedContext.__domPlugin.instance;
}
// Try window reference
else if (window.__absmartlyExtensionPlugin) {
  plugin = window.__absmartlyExtensionPlugin;
}
// Try site's own plugin instances
else if (window.__absmartlyPlugin) {
  plugin = window.__absmartlyPlugin;
}
// And more fallbacks...
```

**Risk**: Could apply changes to wrong plugin instance or multiple instances.

## Potential Solutions

### Solution 1: Implement Incremental Change Support

Add methods to the plugin API:

```typescript
// In DOMChangesPlugin.ts
removeSpecificChange(change: DOMChange, experimentName: string): boolean {
  return this.domManipulator.removeSpecificChange(change, experimentName);
}

toggleChange(change: DOMChange, experimentName: string, enabled: boolean): boolean {
  if (enabled) {
    return this.applyChange(change, experimentName);
  } else {
    return this.removeSpecificChange(change, experimentName);
  }
}
```

### Solution 2: Optimize Update Messages

Instead of sending all changes, send only the changed item:

```typescript
// In handleDOMChangesUpdate
chrome.tabs.sendMessage(tabId, {
  type: 'ABSMARTLY_PREVIEW',
  action: 'toggleChange',  // New action
  change: changes[changedIndex], // Single change
  enabled: changes[changedIndex].enabled,
  experimentName: experiment.name,
  variantName: variantName
})
```

### Solution 3: Debounce Updates

For multiple rapid changes, debounce the update messages:

```typescript
const debouncedUpdate = useMemo(
  () => debounce((variantName: string, changes: DOMChange[]) => {
    // Send update message
  }, 100),
  []
)
```

## Current State Summary

### Message Flow Summary

1. **Checkbox Toggle** → `handleToggleChange()`
2. **State Update** → `handleDOMChangesUpdate()`  
3. **Extension Message** → `chrome.tabs.sendMessage()` with `action: 'update'`
4. **Content Script** → Transforms to `PREVIEW_CHANGES` with `updateMode: 'replace'`
5. **Injection Script** → Always does remove all + apply all
6. **SDK Plugin** → `removeChanges()` + multiple `applyChange()`

### Performance Characteristics

- **On Initial Preview**: Remove all + Apply enabled (expected)
- **On Checkbox Toggle**: Remove all + Apply all enabled (inefficient)
- **On Multiple Toggles**: Multiple remove all + apply all cycles (very inefficient)

The extension works correctly but uses a brute-force approach that could be optimized for better performance and user experience.