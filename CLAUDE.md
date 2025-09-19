# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ABsmartly Browser Extension - A Plasmo-based browser extension for visual A/B testing with the ABsmartly platform. The extension enables users to create and manage DOM-based experiments visually without writing code.

## Common Development Commands

```bash
# Development
npm run dev                # Start dev server with hot reload (runs plasmo dev and SDK plugin watcher)

# Building
npm run build             # Production build for all browsers
npm run package           # Package extension for distribution

# Testing
npm test                  # Run Playwright tests
npm run test:ui          # Run tests with UI mode

# Linting & Formatting
npx prettier --write .   # Format code with Prettier
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

The extension works with a companion DOM changes SDK plugin located at `../absmartly-dom-changes-sdk-plugin/`. During development, the build script automatically uses the development build if available.

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