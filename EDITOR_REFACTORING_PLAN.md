# Unified CodeMirror Editor Refactoring Plan

## Problem Statement

Currently, we have **SIX different CodeMirror-based editor implementations** with massive code duplication (~2,700+ lines of duplicated code):

1. **JavaScript Editor** (325 lines) - "Save Code" button
2. **JSON Editor** (453 lines) - "Save Changes" button
3. **HTML Editor** (467 lines) - "Apply Changes" button
4. **Block Inserter** (654 lines) - "Insert Block" button + live preview + position selector
5. **Event Viewer** (374 lines) - "Close" button + read-only mode + Shadow DOM
6. **Code Editor in content.ts** (~400 lines inline) - Used for SDK plugin code injection

**Total:** ~2,700 lines of duplicated code across 6 implementations

### Inconsistencies Found:
- Different button labels ("Save Code", "Save Changes", "Apply Changes", "Insert Block", "Close")
- Different CSS class prefixes (`js-editor-*`, `json-editor-*`, `editor-*`, `inserter-*`, `event-viewer-*`)
- Different toolbar configurations (Format button, tips, position selector)
- Inconsistent features (draggable header, live preview, Shadow DOM isolation)
- Duplicated styling (~200+ lines per file)
- Different z-index values and positioning strategies

## Proposed Solution

Create a **single unified `UnifiedCodeEditor` class** that can be configured via parameters to handle all use cases.

### New File Structure
```
src/visual-editor/ui/
├── unified-code-editor.ts (NEW - ~400-500 lines)
├── unified-code-editor-types.ts (NEW - type definitions)
└── [DELETE] javascript-editor.ts, json-editor.ts, html-editor.ts,
              block-inserter.ts, event-viewer.ts
```

### Configuration Interface
```typescript
interface UnifiedCodeEditorConfig {
  // Content
  title: string
  subtitle?: string
  initialContent: string
  language: 'javascript' | 'json' | 'html'

  // UI Customization
  saveButtonText?: string  // Default: "Save"
  showCancelButton?: boolean  // Default: true
  showFormatButton?: boolean  // Default: false
  showToolbar?: boolean  // Default: true
  toolbarTips?: string | null

  // Editor Behavior
  readOnly?: boolean  // Default: false
  draggable?: boolean  // Default: false
  useShadowDOM?: boolean  // Default: false (only for Event Viewer)

  // Special Features
  livePreview?: {
    enabled: boolean
    targetElement: Element
  }
  positionSelector?: {
    enabled: boolean
    options: Array<{value: string, label: string, icon: string}>
    defaultValue: string
  }

  // Validation
  validator?: (content: string) => { valid: boolean; message?: string }

  // Callbacks
  onSave?: (content: string, extraData?: any) => void
  onCancel?: () => void
  onChange?: (content: string) => void

  // Custom sections (for Event Viewer metadata)
  customHeaderContent?: HTMLElement
}
```

## Migration Map

### 1. JavaScript Editor → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: 'Edit JavaScript Code',
  initialContent: code,
  language: 'javascript',
  saveButtonText: 'Save Code',
  showToolbar: true,
  toolbarTips: 'Available context: element, document, window, console, experimentName'
})
```

### 2. JSON Editor → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: title,
  initialContent: json,
  language: 'json',
  saveButtonText: 'Save Changes',
  showFormatButton: true,
  showToolbar: true,
  toolbarTips: "Each change must have 'selector' and 'type' fields • Use Ctrl/Cmd+F to search",
  validator: (content) => {
    try {
      JSON.parse(content)
      return { valid: true }
    } catch (e) {
      return { valid: false, message: 'Invalid JSON' }
    }
  }
})
```

### 3. HTML Editor → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: 'Edit HTML (Live Preview)',
  subtitle: `<${element.tagName.toLowerCase()}>`,
  initialContent: html,
  language: 'html',
  saveButtonText: 'Apply Changes',
  draggable: true,
  livePreview: {
    enabled: true,
    targetElement: element
  }
})
```

### 4. Block Inserter → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: 'Insert HTML Block (Live Preview)',
  subtitle: `Insert relative to <${element.tagName.toLowerCase()}>`,
  initialContent: '',
  language: 'html',
  saveButtonText: 'Insert Block',
  draggable: true,
  positionSelector: {
    enabled: true,
    options: [
      { value: 'before', label: 'Before', icon: '⬆️' },
      { value: 'after', label: 'After', icon: '⬇️' }
    ],
    defaultValue: 'after'
  },
  livePreview: {
    enabled: true,
    targetElement: element
  }
})
```

