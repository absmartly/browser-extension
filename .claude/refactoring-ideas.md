# Refactoring Ideas

## Move HTML Editor Out of Visual Editor Module

**Current Issue:**
The HTML editor (`src/visual-editor/ui/html-editor.ts`) is currently part of the visual-editor module, which gets bundled with esbuild into an IIFE format for injection into web pages. This causes complications:

1. CodeMirror dependencies must be marked as external in the visual-editor build
2. Two-step bundling process (esbuild for visual-editor, Plasmo for content script)
3. Unnecessary complexity since HTML editor never runs in injected context

**Why This Works Now:**
- Visual editor gets injected into web pages via `chrome.scripting.executeScript()`
- Must be a single self-contained IIFE bundle
- HTML editor imports are marked external, so they're excluded from the injected bundle
- Plasmo bundles CodeMirror separately when building content.ts

**Proposed Refactoring:**

### Move HTML Editor to Content Script Module

```
Current structure:
src/
  visual-editor/
    ui/
      html-editor.ts          ← Part of injected bundle
      components.ts           ← Imports html-editor
  content.ts                  ← Imports VisualEditor

Proposed structure:
src/
  visual-editor/
    ui/
      components.ts           ← Remove html-editor import
  content-scripts/
    html-editor.ts            ← Move here (content script only)
  content.ts                  ← Import both VisualEditor and HtmlEditor
```

### Implementation Steps:

1. **Move the file:**
   ```bash
   mkdir -p src/content-scripts
   mv src/visual-editor/ui/html-editor.ts src/content-scripts/html-editor.ts
   ```

2. **Update imports in `src/visual-editor/ui/components.ts`:**
   - Remove `import HtmlEditor from './html-editor'`
   - Remove `htmlEditor` property and initialization
   - Remove `createHtmlEditor()` method
   - Let the caller (content.ts) manage the HTML editor directly

3. **Update `content.ts`:**
   ```typescript
   import { VisualEditor } from '~src/visual-editor'
   import HtmlEditor from '~src/content-scripts/html-editor'

   // Create HTML editor instance separately
   const htmlEditor = new HtmlEditor(visualEditor.getStateManager())

   // Use it when needed for HTML editing
   const newHtml = await htmlEditor.show(element, currentHtml)
   ```

4. **Remove CodeMirror externals from `scripts/build-visual-editor.js`:**
   - Remove `'--external:codemirror'`
   - Remove `'--external:@codemirror/*'`
   - Visual editor bundle will be smaller and simpler

5. **Update tests:**
   - Update import paths in `src/visual-editor/ui/__tests__/html-editor.test.ts`

### Benefits:

1. **Simpler build process:** No need to mark CodeMirror as external
2. **Smaller injected bundle:** HTML editor code not included in visual-editor-injection.js
3. **Clearer separation of concerns:**
   - Visual editor = injected into pages
   - HTML editor = content script only
4. **Easier maintenance:** No complex external dependency management
5. **Better performance:** Smaller injected script = faster page load

### Potential Issues:

- Need to ensure state manager can be shared between visual editor and HTML editor
- May need to add an interface/abstraction if other components currently use `createHtmlEditor()`
- Need to verify all call sites of `createHtmlEditor()` and update them

### Files to Change:

- `src/visual-editor/ui/html-editor.ts` → `src/content-scripts/html-editor.ts`
- `src/visual-editor/ui/components.ts` (remove HTML editor integration)
- `content.ts` (add direct HTML editor management)
- `scripts/build-visual-editor.js` (remove external flags)
- `src/visual-editor/ui/__tests__/html-editor.test.ts` (update imports)

### Estimated Effort:

Low - Medium (2-3 hours)
- Mostly straightforward file moves and import updates
- Main complexity is ensuring state manager integration works correctly
- Need thorough testing of HTML editing functionality after changes
