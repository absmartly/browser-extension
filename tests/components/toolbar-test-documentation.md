# Toolbar Component Test Suite Documentation

## Overview
This document describes the comprehensive test suite for the Visual Editor Toolbar component. The tests are built using Playwright component testing and cover all aspects of the toolbar's functionality, user interactions, and visual states.

## Test File Location
`/Users/joalves/git_tree/absmartly-browser-extension/tests/components/toolbar.spec.ts`

## Test Architecture

### Mock Implementation
The tests use a browser-side mock implementation of the Toolbar component that replicates the exact functionality of the original TypeScript class. This approach allows us to:
- Test the component in isolation without external dependencies
- Mock the StateManager for controlled testing scenarios
- Simulate real browser interactions and behavior

### Test Helper Functions
- `createMockStateManager()`: Creates a mock StateManager with configurable state
- `waitForToolbar()`: Ensures toolbar is fully rendered before assertions
- `createToolbarInBrowser()`: Injects the toolbar implementation into the browser context

## Test Coverage

### 1. Toolbar Rendering with All Buttons
**Purpose**: Verifies complete toolbar structure and visual elements
**Tests**:
- Toolbar container exists and is visible
- Header with title "Visual Editor" is present
- Change counter displays correctly (initially "0")
- Instructions panel is rendered with proper content
- All 5 action buttons are present (Undo, Redo, Clear, Save, Exit)
- Button styling matches design specifications (colors, backgrounds)

### 2. Mode Switcher Functionality
**Purpose**: Tests state management for different editing modes
**Tests**:
- State transitions between Edit/Rearrange/Resize modes
- StateManager properly updates mode flags
- UI responds appropriately to mode changes

### 3. Save/Cancel Button Interactions
**Purpose**: Verifies primary action button functionality
**Tests**:
- Save button click triggers correct callback
- Exit button click triggers correct callback (acting as cancel)
- Event handlers execute properly

### 4. Undo/Redo Button States and Clicks
**Purpose**: Tests history management functionality
**Tests**:
- Buttons start in disabled state (no history)
- Visual feedback for disabled state (opacity 0.5)
- Enabling undo button updates state and appearance
- Enabling redo button updates state and appearance
- Click events trigger appropriate callbacks
- Disabled buttons cannot be interacted with

### 5. Change Counter Display Updates
**Purpose**: Verifies real-time change tracking
**Tests**:
- Initial counter shows "0"
- Counter updates to any positive number (tested with 5, 42)
- Counter can be reset to 0
- Visual styling remains consistent

### 6. Responsive Layout on Different Screen Sizes
**Purpose**: Ensures toolbar works across devices
**Tests**:
- Desktop layout (1200x800) - proper positioning and sizing
- Tablet layout (768x1024) - maintains visibility and functionality
- Mobile layout (375x667) - adapts to small screens
- Fixed positioning remains consistent across all sizes
- Maximum width constraint (320px) enforced

### 7. Keyboard Shortcuts Triggering Toolbar Actions
**Purpose**: Tests keyboard accessibility and power user features
**Tests**:
- Ctrl+Z triggers undo action
- Ctrl+Shift+Z triggers redo action
- Ctrl+S triggers save action
- Escape key triggers exit action
- All shortcuts prevent default browser behavior

### 8. Button Disabled States Based on Context
**Purpose**: Verifies contextual button states
**Tests**:
- Initial state with no actions available
- Partial state with only undo available
- Full state with both undo and redo available
- Save button remains consistently enabled
- Visual feedback for disabled buttons

### 9. Tooltip Displays on Hover
**Purpose**: Tests user guidance and accessibility
**Tests**:
- Each button has appropriate tooltip text
- Tooltips include keyboard shortcut hints
- Tooltips are properly formatted and descriptive

### 10. Accessibility (ARIA labels, keyboard navigation)
**Purpose**: Ensures toolbar is fully accessible
**Tests**:
- Toolbar has proper ARIA role and label
- All buttons have descriptive ARIA labels
- Keyboard navigation with arrow keys works
- Enter and Space keys activate buttons
- Tab order is logical and consistent
- Focus indicators are visible

### 11. Visual Regression Tests for Different States
**Purpose**: Prevents visual regressions across updates
**Screenshots Captured**:
- `toolbar-default-state.png` - Clean initial state
- `toolbar-with-changes.png` - With active change counter
- `toolbar-disabled-buttons.png` - Disabled undo/redo state
- `toolbar-enabled-buttons.png` - Fully enabled state
- `toolbar-save-hover.png` - Save button hover effect
- `toolbar-exit-hover.png` - Exit button hover effect

### 12. Toolbar Removal and Cleanup
**Purpose**: Tests proper memory management
**Tests**:
- Toolbar removal from DOM
- Internal reference cleanup
- No memory leaks after removal

### 13. Event Propagation Handling
**Purpose**: Ensures toolbar doesn't interfere with page interactions
**Tests**:
- Click events are properly stopped from propagating
- Page-level event handlers don't receive toolbar events
- Toolbar interactions remain isolated

### 14. Multiple Toolbar Instances Prevention
**Purpose**: Prevents duplicate toolbar creation
**Tests**:
- Multiple `create()` calls only result in one toolbar
- Proper instance management

### 15. Toolbar Positioning and Z-Index
**Purpose**: Ensures toolbar appears above all page content
**Tests**:
- Fixed positioning is correctly applied
- High z-index (2147483646) ensures visibility
- Toolbar appears above other high-z-index elements
- Positioning coordinates (top: 20px, right: 20px) are correct

## Mock StateManager Interface
The tests use a simplified StateManager mock that implements:
- `getState()`: Returns current editor state
- `getConfig()`: Returns editor configuration
- `updateState()`: Updates editor state with new values

## Running the Tests

```bash
# Run all toolbar tests
npm run test:e2e -- tests/components/toolbar.spec.ts

# Run with UI mode for debugging
npm run test:e2e -- tests/components/toolbar.spec.ts --ui

# Update visual regression baselines
npm run test:e2e -- tests/components/toolbar.spec.ts --update-snapshots

# Run specific test
npm run test:e2e -- tests/components/toolbar.spec.ts -g "Button disabled states"
```

## Test Maintenance

### Visual Regression Updates
When toolbar appearance changes:
1. Run tests with `--update-snapshots` flag
2. Review generated screenshots for accuracy
3. Commit updated baseline images

### Adding New Tests
When adding toolbar functionality:
1. Add corresponding test case
2. Include visual regression test if UI changes
3. Update this documentation
4. Ensure accessibility testing is included

### Debugging Failed Tests
1. Use `--ui` flag for interactive debugging
2. Check screenshot diffs for visual regression failures
3. Use browser developer tools for DOM inspection
4. Review test video recordings for interaction issues

## Integration with CI/CD
These tests are designed to run in headless mode in CI environments:
- No external dependencies required
- Self-contained browser implementation
- Consistent across different operating systems
- Fast execution (under 10 seconds total)

## Security Considerations
The toolbar component handles:
- Event prevention to avoid clickjacking
- Proper DOM manipulation without XSS risks
- Isolated execution context for safety