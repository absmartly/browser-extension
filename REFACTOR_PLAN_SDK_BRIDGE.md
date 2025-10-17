# Refactoring Plan: inject-sdk-plugin.js → Bundled SDK Bridge Package

## Executive Summary

The file `public/inject-sdk-plugin.js` (1834 lines) will be refactored into a modern TypeScript package that's bundled with esbuild, following the same proven pattern used for the visual editor.

## ✅ RECOMMENDED APPROACH: Bundled Package with esbuild

**Pattern:** TypeScript modules → esbuild → Single bundled JavaScript file

This is the **same approach used successfully for the visual editor** and provides:
- Modern TypeScript with full type safety
- Single optimized bundle for fast loading
- Better developer experience with IDE support
- Proven, working pattern already in the codebase

---

## Current Problems

### 1. **Misleading Name**
- **Current**: `inject-sdk-plugin.js`
- **Problem**: Name suggests it only injects SDK plugins, but it does much more

### 2. **Single Responsibility Violation**
The file currently handles 13 different responsibilities:
1. HTML sanitization (XSS protection)
2. Debug logging utilities
3. Preview DOM changes (apply/remove)
4. Element state capture/restore
5. Manual DOM changes application
6. Plugin detection
7. Message passing to extension
8. SDK detection and interception
9. Event logger interception
10. Custom code injection
11. URL filtering
12. Cookie override parsing
13. SDK initialization orchestration

### 3. **Code Duplication**
- `sanitizeHTML()` called in 6 places (lines 146, 258, 314, 453, 609, 982)
- Manual DOM changes logic duplicated across preview and permanent changes

### 4. **Testing Challenges**
- Hard to test individual components in isolation
- 1834 lines in a single file makes unit testing complex
- No type safety - bugs only caught at runtime

### 5. **Page Context Constraints**
- Runs in PAGE CONTEXT (not extension context)
- Current file cannot use npm imports
- But bundled approach solves this - can use npm packages at build time!

---

## Comparison: Why Bundled Package is Better

### ✅ Bundled Package (RECOMMENDED)

**Pros:**
- ✅ **Modern TypeScript** - Full type safety, interfaces, enums
- ✅ **Import/export syntax** - Clear module dependencies
- ✅ **IDE support** - Autocomplete, refactoring, go-to-definition
- ✅ **Single file output** - Fast loading, no multiple requests
- ✅ **Minification** - Smaller bundle size (~50% reduction)
- ✅ **Tree shaking** - Remove unused code automatically
- ✅ **Source maps** - Debug TypeScript in browser
- ✅ **npm packages** - Can use DOMPurify, etc. (bundled at build time)
- ✅ **Better testing** - Test TypeScript modules with Jest
- ✅ **Proven pattern** - Already works for visual editor

**Cons:**
- ⚠️ Requires build step (already have it for visual editor)
- ⚠️ One-time setup (~1 hour)

### ❌ Separate Vanilla JS Modules (Not Recommended)

**Cons:**
- ❌ 14 separate HTTP requests (slow page load)
- ❌ No TypeScript (no type safety)
- ❌ Manual dependency ordering required
- ❌ Global namespace pollution (14 objects on window)
- ❌ No modern tooling benefits
- ❌ Larger total size (no tree shaking)

---

## Proposed Structure

### Source Directory (TypeScript)

```
src/
├── sdk-bridge/                          # NEW: SDK Bridge package
│   ├── index.ts                         # Main entry point & exports
│   │
│   ├── types/                           # TypeScript type definitions
│   │   ├── sdk.ts                       # SDK-related types
│   │   ├── messages.ts                  # Message passing types
│   │   ├── dom-changes.ts              # DOM change types
│   │   └── config.ts                    # Configuration types
│   │
│   ├── utils/                           # Utility modules
│   │   ├── html-sanitizer.ts           # XSS protection (lines 10-60)
│   │   ├── logger.ts                    # Debug logging (lines 64-74)
│   │   ├── message-bridge.ts           # Message passing (lines 717-720)
│   │   └── url-filter.ts               # URL matching (lines 1051-1153)
│   │
│   ├── sdk/                             # SDK interaction
│   │   ├── detector.ts                  # SDK/Context detection (lines 849-971)
│   │   ├── interceptor.ts              # Event logger interception (lines 725-844)
│   │   └── plugin-detector.ts          # Plugin detection (lines 673-712)
│   │
│   ├── dom/                             # DOM manipulation
│   │   ├── preview-manager.ts          # Preview changes (lines 101-300)
│   │   ├── dom-applier.ts              # Apply DOM changes (lines 368-668)
│   │   └── element-state.ts            # State capture/restore (lines 189-357)
│   │
│   ├── experiment/                      # Experiment features
│   │   ├── code-injector.ts            # Custom code injection (lines 977-1236)
│   │   └── override-manager.ts         # Cookie overrides (lines 1299-1322)
│   │
│   └── core/                            # Core orchestration
│       └── orchestrator.ts             # Initialization flow (lines 1327-1757)
```

