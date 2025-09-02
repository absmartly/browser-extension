# DOM Changes Selector Troubleshooting

## Issue: "No elements found for selector"

When you see the error `[ABsmartly] No elements found for selector: [your-selector]`, it means the CSS selector doesn't match any elements on the current page.

## Common Causes and Solutions

### 1. Wrong Page
**Problem**: You're testing on a different page than where the elements exist.
**Solution**: Navigate to the correct page where the experiment elements are located.

### 2. Incorrect Selector Format

#### Pseudo-class Issue
**Problem**: Using `.hover` as a class instead of `:hover` pseudo-class
- Wrong: `a.framer-F46SA.framer-4yns67.framer-v-4yns67.hover`
- Correct: `a.framer-F46SA.framer-4yns67.framer-v-4yns67:hover`

**Note**: CSS pseudo-classes like `:hover`, `:active`, `:focus` cannot be used directly in DOM manipulation. You need to either:
1. Remove the pseudo-class from the selector
2. Apply changes that will be visible on hover through CSS styles

#### Example Fix for Hover States
Instead of trying to select `:hover` elements, add styles that apply on hover:

```javascript
// Instead of this (won't work):
{
  selector: "a.button:hover",
  type: "style",
  value: { color: "red" }
}

// Do this:
{
  selector: "a.button",
  type: "style",
  value: { 
    // This creates a CSS rule that applies on hover
    "--hover-color": "red"
  }
}
// And add CSS:
{
  selector: "head",
  type: "create",
  element: "<style>a.button:hover { color: var(--hover-color) !important; }</style>",
  targetSelector: "head"
}
```

### 3. Dynamic Content
**Problem**: Elements are loaded dynamically after page load
**Solution**: 
- Wait for elements to load
- Use the Visual Editor to pick elements after they're loaded
- Enable SPA mode in the SDK plugin (already enabled)

### 4. Selector Specificity
**Problem**: Overly specific selectors that break easily
- Bad: `a.framer-F46SA.framer-4yns67.framer-v-4yns67`
- Good: `a.button-primary` or `[data-testid="round-button"]`

**Solution**: Use more general, stable selectors:
- IDs: `#my-button`
- Data attributes: `[data-testid="..."]`
- Semantic selectors: `button.primary`, `nav a`

## How to Find the Right Selector

### Using the Element Picker
1. Click the "Pick element" button in the DOM Changes editor
2. Click on the element you want to modify on the page
3. The picker will generate a selector for you

### Using Browser DevTools
1. Right-click the element on the page
2. Select "Inspect" or "Inspect Element"
3. In DevTools, right-click the element in the HTML
4. Select "Copy" > "Copy selector"

### Testing Your Selector
Before saving, test your selector in the browser console:
```javascript
document.querySelectorAll('your-selector-here')
```
This should return the elements you want to modify.

## Best Practices

1. **Keep selectors simple**: Use the minimum specificity needed
2. **Avoid generated classes**: Classes like `framer-F46SA` are often auto-generated and may change
3. **Use semantic HTML**: Target `<button>`, `<nav>`, `<header>` when possible
4. **Add data attributes**: Ask developers to add `data-testid` attributes for testing
5. **Test on the actual page**: Always test selectors on the page where they'll be used

## Debugging in Console

To see what the plugin is trying to do:
```javascript
// Check if elements exist
document.querySelectorAll('your-selector')

// See what changes would be applied
const elements = document.querySelectorAll('your-selector')
elements.forEach(el => console.log(el))

// Check if plugin is loaded
window.__absmartlyExtensionPlugin
```