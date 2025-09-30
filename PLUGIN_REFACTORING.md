# Plugin Refactoring: Extension-Specific Features

## Overview

This document describes the refactoring of the DOM Changes Plugin architecture to better separate concerns between the core plugin functionality and browser extension-specific features.

## Motivation

Previously, the browser extension relied on `DOMChangesPlugin` (Full version) from the SDK plugin repository, which included both core DOM transformation logic and extension-specific features like state management, message bridge, and code injection.

**Problems with the old approach:**
- The SDK plugin repo contained extension-specific code that should only be in the browser extension
- The Full plugin (~78KB) was larger than necessary for production websites
- Tight coupling between core functionality and extension features
- Harder to maintain and test

## New Architecture

### SDK Plugin Repository (../absmartly-sdk-plugins/)

The SDK plugin repo now contains **only** `DOMChangesPluginLite`:
- Core DOM transformation logic
- Exposure tracking
- SPA support
- Lightweight (~42KB)
- Suitable for production websites

### Browser Extension (this project)

Extension-specific features are now implemented locally in `src/plugin-extensions/`:

#### 1. **StateManager** (`StateManager.ts`)
- Tracks original DOM element states before modifications
- Enables change reversion
- Stores applied changes for each experiment

#### 2. **MessageBridge** (`MessageBridge.ts`)
- Handles communication between plugin and browser extension
- Uses window.postMessage for cross-context messaging
- Supports preview changes, code injection, and experiment triggers

#### 3. **CodeInjector** (`CodeInjector.ts`)
- Dynamically injects scripts and styles into the page
- Supports injection at multiple locations (headStart, headEnd, bodyStart, bodyEnd)
- Executes inline scripts and loads external resources

#### 4. **ExtensionDOMPlugin** (`ExtensionDOMPlugin.ts`)
- Wraps `DOMChangesPluginLite` with extension-specific functionality
- Provides change reversion methods
- Integrates all extension components
- Maintains backward compatibility with existing code

## Implementation Details

### Plugin Loading Flow

1. **Load SDK Plugins (Lite version)**
   ```javascript
   // Loads: DOMChangesPluginLite, OverridesPluginLite
   const sdkScript = document.createElement('script');
   sdkScript.src = 'absmartly-sdk-plugins.dev.js';
   ```

2. **Load Extension Plugin**
   ```javascript
   // Loads: ExtensionDOMPlugin and supporting classes
   const extScript = document.createElement('script');
   extScript.src = 'absmartly-extension-plugin.dev.js';
   ```

3. **Initialize Plugins**
   ```javascript
   // Initialize base plugin (Lite)
   const baseDOMPlugin = new DOMChangesPluginLite(config);

   // Wrap with extension features
   const domPlugin = new ExtensionDOMPlugin(baseDOMPlugin, config);
   await domPlugin.initialize();
   ```

### Build Process

#### Bundling Extension Plugin
```bash
npm run bundle-plugin
```

This command:
- Bundles `src/plugin-extensions/browser-bundle.ts` using esbuild
- Generates `public/absmartly-extension-plugin.dev.js` (with source maps)
- Generates `public/absmartly-extension-plugin.min.js` (production)

#### Development Build
```bash
npm run dev
```

Automatically:
1. Builds the extension plugin (`bundle-plugin`)
2. Copies SDK plugins (Lite version) from `../absmartly-sdk-plugins/dist/`
3. Copies extension plugin bundles to build directory
4. Watches for changes and rebuilds

#### Production Build
```bash
npm run build
```

Same as dev build but optimized for production.

## File Structure

```
src/plugin-extensions/
├── StateManager.ts           # State tracking and reversion
├── MessageBridge.ts          # Extension communication
├── CodeInjector.ts           # Dynamic code injection
├── ExtensionDOMPlugin.ts     # Main wrapper class
├── browser-bundle.ts         # Bundle entry point
└── index.ts                  # Public exports

public/
├── inject-sdk-plugin.js      # Page injection script (updated)
├── absmartly-extension-plugin.dev.js       # Built extension plugin (dev)
├── absmartly-extension-plugin.dev.js.map   # Source map
└── absmartly-extension-plugin.min.js       # Built extension plugin (prod)

scripts/
├── bundle-extension-plugin.js  # Builds the extension plugin
├── dev-build.js               # Development build (updated)
└── post-build.js              # Production build (updated)
```

