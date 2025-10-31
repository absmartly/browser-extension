# Visual Editor Test Refactoring Plan

## Goal
Transform the 1698-line `visual-editor-complete.spec.ts` into a **300-400 line orchestration-style test** that reads like a high-level workflow, with all implementation details pushed to helpers.

## Current State
- **Main test file**: 1698 lines (21% reduction from 2151 original)
- **Only extracted**: Actions test (462 lines → 1 helper function call)
- **Still inline**: ~1200+ lines of test logic spread across multiple test steps

## Strategy
- **No agent touches main file** until all helpers are ready
- **7 parallel agents** extract sections simultaneously
- **Task queue** coordinates work with status tracking
- **Final integration** updates main file once all helpers complete

## Sections to Extract

### 1. Undo/Redo Tests (~180 lines)
**Location**: lines 93-276
**Target**: `tests/e2e/helpers/ve-undo-redo.ts`
**Functions**:
- `testUndoRedoForAllActions(page)` - comprehensive undo/redo for all change types
- `testUndoRedoButtonStates(page)` - test disabled states

### 2. VE Protection Test (~25 lines)
**Location**: lines 66-87
**Target**: `tests/e2e/helpers/ve-verification.ts`
**Function**: `verifyVEProtection(sidebar)` - verify all VE buttons disabled when active

### 3. Verification Steps (~150 lines)
**Locations**:
- lines 358-449: Verify changes in sidebar
- lines 452-499: Verify changes and markers after VE exit
**Target**: `tests/e2e/helpers/ve-verification.ts`
**Functions**:
- Implement `verifySidebarHasChanges(sidebar, minExpectedChanges)`
- Implement `verifyChangesAfterVEExit(page)` - verify markers and changes persist
- Add helper `clickSaveButton(page)` for save action

### 4. Preview Toggle Test (~200 lines)
**Location**: lines 639-838
**Target**: `tests/e2e/helpers/ve-preview.ts` (new file)
**Function**: `testPreviewToggle(sidebar, page)` - test enable/disable preview

### 5. Exit Preview Button Test (~140 lines)
**Location**: lines 501-637
**Target**: `tests/e2e/helpers/ve-preview.ts` (new file)
**Function**: `testExitPreviewButton(sidebar, page)`

### 6. URL Filter Test (~180 lines)
**Location**: lines 840-1015
**Target**: `tests/e2e/helpers/ve-url-filter.ts` (new file)
**Function**: `testURLFilterAndPayload(sidebar, page)`

### 7. Second VE Instance Test (~130 lines)
**Location**: lines 1018-1147
**Target**: `tests/e2e/helpers/ve-experiment-setup.ts`
**Function**: `testSecondVEInstance(sidebar, page)`

### 8. Discard Changes Test (~230 lines)
**Location**: lines 1150-1425
**Target**: `tests/e2e/helpers/ve-discard.ts` (new file)
**Function**: `testDiscardChanges(sidebar, page, allConsoleMessages)`

### 9. Metadata Setup (~160 lines)
**Location**: lines 1427-1587
**Target**: `tests/e2e/helpers/ve-experiment-setup.ts`
**Function**: `fillMetadataForSave(sidebar)` - fill owners, teams, tags

### 10. Save Experiment (~110 lines)
**Location**: lines 1591-1696
**Target**: `tests/e2e/helpers/ve-experiment-setup.ts`
**Function**: `saveExperiment(sidebar, testPage, experimentName)`

### 11. Final Integration (main file update)
**Target**: `tests/e2e/visual-editor-complete.spec.ts`
**Action**: Replace all extracted sections with helper function calls
**Result**: ~300-400 lines of pure orchestration

## Expected Final Structure

```typescript
test('Complete VE workflow', async ({ context, extensionUrl }) => {
  await test.step('Inject sidebar', async () => {
    sidebar = await injectSidebar(testPage, extensionUrl)
  })

  await test.step('Create experiment', async () => {
    experimentName = await createExperiment(sidebar)
  })

  await test.step('Activate VE', async () => {
    await activateVisualEditor(sidebar, testPage)
  })

  await test.step('Test VE protection', async () => {
    await verifyVEProtection(sidebar)
  })

  await test.step('Test all VE actions', async () => {
    await testAllVisualEditorActions(testPage)
  })

  await test.step('Test undo/redo', async () => {
    await testUndoRedoForAllActions(testPage)
    await testUndoRedoButtonStates(testPage)
  })

  await test.step('Save changes', async () => {
    await clickSaveButton(testPage)
  })

  await test.step('Verify changes', async () => {
    await verifySidebarHasChanges(sidebar, 4)
    await verifyChangesAfterVEExit(testPage)
  })

  await test.step('Test Exit Preview', async () => {
    await testExitPreviewButton(sidebar, testPage)
  })

  await test.step('Test preview toggle', async () => {
    await testPreviewToggle(sidebar, testPage)
  })

  await test.step('Test URL filter', async () => {
    await testURLFilterAndPayload(sidebar, testPage)
  })

  await test.step('Test second VE', async () => {
    await testSecondVEInstance(sidebar, testPage)
  })

  await test.step('Test discard', async () => {
    await testDiscardChanges(sidebar, testPage, allConsoleMessages)
  })

  await test.step('Fill metadata', async () => {
    await fillMetadataForSave(sidebar)
  })

  if (SAVE_EXPERIMENT) {
    await test.step('Save experiment', async () => {
      await saveExperiment(sidebar, testPage, experimentName)
    })
  }
})
```

## New Files to Create
1. `tests/e2e/helpers/ve-preview.ts` - Preview button/toggle helpers
2. `tests/e2e/helpers/ve-url-filter.ts` - URL filter testing
3. `tests/e2e/helpers/ve-discard.ts` - Discard changes testing

## Expected Outcome
- **Main test file**: 300-400 lines (82-88% reduction)
- **8 helper modules**: All implementation details extracted
- **Pure orchestration**: Main test reads like a step-by-step workflow
- **All functionality preserved**: Every line of test logic moves to helpers