### Build Output

```
public/
└── absmartly-sdk-bridge.bundle.js      # Single optimized bundle
```

### Build Configuration

```javascript
// scripts/build-sdk-bridge.js
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const srcDir = path.join(__dirname, '..', 'src', 'sdk-bridge')
const entryFile = path.join(srcDir, 'index.ts')
const outputFile = path.join(__dirname, '..', 'public', 'absmartly-sdk-bridge.bundle.js')

console.log('[SDK Bridge Build] Building SDK bridge bundle...')

try {
  // Use esbuild to bundle TypeScript modules
  const buildCommand = [
    'npx',
    'esbuild',
    `"${entryFile}"`,
    '--bundle',
    `--outfile="${outputFile}"`,
    '--format=iife',
    '--global-name=ABSmartlySDKBridge',
    '--platform=browser',
    '--target=es2020',
    '--minify-syntax',
    '--keep-names',
    '--sourcemap'
  ].join(' ')

  execSync(buildCommand, { stdio: 'inherit' })

  // Wrap for global availability
  let bundledCode = fs.readFileSync(outputFile, 'utf8')

  const wrappedCode = `
/**
 * ABsmartly SDK Bridge - Bundled Script
 * Bridges extension with ABsmartly SDK on page
 * Version: 1.1.0
 */

${bundledCode}

// Expose global API for backward compatibility
if (typeof ABSmartlySDKBridge !== 'undefined') {
  // Expose initialization functions
  window.__absmartlyGetVariantAssignments = ABSmartlySDKBridge.getVariantAssignments
  window.__absmartlyGetContextPath = ABSmartlySDKBridge.getContextPath

  // Mark as injected
  window.__absmartlyExtensionInjected = true

  console.log('[ABsmartly] SDK Bridge loaded successfully')
} else {
  console.error('[ABsmartly] Failed to load SDK Bridge')
}
`

  fs.writeFileSync(outputFile, wrappedCode)
  console.log(`[SDK Bridge Build] Successfully built ${outputFile}`)

} catch (error) {
  console.error('[SDK Bridge Build] Build failed:', error)
  process.exit(1)
}
```

---

## Module Breakdown

### 1. **types/** (Type Definitions)

#### types/sdk.ts
```typescript
export interface ABSmartlyContext {
  treatment(experimentName: string): number
  peek(experimentName: string): number
  ready(): Promise<void>
  data(): ContextData
  // ... other SDK methods
}

export interface ContextData {
  experiments: Experiment[]
  // ... other fields
}
```

#### types/messages.ts
```typescript
export interface ExtensionMessage {
  source: 'absmartly-page' | 'absmartly-extension'
  type: string
  payload?: any
}

export type MessageType =
  | 'SDK_CONTEXT_READY'
  | 'PREVIEW_CHANGES'
  | 'REMOVE_PREVIEW'
  | 'APPLY_OVERRIDES'
  // ... etc
```

#### types/dom-changes.ts
```typescript
export interface DOMChange {
  selector: string
  type: 'text' | 'html' | 'style' | 'class' | 'attribute' | 'delete'
  value?: any
  enabled?: boolean
  // ... other fields
}
```

---

### 2. **utils/** (Utility Modules)

