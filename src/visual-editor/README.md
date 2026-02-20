# ABsmartly Visual Editor

A unified, modular visual editor for A/B testing DOM manipulations. This package combines rich UI components with powerful DOM manipulation functionality, enabling users to visually create and manage DOM changes without writing code.

## Architecture Overview

The visual editor is built with a modular architecture consisting of 16 TypeScript modules organized into four main categories:

```
src/visual-editor/
├── core/          # Core functionality modules
├── ui/            # User interface components
├── utils/         # Utility functions
├── types/         # TypeScript type definitions
└── index.ts       # Main entry point
```

## Module Responsibilities

### Core Modules (`/core`)

#### `visual-editor.ts` (346 lines)
**Main Orchestrator** - The central class that coordinates all visual editor functionality.
- Initializes and manages all other modules
- Handles the main editor lifecycle (start, stop, destroy)
- Manages style injection and removal
- Tracks and saves DOM changes
- Implements the main public API (`initVisualEditor`)
- **Refactored**: Now delegates element actions to `ElementActions` and coordination to `EditorCoordinator`

#### `element-actions.ts` (287 lines)
**Element Manipulation Hub** - Handles all element-specific operations.
- Element selection and deselection
- Hover tooltips for element identification
- Hide/delete element operations
- Copy element HTML and selectors to clipboard
- Move elements up/down in DOM hierarchy
- Undo/redo change management
- Clear all changes with confirmation
- Generates robust selectors for elements

#### `editor-coordinator.ts` (318 lines)
**Module Integration Coordinator** - Manages inter-module communication and coordination.
- Sets up module integrations and callbacks
- Manages event listener lifecycle
- Coordinates keyboard shortcuts (Ctrl+Z, Ctrl+Y, Delete)
- Handles context menu action routing
- Manages mutation observers for DOM tracking
- Coordinates edit mode transitions
- Handles inline editing operations
- Provides centralized setup/teardown methods

#### `state-manager.ts` (149 lines)
**Centralized State Management** - Single source of truth for editor state.
- Maintains current editor state (active, mode, selected elements)
- Provides state getters and setters for all modules
- Manages state transitions and validation
- Tracks dragged elements, resizing status, and edit modes

#### `event-handlers.ts` (189 lines)
**Event Delegation System** - Centralizes all DOM event handling.
- Sets up global event listeners (click, hover, keyboard)
- Implements event delegation for performance
- Handles element selection and hover effects
- Manages keyboard shortcuts and escape key behavior
- Prevents event conflicts with the host page

#### `context-menu.ts` (295 lines)
**Right-Click Context Menu** - Provides contextual actions for elements.
- Creates shadow DOM-isolated context menu
- Defines menu items (Edit, Move, Resize, Delete, etc.)
- Calculates optimal menu positioning
- Handles menu action callbacks
- Provides 20+ contextual actions for DOM manipulation

#### `edit-modes.ts` (367 lines)
**Interactive Edit Modes** - Implements drag & drop and resize functionality.
- **Rearrange Mode**: Enables drag & drop to move elements
  - Smart parent detection for draggable elements
  - Visual feedback during dragging
  - Drop zone highlighting
- **Resize Mode**: Interactive element resizing
  - Creates 8-point resize handles
  - Real-time dimension updates
  - Maintains aspect ratios when needed

#### `change-tracker.ts` (316 lines)
**Change Tracking & History** - Records and manages all DOM modifications.
- Tracks all DOM changes made during the session
- Implements undo/redo functionality with command pattern
- Generates change descriptors for each modification
- Provides change serialization for saving
- Manages change application and reversal

#### `cleanup.ts` (228 lines)
**Cleanup & Restoration** - Ensures clean editor shutdown and DOM restoration.
- Removes all editor-injected elements and styles
- Restores original DOM state
- Cleans up event listeners and observers
- Manages memory cleanup to prevent leaks
- Handles emergency cleanup scenarios