## API Compatibility

The `ExtensionDOMPlugin` maintains the same API as the old `DOMChangesPlugin`:

```javascript
// Apply changes
plugin.applyChange(change, experimentName);

// Remove changes
plugin.removeChanges(experimentName);

// Revert specific change
plugin.revertChange(element, experimentName);

// Get original state
const state = plugin.getOriginalState(element, experimentName);

// Get applied changes
const changes = plugin.getAppliedChanges(experimentName);

// Inject custom code
plugin.injectCode({
  headStart: '<style>...</style>',
  bodyEnd: '<script>...</script>'
});
```

## Benefits

### 1. **Better Separation of Concerns**
- Core plugin functionality stays in SDK repo
- Extension-specific features are in the extension project
- Clear ownership and responsibility

### 2. **Smaller Production Bundle**
- Production websites use Lite plugin (~42KB vs ~78KB)
- 45% smaller bundle size
- Faster loading times

### 3. **Easier Maintenance**
- Extension features can be modified without touching SDK repo
- SDK repo can focus on core functionality
- Clearer codebase organization

### 4. **Independent Testing**
- Can test extension features independently
- SDK plugin can be tested without extension dependencies
- Better isolation for unit tests

### 5. **Flexibility**
- Extension can add new features without SDK repo changes
- SDK repo remains stable and lightweight
- Can version extension features independently

## Migration Notes

### For Developers

No changes needed! The refactoring maintains backward compatibility:
- Same initialization process in `inject-sdk-plugin.js`
- Same API surface
- Same behavior

### For SDK Plugin Repo

The SDK plugin repo should:
1. Keep only `DOMChangesPluginLite` and related core functionality
2. Remove extension-specific code (StateManager, MessageBridge, etc.)
3. Export only Lite versions: `DOMChangesPluginLite`, `OverridesPluginLite`

## Testing

After refactoring, verify:

1. **Plugin Loading**
   - Check browser console for successful plugin loading messages
   - Verify both SDK plugins and extension plugin are loaded

2. **Change Application**
   - Apply DOM changes via the extension
   - Verify changes appear on the page

3. **Change Reversion**
   - Remove changes via the extension
   - Verify elements return to original state

4. **Code Injection**
   - Test custom code injection
   - Verify scripts execute and styles apply

5. **State Management**
   - Apply multiple changes
   - Verify state is tracked correctly
   - Test reversion of individual changes

## Troubleshooting

### Plugin Not Loading
- Check that `npm run bundle-plugin` succeeded
- Verify plugin files exist in build directory
- Check browser console for loading errors

### Changes Not Applying
- Verify `DOMChangesPluginLite` is loaded
- Check that `ExtensionDOMPlugin` wrapped correctly
- Enable debug mode to see detailed logs

### State Not Reverting
- Ensure `StateManager` is tracking changes
- Check that original states are being stored
- Verify element references are maintained

## Future Enhancements

Potential improvements to consider:

1. **Plugin Variants**
   - Create specialized versions for different use cases
   - Mobile-optimized plugin
   - A/B test-specific plugin

2. **Feature Flags**
   - Compose Full version from Lite + feature modules
   - Enable/disable features dynamically

3. **Enhanced Testing**
   - Mock Lite plugin for testing extension features
   - Unit tests for each component

4. **Performance Monitoring**
   - Track initialization time
   - Monitor memory usage
   - Measure reversion performance

## References

- SDK Plugin Repository: `../absmartly-sdk-plugins/`
- SDK Plugin Refactoring Doc: `../absmartly-sdk-plugins/docs/dom-plugin-refactoring.md`
- Browser Extension Docs: `./CLAUDE.md`