#### utils/html-sanitizer.ts (~60 lines)
```typescript
/**
 * HTML Sanitization for XSS Protection
 * Removes dangerous tags, attributes, and URIs
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''

  const temp = document.createElement('div')
  temp.innerHTML = html

  // Remove dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'base']
  dangerousTags.forEach(tag => {
    temp.querySelectorAll(tag).forEach(el => el.remove())
  })

  // Remove dangerous attributes
  const dangerousAttrs = ['onerror', 'onload', 'onclick', /* ... */]
  temp.querySelectorAll('*').forEach(el => {
    dangerousAttrs.forEach(attr => el.removeAttribute(attr))

    // Remove any 'on*' attributes
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })

    // Sanitize href/src
    ['href', 'src'].forEach(attr => {
      const value = el.getAttribute(attr)
      if (value && /^(javascript|data):/i.test(value)) {
        el.removeAttribute(attr)
      }
    })
  })

  return temp.innerHTML
}
```

#### utils/logger.ts (~40 lines)
```typescript
export class Logger {
  private static DEBUG = true

  static log(...args: any[]): void {
    if (this.DEBUG) console.log('[ABsmartly Extension]', ...args)
  }

  static error(...args: any[]): void {
    if (this.DEBUG) console.error('[ABsmartly Extension]', ...args)
  }

  static warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[ABsmartly Extension]', ...args)
  }

  static setDebug(enabled: boolean): void {
    this.DEBUG = enabled
  }
}
```

#### utils/message-bridge.ts (~50 lines)
```typescript
import { ExtensionMessage } from '../types/messages'

export class MessageBridge {
  static sendToExtension(message: ExtensionMessage): void {
    window.postMessage(message, '*')
  }

  static onMessage(type: string, handler: (payload: any) => void): void {
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'absmartly-extension' && event.data?.type === type) {
        handler(event.data.payload)
      }
    })
  }
}
```

#### utils/url-filter.ts (~120 lines)
```typescript
export interface URLFilter {
  matchType?: 'path' | 'full-url' | 'domain' | 'query' | 'hash'
  include?: string[]
  exclude?: string[]
  mode?: 'regex' | 'wildcard'
}

export function matchesUrlFilter(urlFilter?: URLFilter | string | string[]): boolean {
  if (!urlFilter) return true

  // ... existing logic from lines 1051-1153
}
```

---

### 3. **dom/** (DOM Manipulation)

#### dom/element-state.ts (~90 lines)
```typescript
export interface ElementState {
  textContent: string
  innerHTML: string
  attributes: Record<string, string>
  styles: Record<string, string>
  classList: string[]
}

export class ElementStateManager {
  static capture(element: HTMLElement): ElementState {
    // ... existing logic from lines 189-212
  }

  static restore(element: HTMLElement, state: ElementState): void {
    // ... existing logic from lines 305-357
  }
}
```

#### dom/preview-manager.ts (~230 lines)
```typescript
import { DOMChange } from '../types/dom-changes'
import { ElementStateManager } from './element-state'
import { sanitizeHTML } from '../utils/html-sanitizer'

export class PreviewManager {
  private static previewStateMap = new Map<HTMLElement, any>()

  static applyPreviewChange(change: DOMChange, experimentName: string): boolean {
    // ... existing logic from lines 101-184
  }

  static removePreviewChanges(experimentName: string): boolean {
    // ... existing logic from lines 217-300
  }

  static clearAll(): void {
    this.previewStateMap.clear()
  }
}
```

#### dom/dom-applier.ts (~230 lines)
```typescript
export class DOMChangesApplier {
  static applyManually(changes: DOMChange[]): void {
    // ... existing logic from lines 368-565
  }

  static removeManually(): void {
    // ... existing logic from lines 570-668
  }
}
```

---

### 4. **sdk/** (SDK Interaction)

#### sdk/detector.ts (~160 lines)
```typescript
import { ABSmartlyContext } from '../types/sdk'
import { Logger } from '../utils/logger'

export class SDKDetector {
  private static cachedContext: ABSmartlyContext | null = null
  private static contextPropertyPath: string | null = null

  static detectSDK(): { sdk: any, context: ABSmartlyContext | null } {
    // ... existing logic from lines 849-971
  }

  static getContext(): ABSmartlyContext | null {
    return this.cachedContext
  }

  static getContextPath(): string | null {
    return this.contextPropertyPath
  }

  static clearCache(): void {
    this.cachedContext = null
  }
}
```

