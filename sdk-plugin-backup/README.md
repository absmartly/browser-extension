# ABSmartly DOM Changes Plugin

A plugin for the ABSmartly JavaScript SDK that enables dynamic DOM manipulation based on experiment variants. This plugin automatically applies visual changes to your website without requiring code modifications.

## Features

- 🎯 **Automatic DOM Changes**: Apply text, HTML, style, attribute, and class changes based on experiment variants
- ⏱️ **Dynamic Content Support**: Wait for elements that load after initial page render
- 🔄 **SPA Support**: MutationObserver integration for Single Page Applications
- 🎨 **Multiple Change Types**: Support for text, HTML, CSS, attributes, classes, and custom JavaScript
- 🛡️ **Error Handling**: Graceful error handling with detailed logging
- 📊 **Priority System**: Apply changes in specific order with priority settings

## Installation

```bash
npm install @absmartly/dom-changes-plugin
```

## Quick Start

```javascript
import { SDK } from '@absmartly/javascript-sdk';
import { createDOMChangesPlugin } from '@absmartly/dom-changes-plugin';

// Initialize ABSmartly SDK
const sdk = new SDK({
  endpoint: 'https://your-endpoint.absmartly.com',
  apiKey: 'your-api-key',
  environment: 'production',
  application: 'website'
});

// Create context
const context = sdk.createContext({
  units: { userId: 'user-123' }
});

// Initialize DOM Changes plugin
const domPlugin = await createDOMChangesPlugin(context, {
  debug: true,
  observeDynamicContent: true
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `variableName` | string | `'dom_changes'` | Variable name containing DOM changes in experiment |
| `debug` | boolean | `false` | Enable debug logging |
| `maxWaitTime` | number | `10000` | Maximum time (ms) to wait for elements |
| `checkInterval` | number | `100` | Interval (ms) for checking element presence |
| `observeDynamicContent` | boolean | `true` | Enable MutationObserver for dynamic content |

## DOM Change Instructions

Store DOM changes as JSON in your ABSmartly experiment variant variables:

```json
[
  {
    "selector": ".hero-title",
    "action": "text",
    "value": "New Hero Title"
  },
  {
    "selector": ".cta-button",
    "action": "style",
    "css": {
      "background-color": "#ff6b6b",
      "font-size": "18px"
    }
  },
  {
    "selector": ".feature",
    "action": "class",
    "className": "highlighted",
    "value": "add"
  }
]
```

## Supported Actions

### Text Content
Change the text content of an element:
```json
{
  "selector": ".title",
  "action": "text",
  "value": "New Text Content"
}
```

### HTML Content
Change the inner HTML of an element:
```json
{
  "selector": ".content",
  "action": "html",
  "value": "<strong>Bold</strong> content"
}
```

### Styles
Apply CSS styles to an element:
```json
{
  "selector": ".button",
  "action": "style",
  "css": {
    "background-color": "blue",
    "color": "white",
    "padding": "10px 20px"
  }
}
```

### Attributes
Set attributes on an element:
```json
{
  "selector": "img.logo",
  "action": "attribute",
  "attribute": "src",
  "value": "/new-logo.png"
}
```

### Classes
Add, remove, or toggle CSS classes:
```json
{
  "selector": ".card",
  "action": "class",
  "className": "featured",
  "value": "add" // "add", "remove", or "toggle"
}
```

### JavaScript
Execute custom JavaScript with the element in scope:
```json
{
  "selector": ".tracking-button",
  "action": "javascript",
  "script": "element.addEventListener('click', () => { console.log('Clicked!'); });"
}
```

## Advanced Features

### Priority
Apply changes in specific order:
```json
[
  {
    "selector": ".element",
    "action": "style",
    "css": { "color": "red" },
    "priority": 10
  },
  {
    "selector": ".element",
    "action": "text",
    "value": "High Priority",
    "priority": 100
  }
]
```

### Wait for Elements
Wait for elements that load dynamically:
```json
{
  "selector": ".lazy-loaded",
  "action": "text",
  "value": "Found!",
  "waitForElement": true
}
```

### Apply Once
Prevent reapplication of changes:
```json
{
  "selector": ".one-time-change",
  "action": "javascript",
  "script": "console.log('Only runs once');",
  "applyOnce": true
}
```

## SPA Support

The plugin automatically handles Single Page Applications by:
- Using MutationObserver to detect DOM changes
- Reapplying changes when elements are re-rendered
- Tracking which changes have been applied
- Waiting for dynamically loaded elements

## Cleanup

Always destroy the plugin when it's no longer needed:

```javascript
// On page unload
window.addEventListener('beforeunload', () => {
  domPlugin.destroy();
});

// Or manually
domPlugin.destroy();
```

## Example: A/B Test Setup

1. Create an experiment in ABSmartly
2. Add DOM changes to variant variables:

**Control (Variant 0):**
```json
[]
```

**Variant 1:**
```json
[
  {
    "selector": ".hero-title",
    "action": "text",
    "value": "Discover Amazing Products"
  },
  {
    "selector": ".cta-button",
    "action": "style",
    "css": {
      "background-color": "#28a745",
      "font-size": "20px"
    }
  }
]
```

3. The plugin automatically applies changes based on user's assigned variant

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported

## License

MIT