### 5. Event Viewer → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: 'Event Details',
  initialContent: jsonData,
  language: 'json',
  readOnly: true,
  useShadowDOM: true,
  saveButtonText: 'Close',
  showCancelButton: false,
  showToolbar: false,
  customHeaderContent: createEventMetadataSection(eventName, timestamp)
})
```

### 6. Code Editor (content.ts) → UnifiedCodeEditor
```typescript
new UnifiedCodeEditor({
  title: `</> ${data.sectionTitle}`,
  initialContent: data.value,
  language: 'html',
  readOnly: data.readOnly || false,
  saveButtonText: data.readOnly ? 'Close' : 'Save'
})
```

## Implementation Steps

### Phase 1: Create Unified Editor Foundation
1. Create `unified-code-editor-types.ts` with all type definitions
2. Create `unified-code-editor.ts` with:
   - Constructor accepting `UnifiedCodeEditorConfig`
   - Core rendering logic (backdrop, container, header)
   - CodeMirror initialization with language switching
   - Unified CSS generation with configurable class prefix

### Phase 2: Implement Configurable Features
3. Add toolbar system:
   - Format button (conditional)
   - Tips/context section (conditional)
   - Custom toolbar items via config
4. Add draggable header feature (conditional)
5. Add live preview system (conditional)
6. Add position selector widget (conditional)
7. Add validation system with status indicator
8. Add Shadow DOM support (conditional)

### Phase 3: Migrate Existing Editors
9. Update JavaScript Editor call sites → UnifiedCodeEditor
   - `content.ts` openJavaScriptEditor function
10. Update JSON Editor call sites → UnifiedCodeEditor
    - `content.ts` openJSONEditor function
11. Update HTML Editor call sites → UnifiedCodeEditor
    - Visual editor context menu "Edit HTML"
12. Update Block Inserter call sites → UnifiedCodeEditor
    - Visual editor context menu "Insert new block"
13. Update Event Viewer call sites → UnifiedCodeEditor
    - Events debug page event viewing
14. Update content.ts inline editor → UnifiedCodeEditor
    - SDK plugin code injection editor

### Phase 4: Update Tests
15. Update E2E tests for editor UI changes:

**tests/e2e/visual-editor-complete.spec.ts** (CRITICAL)
   - Tests HTML editor and Block inserter
   - Lines 336, 342, 393, 417, 427, 585, 853: `.cm-editor` selectors
   - Line 1600: `.json-editor-title` → `.unified-editor-title`
   - Test HTML editor modal appearance and functionality
   - Test Block inserter modal and position selector

**tests/e2e/events-debug-page.spec.ts** (HIGH)
   - Tests Event Viewer
   - Lines 243, 247, 464, 468: `#absmartly-event-viewer-host` selector
   - Event viewer modal appearance tests

**tests/e2e/sdk-events.spec.ts** (HIGH)
   - Tests Event Viewer UI elements
   - Lines 68, 76, 78, 85, 91, 95, 98, 111, 122, 124, 137, 139
   - Selectors to update:
     - `.event-viewer-button-close` → `.unified-editor-button-close`
     - `.event-viewer-title` → `.unified-editor-title`
     - `.event-viewer-value` → `.unified-editor-metadata-value`
     - `.event-viewer-button-copy` → `.unified-editor-button-copy`

**tests/e2e/experiment-code-injection.spec.ts** (HIGH)
   - Tests inline Code Editor from content.ts
   - Lines 175, 227, 251: `#absmartly-code-editor-fullscreen` selector
   - Update to unified editor ID or keep if config allows

**tests/e2e/visual-editor-context-menu.spec.ts** (MEDIUM)
   - May test context menu options that open editors

**tests/e2e/variable-sync.spec.ts** (LOW)
   - References CODE_EDITOR but may not directly test UI

### Phase 5: Clean Up
16. Delete old editor files:
    - `src/visual-editor/ui/javascript-editor.ts`
    - `src/visual-editor/ui/json-editor.ts`
    - `src/visual-editor/ui/html-editor.ts`
    - `src/visual-editor/ui/block-inserter.ts`
    - `src/visual-editor/ui/event-viewer.ts`