#### sdk/interceptor.ts (~130 lines)
```typescript
export class SDKInterceptor {
  static interceptEventLogger(context: any): void {
    // ... existing logic from lines 725-785
  }

  static interceptCreateContext(sdk: any): void {
    // ... existing logic from lines 790-811
  }

  static interceptConstructor(sdkModule: any): void {
    // ... existing logic from lines 816-844
  }
}
```

#### sdk/plugin-detector.ts (~90 lines)
```typescript
export class PluginDetector {
  static isDOMPluginLoaded(): boolean | string {
    const context = SDKDetector.getContext()

    // Check for plugin registration
    if (context?.__domPlugin?.initialized) {
      return true
    }

    // Check for plugin artifacts
    const pluginElements = document.querySelectorAll('[data-absmartly-modified]')
    if (pluginElements.length > 0) {
      return 'active-but-inaccessible'
    }

    return false
  }

  static isOverridesPluginLoaded(): boolean {
    const context = SDKDetector.getContext()
    return !!(context?.__overridesPlugin?.initialized)
  }
}
```

---

### 5. **experiment/** (Experiment Features)

#### experiment/code-injector.ts (~150 lines)
```typescript
export class CodeInjector {
  static injectExperimentCode(context: any): void {
    // ... existing logic from lines 1158-1236
  }

  private static executeScriptsInHTML(html: string, location: string): void {
    // ... existing logic from lines 977-1015
  }

  private static insertAtLocation(element: HTMLElement, location: string): void {
    // ... existing logic from lines 1020-1045
  }
}
```

#### experiment/override-manager.ts (~50 lines)
```typescript
export class OverrideManager {
  static checkOverridesCookie(): void {
    // ... existing logic from lines 1299-1322
  }

  // DEPRECATED - kept for reference
  // static parseCookieOverrides() { ... }
}
```

---

### 6. **core/** (Orchestration)

#### core/orchestrator.ts (~320 lines)
```typescript
export class Orchestrator {
  private static isInitializing = false
  private static isInitialized = false

  static async waitForSDKAndInitialize(): Promise<void> {
    // ... existing logic from lines 1327-1420
  }

  static async initializePlugins(ctx: any, config: any): Promise<void> {
    // ... existing logic from lines 1609-1741
  }

  static setupMessageListeners(): void {
    // ... existing logic from lines 1423-1757
  }
}
```

---

### 7. **index.ts** (Main Entry Point)

```typescript
/**
 * ABsmartly SDK Bridge - Main Entry Point
 *
 * This module bridges the ABsmartly browser extension with the ABsmartly SDK
 * running on the page. It handles SDK detection, plugin initialization,
 * DOM changes, and message passing.
 */

// Export all public APIs
export { sanitizeHTML } from './utils/html-sanitizer'
export { Logger } from './utils/logger'
export { MessageBridge } from './utils/message-bridge'
export { matchesUrlFilter } from './utils/url-filter'

export { SDKDetector } from './sdk/detector'
export { SDKInterceptor } from './sdk/interceptor'
export { PluginDetector } from './sdk/plugin-detector'

export { PreviewManager } from './dom/preview-manager'
export { DOMChangesApplier } from './dom/dom-applier'
export { ElementStateManager } from './dom/element-state'

export { CodeInjector } from './experiment/code-injector'
export { OverrideManager } from './experiment/override-manager'

export { Orchestrator } from './core/orchestrator'

// Export types
export * from './types/sdk'
export * from './types/messages'
export * from './types/dom-changes'
export * from './types/config'

// Version
export const SDK_BRIDGE_VERSION = '1.1.0'

// Global API for backward compatibility
export async function getVariantAssignments(experimentNames: string[]) {
  const { assignments, experimentsInContext } = await SDKDetector.getContext()
  // ... implementation from lines 1760-1806
}

export function getContextPath() {
  return {
    found: !!SDKDetector.getContext(),
    path: SDKDetector.getContextPath(),
    // ... implementation from lines 1809-1822
  }
}

// Auto-start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Orchestrator.waitForSDKAndInitialize())
} else {
  setTimeout(() => Orchestrator.waitForSDKAndInitialize(), 100)
}
```

---

## Package.json Updates

