# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ABsmartly Browser Extension - A Plasmo-based browser extension for visual A/B testing with the ABsmartly platform. The extension enables users to create and manage DOM-based experiments visually without writing code.

## Common Development Commands

```bash
# Development
npm run dev                # Start dev server with hot reload (runs plasmo dev and SDK plugin watcher)

# Building
npm run build:dev         # Development build (REQUIRED before running tests!)
npm run build             # Production build for all browsers
npm run package           # Package extension for distribution

# Testing
# IMPORTANT: Always build first with npm run build:dev before running tests!
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts  # Run specific E2E test
npm test                  # Run all Playwright tests
npm run test:ui          # Run tests with UI mode

# Linting & Formatting
npx prettier --write .   # Format code with Prettier
```

## CRITICAL Testing Notes

**ALWAYS run `npm run build:dev` before running E2E tests!** The tests use the built extension from `build/chrome-mv3-dev/`, not the source files. If you modify React components or add IDs for testing, you MUST rebuild first.

**For E2E tests, ALWAYS use the full command:**
```bash
npm run build:dev
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts
```

**CRITICAL: NEVER use grep, tail, head, or any output filtering!** Always run the test command without any pipes or filters. We need to see the FULL output to debug issues properly.

**🚨 ABSOLUTELY FORBIDDEN: NEVER EVER USE `waitForTimeout()` IN TESTS! 🚨**

This is a **HARD RULE** with **ZERO exceptions**:
- ❌ `waitForTimeout()` is **FORBIDDEN** - DO NOT USE IT UNDER ANY CIRCUMSTANCES
- ✅ Instead use: `waitFor({ state: 'visible' })`, `waitFor({ state: 'hidden' })`, `waitForSelector()`, `waitForFunction()`, or `expect().toBeVisible()`
- ❌ Random timeouts make tests flaky, unreliable, and can cause page crashes
- ✅ Always wait for specific DOM states, element visibility, or conditions

**Examples of correct waits:**
```typescript
// ✅ Wait for element to appear
await element.waitFor({ state: 'visible' })

// ✅ Wait for element to disappear
await dropdown.waitFor({ state: 'hidden' })

// ✅ Wait for condition
await page.waitForFunction(() => document.querySelector('.banner') !== null)

// ❌ FORBIDDEN - NEVER DO THIS
await page.waitForTimeout(1000)
```

**Never run all tests** - always run the specific test file as shown above.

### Element IDs for E2E Testing

**ALWAYS add `id` attributes to important interactive elements** for reliable E2E test selectors. This includes:
- Form inputs (text, email, password, etc.)
- Buttons (especially action buttons like Save, Submit, Refresh)
- Sections that need to be tested (like authentication status)
- Modal dialogs and their control elements
- Dropdowns and select elements
- Links that are tested

**Why IDs are critical:**
- ✅ IDs are stable, explicit, and intent-revealing
- ✅ Tests using `#id` selectors are fast and reliable
- ❌ CSS selectors like `.class` or `input[type="text"]` are fragile and break with styling changes
- ❌ Text-based selectors break when content changes
- ❌ Multiple elements matching a selector causes test flakiness

**Example:**
```tsx
// ✅ GOOD - Has id for testing
<Input
  id="absmartly-endpoint"
  label="ABsmartly Endpoint"
  type="url"
  value={apiEndpoint}
  onChange={(e) => setApiEndpoint(e.target.value)}
/>

// ❌ BAD - No id, hard to test reliably
<Input
  label="ABsmartly Endpoint"
  type="url"
  value={apiEndpoint}
  onChange={(e) => setApiEndpoint(e.target.value)}
/>
```

**Test selector usage:**
```typescript
// ✅ GOOD - Uses ID
const endpointInput = sidebar.locator('#absmartly-endpoint')

// ❌ BAD - Fragile selector
const endpointInput = sidebar.locator('input[placeholder="https://api.absmartly.com"]')
```

## Architecture & Structure

