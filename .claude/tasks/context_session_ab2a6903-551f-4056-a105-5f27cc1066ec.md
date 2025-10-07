# URL Filters - Session ab2a6903-551f-4056-a105-5f27cc1066ec

## Developer Info
- **Developer**: Developer 4
- **Branch**: dev4-url-filters
- **Worktree**: /Users/joalves/Coding/ext-dev4-url-filters
- **Main Directory**: /Users/joalves/git_tree/ext-dev4-url-filters

## Current Task
Modify the visual editor context menu:
1. Remove "Move up" and "Move down" options from the context menu
2. Add "Change image source" option that only appears when the context menu is opened on:
   - An `<img>` element
   - Any element with a background image (CSS `background-image`)

## Progress
- [x] Session context file created
- [x] Find and analyze context menu code
- [x] Remove Move up/down options
- [x] Add Change image source option for images
- [x] Implement handler for change-image-source action
- [x] Create ImageSourceDialog UI component
- [x] Wire up all callbacks
- [x] Commit implementation (commit 2cf6ac7)
- [x] Write unit tests (commit 2ea9590)
- [x] Write E2E tests (commit 3d6fe4a)
- [x] All testing complete

## Summary

✅ **Feature Complete!**

The "Change Image Source" feature has been fully implemented, tested, and committed.

## Files Created
- `src/visual-editor/ui/image-source-dialog.ts` - Dialog component for changing image sources
  - `show(element, currentSrc)` - Display dialog and return new URL or null
  - `getCurrentImageSource(element)` - Extract current image source from element
  - `validateImageUrl(url)` - Validate URL format
  - Shadow DOM isolation for styling
  - Input validation and error messages
  - Preview of current image
  - Keyboard shortcuts (Enter to apply, Escape to cancel)

## Files Modified
- `src/visual-editor/core/context-menu.ts`:
  - Removed "Move up" and "Move down" menu items
  - Added `isImageElement()` method to detect images and elements with background images
  - Modified `createMenuItems()` to accept `element` parameter and conditionally add "Change image source" option
  - Updated menu height calculation to account for removed items
  - "Change image source" option appears for:
    - `<img>` elements
    - Elements with CSS `background-image` property

- `src/visual-editor/core/editor-coordinator.ts`:
  - Import ImageSourceDialog
  - Add `changeImageSource` to EditorCoordinatorCallbacks interface
  - Initialize imageSourceDialog instance
  - Add case for 'change-image-source' action in handleMenuAction
  - Implement `handleChangeImageSource()` method:
    - Detects img vs background-image
    - Shows dialog to get new URL
    - Creates appropriate DOM change (attribute for img, style for background)
    - Tracks changes in undo/redo system

- `src/visual-editor/core/element-actions.ts`:
  - Import ImageSourceDialog
  - Add imageSourceDialog instance
  - Implement `changeImageSource()` public method:
    - Guards for no selected element
    - Detects element type
    - Shows dialog
    - Updates element and creates DOM change
    - Error handling with notifications

- `src/visual-editor/core/visual-editor.ts`:
  - Add `changeImageSource: () => this.elementActions.changeImageSource()` to callbacks

## Implementation Details

### DOM Changes Created

**For `<img>` elements:**
```typescript
{
  selector: "img.product",
  type: "attribute",
  value: { src: "https://new-url.jpg" },
  enabled: true,
  mode: "merge"
}
```

**For elements with background-image:**
```typescript
{
  selector: ".hero",
  type: "style",
  value: { "background-image": "url('https://new-url.jpg')" },
  enabled: true,
  mode: "merge"
}
```

### Undo/Redo
- Old values stored in undo stack
- Full undo/redo support through UndoRedoManager
- Changes tracked for session persistence

## Test Coverage

### Unit Tests (commit 2ea9590)
- **ImageSourceDialog** (`src/visual-editor/ui/__tests__/image-source-dialog.test.ts`):
  - URL extraction from img elements
  - URL extraction from background-image (various formats)
  - URL validation (http/https/data URLs, absolute paths)
  - Dialog show/hide interactions
  - User input validation and error messages
  - Keyboard shortcuts (Enter to apply, Escape to cancel)
  - Image preview functionality

- **ElementActions** (`src/visual-editor/core/__tests__/element-actions.test.ts`):
  - Change img src attribute creates correct DOM change
  - Change background-image style creates correct DOM change
  - Dialog cancellation handling
  - No element selected guard clause
  - Error handling with notifications

- **ContextMenu** (`src/visual-editor/core/__tests__/context-menu.test.ts`):
  - "Move up" and "Move down" NOT in menu
  - "Change image source" appears for img elements
  - "Change image source" appears for background-image elements
  - "Change image source" does NOT appear for regular elements
  - Standard menu items remain intact

### E2E Tests (commit 3d6fe4a)
- **Visual Editor Image Source** (`tests/e2e/visual-editor-image-source.spec.ts`):
  - Context menu shows correct options for img elements
  - Context menu shows correct options for background-image elements
  - Context menu does not show image options for regular elements
  - Successfully change img src via dialog
  - Successfully change background-image via dialog
  - Cancel dialog without making changes
  - "Move up" and "Move down" removed from all context menus

## Commits
1. **2cf6ac7** - `feat: add Change Image Source context menu option`
   - Implementation of all core features

2. **2ea9590** - `test: add comprehensive unit tests for Change Image Source feature`
   - Complete unit test coverage

3. **3d6fe4a** - `test: add E2E tests for Change Image Source feature`
   - End-to-end testing scenarios

## Notes
- Original context menu had: Edit Text, Edit HTML, Rearrange, Resize, Move up, Move down, Copy, Copy Selector Path, Select Relative Element, Insert new block, Hide, Delete
- **New context menu**: Same as above but without "Move up" and "Move down", and adds "Change image source" conditionally for image elements