```json
{
  "scripts": {
    "build:sdk-bridge": "node scripts/build-sdk-bridge.js",
    "build:sdk-bridge:watch": "nodemon --watch src/sdk-bridge -e ts --exec 'npm run build:sdk-bridge'",
    "dev": "npm run build:sdk-bridge && plasmo dev",
    "build": "npm run build:sdk-bridge && plasmo build"
  }
}
```

---

## Migration Plan

### Phase 1: Setup & Infrastructure (2 hours)

**Tasks:**
1. Create `src/sdk-bridge/` directory structure
2. Create `scripts/build-sdk-bridge.js` build script
3. Add TypeScript config for sdk-bridge package
4. Test build works with simple "hello world"
5. Add npm scripts to package.json

**Verification:**
- ✅ `npm run build:sdk-bridge` creates bundle
- ✅ Bundle loads in browser without errors

---

### Phase 2: Extract Type Definitions (1 hour)

**Tasks:**
1. Create `types/sdk.ts` - SDK interfaces
2. Create `types/messages.ts` - Message types
3. Create `types/dom-changes.ts` - DOM change types
4. Create `types/config.ts` - Configuration types

**Files:**
- `src/sdk-bridge/types/sdk.ts`
- `src/sdk-bridge/types/messages.ts`
- `src/sdk-bridge/types/dom-changes.ts`
- `src/sdk-bridge/types/config.ts`

---

### Phase 3: Extract Utility Modules (2 hours)

**Tasks:**
1. Extract `sanitizeHTML()` → `utils/html-sanitizer.ts`
2. Extract debug logging → `utils/logger.ts`
3. Extract message passing → `utils/message-bridge.ts`
4. Extract URL filtering → `utils/url-filter.ts`
5. Add comprehensive JSDoc to each

**Files:**
- `src/sdk-bridge/utils/html-sanitizer.ts` (~60 lines)
- `src/sdk-bridge/utils/logger.ts` (~40 lines)
- `src/sdk-bridge/utils/message-bridge.ts` (~50 lines)
- `src/sdk-bridge/utils/url-filter.ts` (~120 lines)

**Verification:**
- ✅ Each utility has unit tests
- ✅ Build succeeds
- ✅ All utilities exported correctly

---

### Phase 4: Extract DOM Modules (3 hours)

**Tasks:**
1. Extract element state → `dom/element-state.ts`
2. Extract preview manager → `dom/preview-manager.ts`
3. Extract DOM applier → `dom/dom-applier.ts`
4. Add unit tests for each

**Files:**
- `src/sdk-bridge/dom/element-state.ts` (~90 lines)
- `src/sdk-bridge/dom/preview-manager.ts` (~230 lines)
- `src/sdk-bridge/dom/dom-applier.ts` (~230 lines)

**Verification:**
- ✅ Preview changes work
- ✅ State capture/restore works
- ✅ Manual DOM changes work

---

### Phase 5: Extract SDK Modules (3 hours)

**Tasks:**
1. Extract SDK detection → `sdk/detector.ts`
2. Extract interceptors → `sdk/interceptor.ts`
3. Extract plugin detection → `sdk/plugin-detector.ts`
4. Add unit tests

**Files:**
- `src/sdk-bridge/sdk/detector.ts` (~160 lines)
- `src/sdk-bridge/sdk/interceptor.ts` (~130 lines)
- `src/sdk-bridge/sdk/plugin-detector.ts` (~90 lines)

**Verification:**
- ✅ SDK detected correctly
- ✅ Event logging intercepted
- ✅ Plugin detection works

---

### Phase 6: Extract Experiment Modules (2 hours)

**Tasks:**
1. Extract code injector → `experiment/code-injector.ts`
2. Extract override manager → `experiment/override-manager.ts`
3. Add unit tests

**Files:**
- `src/sdk-bridge/experiment/code-injector.ts` (~150 lines)
- `src/sdk-bridge/experiment/override-manager.ts` (~50 lines)

**Verification:**
- ✅ Custom code injection works
- ✅ Override cookies parsed correctly

---

### Phase 7: Extract Core Orchestrator (2 hours)

**Tasks:**
1. Extract orchestration → `core/orchestrator.ts`
2. Wire up initialization flow
3. Add message listeners
4. Add unit tests

