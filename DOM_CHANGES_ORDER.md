# DOM Changes Order Documentation

## Overview
The ABSmartly Browser Extension now supports specifying the order in which DOM changes are applied within a variant. This is crucial because the order of changes can affect the final result, especially when changes interact with or depend on each other.

## How Order Works

### 1. Changes are Applied Sequentially
DOM changes within a variant are applied in the order they appear in the array. The first change in the array is applied first, the second is applied second, and so on.

### 2. Order Matters for Dependent Changes
Some examples where order is critical:
- **Style changes after class changes**: If you add a class and then override specific styles
- **Move operations before style changes**: Moving an element should happen before styling it
- **Text changes after HTML changes**: Setting text content after modifying HTML structure

### 3. Reordering in the UI
Users can now drag and drop DOM changes within the same variant to reorder them. The visual editor displays a number badge (1, 2, 3...) indicating the order of application.

## Implementation for SDK Plugin

### Data Structure
DOM changes should be stored and transmitted as an ordered array:

```javascript
{
  "__dom_changes": [
    {
      "selector": ".button",
      "type": "class",
      "add": ["primary-btn"],
      "enabled": true
    },
    {
      "selector": ".button",
      "type": "style",
      "value": {
        "padding": "10px 20px"
      },
      "enabled": true
    }
  ]
}
```

### Applying Changes in Order
When processing DOM changes, always maintain the array order:

```javascript
function applyDOMChanges(changes) {
  // Apply changes in the order they appear in the array
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change.enabled !== false) {
      applyChange(change);
    }
  }
}
```

### Important Considerations

1. **Preserve Order on Save**: When saving changes, maintain the array order
2. **Respect User Reordering**: When users reorder changes in the UI, update the array accordingly
3. **Handle Disabled Changes**: Skip disabled changes but maintain their position in the array
4. **Mode Field**: New "mode" field supports "merge" (default) or "replace" for styles/attributes/classes

### Example: Order-Dependent Changes

```javascript
// Example where order matters:
[
  // 1. First, hide the original element
  {
    "selector": ".old-banner",
    "type": "style",
    "value": { "display": "none" }
  },
  // 2. Then, insert new content
  {
    "selector": ".container",
    "type": "insert",
    "html": "<div class='new-banner'>New Content</div>",
    "position": "firstChild"
  },
  // 3. Finally, style the new content
  {
    "selector": ".new-banner",
    "type": "style",
    "value": { "background": "blue", "color": "white" }
  }
]
```

## Browser Extension Features

### Visual Order Indicators
- Each DOM change displays a number badge (1, 2, 3...) showing its position
- Disabled changes show a muted badge

### Drag and Drop Reordering
- Users can drag changes to reorder them within the same variant
- Visual feedback shows where the change will be dropped
- The order immediately updates after dropping

### Copy Between Variants
- Changes can still be copied to other variants
- When copied, they're added to the end of the target variant's changes

## Unsupported Change Types

**Note**: The current SDK plugin (v1.0.0) does not support the following change types:
- `remove`: For removing elements from the DOM
- `insert`: For inserting new elements

These types are defined in the extension but require SDK plugin updates to function properly.

## Best Practices

1. **Test Order Dependencies**: Always test that your changes work correctly in the specified order
2. **Document Complex Orders**: If order is critical for certain changes, add comments or notes
3. **Group Related Changes**: Keep related changes together in the order
4. **Consider Performance**: Apply less expensive changes first when possible
5. **Handle Missing Elements**: Ensure your selectors are resilient to elements that might not exist yet

## Migration Notes

For existing implementations:
- DOM changes without explicit ordering will maintain their current array order
- The extension is backward compatible with unordered change arrays
- Users can reorder changes at any time through the UI