### UI Components (`/ui`)

#### `components.ts` (481 lines)
**Rich UI Components** - Reusable UI building blocks.
- Modal dialogs for complex editing
- Form components for change configuration
- Property panels for element styling
- JSON editor for advanced users
- Color pickers, sliders, and input fields

#### `toolbar.ts` (218 lines)
**Main Editor Toolbar** - Primary control interface.
- Mode switcher (Edit, Rearrange, Resize)
- Save/Cancel buttons
- Undo/Redo controls
- Change counter display
- Settings and help buttons
- Responsive layout with mobile support

#### `styles.ts` (380 lines)
**Visual Styling System** - Comprehensive CSS styles.
- Editor theme and visual identity
- Component styles (buttons, forms, panels)
- Animation definitions
- Hover and selection effects
- Responsive breakpoints
- Shadow DOM style isolation

#### `notifications.ts` (107 lines)
**Toast Notification System** - User feedback messages.
- Success/error/info toast messages
- Auto-dismiss with configurable duration
- Stacking for multiple notifications
- Click-to-dismiss functionality
- Accessible ARIA announcements

### Utilities (`/utils`)

#### `selector-generator.ts` (620 lines)
**Robust CSS Selector Generation** - Creates reliable element selectors.
- Generates multiple selector strategies
- Optimizes for selector stability
- Handles dynamic IDs and classes
- Creates fallback selectors
- Validates selector uniqueness
- Performance-optimized with caching

### Type Definitions (`/types`)

#### `visual-editor.ts` (198 lines)
**TypeScript Type Definitions** - Ensures type safety across modules.
- Defines all interfaces and types
- DOM change type definitions
- Event handler signatures
- Configuration options
- State shape definitions

### Entry Point

#### `index.ts` (184 lines)
**Main Entry Point** - Public API and initialization.
- Exports `initVisualEditor` function
- Sets up module dependencies
- Handles initialization parameters
- Provides version information
- Manages global namespace setup

## Data Flow & Interactions

### Initialization Flow
```
1. index.ts (entry)
   ↓
2. visual-editor.ts (creates instances)
   ↓
3. state-manager.ts (initializes state)
   ↓
4. element-actions.ts + editor-coordinator.ts (setup coordination)
   ↓
5. editor-coordinator.setupAll() (connects modules)
   ↓
6. event-handlers.ts (sets up listeners)
   ↓
7. toolbar.ts + styles.ts (creates UI)
```

### User Interaction Flow
```
User Action (click/hover)
   ↓
event-handlers.ts (captures event)
   ↓
editor-coordinator.ts (routes action)
   ↓
state-manager.ts (updates state)
   ↓
Appropriate handler activated:
   - element-actions.ts (element operations)
   - context-menu.ts (right-click)
   - edit-modes.ts (drag/resize)
   - components.ts (edit dialog)
   ↓
change-tracker.ts (records change)
   ↓
notifications.ts (user feedback)
```

### Module Coordination
```
visual-editor.ts (orchestrator)
   ├── element-actions.ts (element ops)
   │   ├── selectElement()
   │   ├── hideElement()
   │   └── moveElement()
   └── editor-coordinator.ts (integration)
       ├── setupModuleIntegrations()
       ├── handleMenuAction()
       └── setupEventListeners()
```

### Change Recording Flow
```
DOM Modification
   ↓
change-tracker.ts (creates change record)
   ↓
visual-editor.ts (addChange method)
   ↓
state-manager.ts (updates change count)
   ↓
toolbar.ts (updates UI counter)
   ↓
visual-editor.ts (prepares for save)
```

### Cleanup Flow
```
User clicks "Done" or ESC
   ↓
visual-editor.ts (stop method)
   ↓
editor-coordinator.teardownAll()
   ↓
cleanup.ts (removes UI elements)
   ↓
event-handlers.ts (removes listeners)
   ↓
change-tracker.ts (finalizes changes)
   ↓
state-manager.ts (resets state)
```