17. Remove inline CodeMirror code from `content.ts` (openCodeEditor function)
18. Update exports in `src/visual-editor/index.ts`
19. Update all imports across codebase

### Phase 6: Testing & Verification
20. Test all 6 editor use cases individually
21. Verify consistent UI/UX across all editors
22. Test special features (live preview, dragging, Shadow DOM)
23. Run E2E tests with updated selectors
24. Build and verify bundle size reduction

## Test Selector Migration Strategy

**Recommended: Use data attributes for stability**
```typescript
// In UnifiedCodeEditor
<div class="unified-editor-title" data-testid="editor-title">

// In tests
await page.waitForSelector('[data-testid="editor-title"]')
```

This decouples tests from CSS class names and makes tests more resilient.

## Benefits

1. **Massive DRY improvement**: Reduce from ~2,700 lines to ~500 lines (**~81% reduction**)
2. **Consistent UI/UX**: All editors look and behave the same way
3. **Single source of truth**: Bug fixes apply to all editors
4. **Easy to extend**: Add new editor types with just configuration
5. **Maintainability**: One file to update instead of six
6. **Type safety**: Centralized types prevent configuration errors
7. **Smaller bundle**: Less duplicated code shipped to users
8. **Better testability**: Single component to test, consistent selectors

## Files to Modify

### New Files
- `src/visual-editor/ui/unified-code-editor.ts` (NEW)
- `src/visual-editor/ui/unified-code-editor-types.ts` (NEW)

### Files to Update
- `src/visual-editor/index.ts` (update exports)
- `content.ts` (replace inline editor and 3 editor functions, update imports)
- Visual editor files using HTML editor and Block inserter
- **tests/e2e/visual-editor-complete.spec.ts** (update selectors)
- **tests/e2e/events-debug-page.spec.ts** (update selectors)
- **tests/e2e/sdk-events.spec.ts** (update selectors)
- **tests/e2e/experiment-code-injection.spec.ts** (update selectors)
- **tests/e2e/visual-editor-context-menu.spec.ts** (if needed)
- **tests/e2e/variable-sync.spec.ts** (if needed)

### Files to Delete
- `src/visual-editor/ui/javascript-editor.ts`
- `src/visual-editor/ui/json-editor.ts`
- `src/visual-editor/ui/html-editor.ts`
- `src/visual-editor/ui/block-inserter.ts`
- `src/visual-editor/ui/event-viewer.ts`

## Risks & Mitigation

**Risk**: Breaking existing functionality during migration
**Mitigation**: Migrate one editor at a time, test thoroughly before moving to next

**Risk**: Breaking E2E tests with selector changes
**Mitigation**: Update tests in parallel with implementation, use data-testid attributes

**Risk**: Configuration complexity
**Mitigation**: Provide sensible defaults, clear TypeScript types, comprehensive examples

**Risk**: Performance impact from conditional features
**Mitigation**: Lazy-load features only when needed, tree-shake unused code

**Risk**: Shadow DOM complexity for Event Viewer
**Mitigation**: Make Shadow DOM optional via config, test both regular and shadow DOM modes

## Estimated Impact

- **Lines of code removed**: ~2,200 lines
- **Lines of code added**: ~600 lines (unified editor + types)
- **Net reduction**: ~1,600 lines (**~73% reduction**)
- **Affected test files**: 6 E2E test files requiring selector updates
- **Breaking changes**: None for users (internal refactoring only)
- **Test updates**: ~50-100 lines of test code to update selectors

## Implementation Order

1. **Phase 1-2**: Create unified editor (no breaking changes yet)
2. **Phase 3**: Migrate editors one at a time, keeping old ones until all migrated
3. **Phase 4**: Update all tests with new selectors **in same commit as migration**
4. **Phase 5**: Delete old files only after all tests pass
5. **Phase 6**: Final verification and bundle analysis

## Success Criteria

✅ All 6 editor use cases work identically to before
✅ All E2E tests pass with updated selectors
✅ Bundle size reduced by at least 1,000 lines
✅ Consistent UI/UX across all editors
✅ No regressions in functionality
✅ TypeScript compilation succeeds with no errors
