# Filter Debug Report

## Issue Analysis

Based on the code examination, there are several potential issues with the filter functionality:

### 1. Alert in toggleArrayFilter (Line 98)
There's a debugging alert that should trigger when filters are clicked:
```typescript
const toggleArrayFilter = (key: keyof FilterState, value: any) => {
  console.log('toggleArrayFilter called:', key, value)
  alert(`Filter clicked: ${key} = ${value}`)  // Test if click works
  // ... rest of function
}
```

If this alert is not showing when you click filters, it means:
- The click handler is not being attached properly
- The click event is being prevented somewhere
- The button element is not receiving the click event

### 2. Filter State Management
The component manages filters independently and calls `onFilterChange` when they update. The flow is:
1. User clicks filter button → `toggleArrayFilter` called
2. `toggleArrayFilter` calls `updateFilter` with new value
3. `updateFilter` updates state and calls `onFilterChange`
4. Parent component (`popup.tsx`) receives the change via `handleFilterChange`
5. Parent triggers API call with new filters

### 3. Potential Issues

#### A. Event Handler Binding
The buttons use inline `onClick` handlers:
```typescript
<button
  key={state.value}
  onClick={() => toggleArrayFilter('state', state.value)}
  className={...}
>
  {state.label}
</button>
```

#### B. CSS/Styling Issues
The buttons might be covered by other elements or have pointer-events disabled.

#### C. Filter Expansion State
Filters only show when `isExpanded` is true. The filter toggle button should expand the panel first.

## Testing Steps Needed

1. **Check if filter panel expands**: Click the funnel icon to expand filters
2. **Check for debug alert**: Click on any filter button (Draft, Ready, etc.) - should show alert
3. **Check browser console**: Look for console logs from `toggleArrayFilter` and `updateFilter`
4. **Check Network tab**: See if API calls are made when filters change
5. **Inspect DOM**: Verify click handlers are attached and buttons are clickable

## Expected Behavior

When clicking a filter button:
1. Alert should appear: "Filter clicked: state = created"
2. Console should log: "toggleArrayFilter called: state created"
3. Console should log: "updateFilter called: state [...]"
4. Console should log: "handleFilterChange called with: {...}"
5. API call should be made with new filter parameters
6. Experiment list should update

## Debug Commands for Browser Console

```javascript
// Check if filter functions are available
console.log(window.React);

// Check if buttons have click handlers
document.querySelectorAll('[data-filter-button]').forEach(btn => {
  console.log('Button:', btn, 'Handler:', btn.onclick);
});

// Force trigger a filter change
// (if React dev tools are available)
```