## Refactored Architecture Benefits

The recent refactoring split the original 951-line `visual-editor.ts` into three focused modules:

### 1. **Improved Separation of Concerns**
- **visual-editor.ts** (346 lines) - Core lifecycle and orchestration only
- **element-actions.ts** (287 lines) - All element manipulation logic
- **editor-coordinator.ts** (318 lines) - Module integration and coordination

### 2. **Better Testability**
- Each module can be tested independently
- Clear interfaces between modules
- Mockable dependencies through constructor injection

### 3. **Enhanced Maintainability**
- Logical grouping of related functionality
- Easier to locate and modify specific features
- Reduced cognitive load when working on specific aspects

### 4. **Clear Delegation Pattern**
```typescript
// visual-editor.ts delegates to specialized modules
this.elementActions.hideElement()     // Element operations
this.coordinator.setupAll()           // Module coordination
this.stateManager.setChanges()        // State management
```

## Key Features

### Visual Editing Capabilities
- **Element Selection**: Click to select any element
- **Context Menu**: Right-click for contextual actions
- **Drag & Drop**: Rearrange elements visually
- **Resize Mode**: Adjust element dimensions
- **Inline Editing**: Direct text/content editing
- **Style Editor**: Visual style modifications
- **HTML Editor**: Direct HTML manipulation

### Technical Features
- **Shadow DOM Isolation**: Prevents style conflicts
- **Undo/Redo System**: Full history management
- **Robust Selectors**: Multiple fallback strategies
- **Performance Optimized**: Event delegation, caching
- **Type Safety**: Full TypeScript coverage
- **Modular Architecture**: Clean separation of concerns

## Usage

### Basic Initialization
```typescript
import { initVisualEditor } from './visual-editor';

// Start the visual editor
initVisualEditor(
  'variant-name',
  'experiment-name',
  '/path/to/logo.svg',
  existingChanges // optional array of previous changes
);
```

### Module Communication
Modules communicate through:
1. **Constructor Injection** for dependencies
2. **State Manager** for shared state
3. **Callbacks via EditorCoordinator** for loose coupling
4. **Public methods** for direct inter-module communication

### Build Output
The entire visual editor bundles to approximately **113KB** including all functionality and UI components.

## Development Guidelines

### Adding New Features
1. Determine the appropriate module based on functionality:
   - Element operations → `element-actions.ts`
   - Module coordination → `editor-coordinator.ts`
   - Core lifecycle → `visual-editor.ts`
2. Update type definitions in `types/visual-editor.ts`
3. Implement feature following existing patterns
4. Update state manager if new state is needed
5. Add event handlers if new interactions are required

### Module Dependencies
- All modules can import from `types/` and `utils/`
- Core modules can import from each other
- UI modules should not directly import core modules (use callbacks)
- The main `visual-editor.ts` orchestrates through `ElementActions` and `EditorCoordinator`

### Testing Considerations
- Each module is designed to be independently testable
- Mock the state manager for isolated testing
- Use dependency injection where possible
- Shadow DOM components require special testing setup

## Performance Considerations

- **Event Delegation**: Single listeners at document level
- **Selector Caching**: Computed selectors are cached
- **Debounced Updates**: UI updates are throttled
- **Lazy Loading**: Components created on demand
- **Memory Management**: Proper cleanup prevents leaks

## Browser Compatibility

- Chrome/Edge: Full support (primary target)
- Firefox: Full support
- Safari: Full support (with minor UI adjustments)
- Mobile: Limited support (view-only recommended)

## Future Enhancements

Potential areas for expansion:
- Advanced CSS editor with visual preview
- Multi-element selection and batch editing
- Animation and transition editors
- Responsive design mode
- A/B test preview mode
- Collaborative editing features
- AI-powered element suggestions
- Visual regression testing