**Files:**
- `src/sdk-bridge/core/orchestrator.ts` (~320 lines)

**Verification:**
- ✅ Initialization flow works
- ✅ Message handling works
- ✅ Plugin initialization works

---

### Phase 8: Create Main Entry Point (2 hours)

**Tasks:**
1. Create `src/sdk-bridge/index.ts`
2. Export all public APIs
3. Set up global compatibility layer
4. Add auto-initialization
5. Add version info

**Files:**
- `src/sdk-bridge/index.ts` (~100 lines)

**Verification:**
- ✅ All APIs exported
- ✅ Global functions available
- ✅ Auto-initialization works

---

### Phase 9: Integration & Testing (3 hours)

**Tasks:**
1. Update `content.tsx` to load new bundle
2. Update manifest.json web_accessible_resources
3. Remove old inject-sdk-plugin.js reference
4. Run all 572 unit tests
5. Run all 26 E2E tests
6. Manual browser testing

**Verification:**
- ✅ All unit tests pass
- ✅ All E2E tests pass
- ✅ Extension works in browser
- ✅ No console errors
- ✅ All features work

---

### Phase 10: Cleanup & Documentation (1 hour)

**Tasks:**
1. Delete old `public/inject-sdk-plugin.js`
2. Update README.md
3. Add JSDoc to all public APIs
4. Create CHANGELOG entry
5. Commit changes

**Verification:**
- ✅ Old file removed
- ✅ Documentation updated
- ✅ Clean commit history

---

## Total Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Setup & Infrastructure | 2 hours | 2 hours |
| 2. Type Definitions | 1 hour | 3 hours |
| 3. Utility Modules | 2 hours | 5 hours |
| 4. DOM Modules | 3 hours | 8 hours |
| 5. SDK Modules | 3 hours | 11 hours |
| 6. Experiment Modules | 2 hours | 13 hours |
| 7. Core Orchestrator | 2 hours | 15 hours |
| 8. Main Entry Point | 2 hours | 17 hours |
| 9. Integration & Testing | 3 hours | 20 hours |
| 10. Cleanup & Documentation | 1 hour | 21 hours |

**Total: ~20-21 hours** (with comprehensive testing)

---

## File Size Comparison

### Current
- `inject-sdk-plugin.js`: 1834 lines, ~65KB

### After Refactoring (Source)
- Total TypeScript: ~1950 lines (split across 18 files)
- Average file size: ~108 lines
- Largest file: ~320 lines (orchestrator)
- Smallest file: ~40 lines (logger)

### After Bundling (Output)
- Development bundle: ~70KB (with source maps)
- Production bundle: ~35KB (minified)
- Gzipped: ~12KB

**50% size reduction in production!**

---

## Build Process Integration

### Development Build
```bash
# Watch mode - auto-rebuild on changes
npm run build:sdk-bridge:watch

# Or as part of dev
npm run dev  # builds SDK bridge, then starts Plasmo dev server
```

### Production Build
```bash
npm run build  # builds SDK bridge, then builds extension
```

### Manifest Updates
```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "absmartly-sdk-bridge.bundle.js",
        "absmartly-sdk-bridge.bundle.js.map"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## Testing Strategy

### Unit Tests (New)
Each module gets dedicated test file:
- `src/sdk-bridge/__tests__/utils/html-sanitizer.test.ts`
- `src/sdk-bridge/__tests__/utils/logger.test.ts`
- `src/sdk-bridge/__tests__/dom/preview-manager.test.ts`
- `src/sdk-bridge/__tests__/sdk/detector.test.ts`
- etc.

### Integration Tests
- Test module interactions
- Test initialization flow
- Test message passing between modules

### E2E Tests (Existing)
- All 26 E2E tests must pass unchanged
- No behavioral changes expected

### Manual Testing Checklist
- [ ] SDK detection works
- [ ] Preview changes apply/remove correctly
- [ ] Plugin detection works
- [ ] Event logging intercepted
- [ ] Custom code injection works
- [ ] Override cookies work
- [ ] Message passing works
- [ ] No console errors

---

## Security Considerations

### Maintained
- ✅ HTML sanitization (isolated in dedicated module)
- ✅ XSS protection via sanitizeHTML
- ✅ No code execution vulnerabilities
- ✅ Message origin validation

### Improved
- ✅ Can use DOMPurify npm package (bundled)
- ✅ Better type safety catches bugs
- ✅ Isolated modules easier to audit
- ✅ Source maps for security review

---

## Performance Benefits

### Bundle Size
- 50% smaller in production (65KB → 35KB)
- 81% smaller gzipped (65KB → 12KB)

### Load Time
- Single HTTP request vs potentially 14
- Minified code loads faster
- Tree shaking removes unused code

### Runtime Performance
- No change - same code logic
- Potential improvements from minification

---

## Developer Experience Benefits

### Type Safety
```typescript
// Before (no type safety)
function applyPreviewChange(change, experimentName) {
  if (!change.selector) { /* ... */ }
}