### Key Directories
- **index.tsx** - Main extension sidebar UI entry point
- **content.tsx** - Content script for visual editor injection
- **background.ts** - Background service worker for messaging and API calls
- **src/components/** - React components for the extension UI
  - `ExtensionUI.tsx` - Main extension container
  - `ExperimentList.tsx` - Experiment listing and management
  - `ExperimentDetail.tsx` - Detailed experiment view
  - `DOMChangesInlineEditor.tsx` - Visual DOM changes editor
  - `DOMChangesJSONEditor.tsx` - JSON editor for DOM changes
- **src/visual-editor/** - Modular visual editor for DOM manipulation (see [README](src/visual-editor/README.md))
  - 16 TypeScript modules organized into core, UI, utils, and types
  - Provides drag & drop, resize, and inline editing capabilities
  - Shadow DOM isolation and robust selector generation
- **src/lib/** - API client and core utilities
  - `absmartly-api.ts` - ABsmartly API client
  - `storage.ts` - Extension storage management
- **src/types/** - TypeScript type definitions
- **src/utils/** - Helper functions and utilities
- **public/** - Static assets and injected scripts
  - `inject-sdk-plugin.js` - Script injected to integrate with SDK
  - `absmartly-dom-changes.min.js` - DOM changes plugin

### Build Process
- Uses Plasmo framework for extension development
- Custom build scripts in `scripts/`:
  - `dev-build.js` - Handles development builds with SDK plugin integration
  - `post-build.js` - Production build processing
- Tailwind CSS for styling
- TypeScript for type safety

## SDK Plugin Integration

The extension works with a companion DOM changes SDK plugin located at `/Users/joalves/git_tree/absmartly-sdk-plugins/src`. During development, the build script automatically uses the development build if available.

## Key Technical Details

### Message Passing Architecture
- Background script acts as central message hub
- Content scripts communicate via Chrome runtime messages
- Sidebar UI uses port connections for real-time updates

### DOM Changes Format
DOM changes are stored as JSON arrays in experiment variant variables:
```json
[
  {
    "selector": ".element",
    "action": "text|html|style|class|attribute|js",
    "value": "...",
    "css": { /* for style action */ },
    "className": "...",
    "attributeName": "..."
  }
]
```

### Storage
- Uses Chrome storage API for credentials and settings
- Experiment data fetched from ABsmartly API
- Local caching for performance

## Development Guidelines

### Component Organization
- Keep components focused and under 500 lines
- Co-locate component-specific types and styles
- Use custom hooks in `src/hooks/` for shared logic

### State Management
- React hooks for local state
- Chrome storage for persistent settings
- Background script manages API state

### Error Handling
- All API calls wrapped in try-catch
- User-friendly error messages displayed
- Console logging for debugging

### Testing
- Playwright for E2E testing
- Tests located in `tests/` directory
- Focus on critical user flows

## Important Conventions

### Code Style
- Prettier configuration in `.prettierrc.mjs`
- 2-space indentation
- No semicolons
- Double quotes for strings
- Import sorting via Prettier plugin

### TypeScript
- Strict type checking enabled
- Interfaces for all API responses
- Type all component props

### Plasmo Framework
- Use Plasmo conventions for file naming
- Background scripts must handle message passing
- Content scripts injected via manifest configuration

## Common Tasks

### Adding a New Feature
1. Create component in appropriate directory
2. Add types to `src/types/`
3. Update message handlers in `background.ts` if needed
4. Add to `ExtensionUI.tsx` navigation if user-facing

### Modifying DOM Changes
1. Update types in `src/types/dom-changes.ts`
2. Modify editor components (`DOMChangesInlineEditor.tsx`, `DOMChangesJSONEditor.tsx`)
3. Update SDK plugin if needed
4. Test with visual editor in content script

### API Integration
1. Add methods to `src/lib/absmartly-api.ts`
2. Add message handlers in `background.ts`
3. Update types in `src/types/api.ts`
4. Handle errors appropriately

## Dependencies to Note

- **Plasmo**: Extension framework (don't modify core Plasmo files)
- **React 18**: UI framework
- **Tailwind CSS**: Utility-first CSS
- **Monaco Editor**: Code editor for JSON editing
- **Axios**: HTTP client for API calls
- **Heroicons**: Icon library