// After (full type safety)
function applyPreviewChange(change: DOMChange, experimentName: string): boolean {
  if (!change.selector) { /* ... */ }
}
```

### IDE Support
- Autocomplete for all APIs
- Go to definition
- Find all references
- Refactoring tools
- Error checking

### Better Testing
```typescript
// Easy to mock dependencies
import { SDKDetector } from '../sdk/detector'
jest.mock('../sdk/detector')

// Test with type safety
const mockContext: ABSmartlyContext = {
  treatment: jest.fn(),
  // ...
}
```

---

## Backward Compatibility

### Global API Maintained
All existing global functions remain:
- `window.__absmartlyExtensionInjected`
- `window.__absmartlyGetVariantAssignments()`
- `window.__absmartlyGetContextPath()`

### Message Format Unchanged
All message types and payloads remain identical

### No Breaking Changes
Extension continues to work exactly the same from user perspective

---

## Rollback Plan

### If Issues Arise
1. Revert commit with new bundle
2. Restore old `inject-sdk-plugin.js`
3. Update content.tsx to use old file
4. Rebuild and deploy

### Safety Measures
1. Keep old file until full migration verified
2. Comprehensive test coverage before deployment
3. Test in dev environment first
4. Gradual rollout if possible

---

## Success Metrics

### Code Quality
- ✅ Average module size < 150 lines
- ✅ All modules under 350 lines
- ✅ 100% TypeScript (type safe)
- ✅ 100% JSDoc coverage on public APIs

### Testing
- ✅ 100% of existing tests pass (572 + 26)
- ✅ New unit tests for each module (18+ tests)
- ✅ Integration tests for module interactions
- ✅ No behavioral regressions

### Performance
- ✅ 50% bundle size reduction
- ✅ No load time degradation
- ✅ No runtime performance regression
- ✅ Same or better memory usage

### Developer Experience
- ✅ Full IDE support (autocomplete, etc.)
- ✅ Easy to find code (clear structure)
- ✅ Easy to test (isolated modules)
- ✅ Easy to maintain (single responsibility)

---

## Risk Assessment

### Low Risk
- ✅ Proven pattern (visual editor uses same approach)
- ✅ No external dependencies (all bundled)
- ✅ Comprehensive testing plan
- ✅ Rollback plan ready

### Mitigation Strategies
1. **Build failures**: Keep old file as backup
2. **Runtime errors**: Extensive testing before deployment
3. **Performance issues**: Measure before/after
4. **Type errors**: Strict TypeScript from start

---

## Next Steps

### To Begin
1. **Review and approve this plan**
2. **Confirm build setup** (esbuild already installed for visual editor)
3. **Create feature branch**: `refactor/sdk-bridge-bundled`
4. **Start Phase 1**: Setup infrastructure

### Questions to Confirm
1. ✅ Use same esbuild config as visual editor?
2. ✅ Enable TypeScript strict mode?
3. ✅ Include source maps in production?
4. ✅ Run build automatically in dev mode?

---

## Conclusion

This refactoring will transform a monolithic 1834-line JavaScript file into a modern, well-structured TypeScript package with:

- ✅ **Better architecture**: 18 focused modules with clear responsibilities
- ✅ **Type safety**: Full TypeScript with interfaces and type checking
- ✅ **Better performance**: 50% smaller bundle, faster load times
- ✅ **Better DX**: Full IDE support, better testing, easier maintenance
- ✅ **No risk**: Proven pattern, backward compatible, comprehensive testing

**Ready to proceed with Phase 1?**
