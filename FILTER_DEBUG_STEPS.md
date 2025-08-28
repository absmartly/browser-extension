# ABsmartly Extension Filter Debug Steps

## 🚨 IMPORTANT: Extension has been rebuilt with enhanced debugging

The extension now includes comprehensive logging to identify the exact issue with filter clicks.

## Manual Testing Steps

### 1. Load/Reload Extension
```bash
# If using the dev build directory:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --load-extension=/Users/joalves/git_tree/absmartly-browser-extension/build/chrome-mv3-prod

# OR reload in chrome://extensions/ if already loaded
```

### 2. Open Browser DevTools FIRST
1. Open Chrome DevTools (F12)
2. Go to the **Console** tab
3. Make sure "All levels" are enabled (info, warnings, errors)
4. Clear the console

### 3. Open Extension Popup
1. Click the ABsmartly extension icon in the toolbar
2. Watch the console for initialization logs

### 4. Test Filter Toggle Button
1. **Look for the funnel icon** (🔽) next to the search box
2. **Click the funnel icon**
3. **Expected outcome:** 
   - Console should log: `🟢 Funnel button clicked, expanded: false`
   - Filter panel should expand below
   - If nothing happens, the toggle button isn't working

### 5. Test State Filter Buttons
**If filters expanded successfully:**
1. Look for filter buttons: "Draft", "Ready", "Running", etc.
2. Click on any filter button (e.g., "Draft")
3. **Expected outcome:**
   - Console should log: `🟡 Mouse down: created`
   - Console should log: `🟡 Button clicked directly: created`
   - Console should log: `🔵 toggleArrayFilter called: state created`
   - Alert popup should appear: `🎯 Filter clicked: state = created`
   - API call should be made

### 6. Common Issues to Check

#### Issue A: Funnel Button Not Working
**Symptoms:** No console log when clicking funnel icon
**Possible causes:**
- CSS z-index issues
- Event handler not attached
- Extension not properly loaded

**Debug:**
```javascript
// In browser console:
document.querySelector('[data-testid="filter-toggle"]')?.click()
```

#### Issue B: Filter Buttons Not Clickable
**Symptoms:** Funnel expands but filter buttons don't respond
**Possible causes:**
- CSS pointer-events disabled
- React event handlers not attached
- JavaScript errors preventing execution

**Debug:**
```javascript
// In browser console:
document.querySelectorAll('[data-filter-button="true"]').forEach(btn => {
  console.log('Button:', btn.dataset.filterValue, 'Clickable:', !btn.disabled);
  console.log('Has onclick:', !!btn.onclick);
});
```

#### Issue C: No API Calls Made
**Symptoms:** Alerts work but no network activity
**Possible causes:**
- Parent component not receiving filter changes
- API configuration issues
- Authentication errors

### 7. Network Tab Testing
1. Open DevTools **Network** tab
2. Filter by "Fetch/XHR"
3. Click a filter button
4. Look for API calls to ABsmartly endpoints

### 8. React DevTools (if available)
1. Install React Developer Tools extension
2. Open React tab in DevTools
3. Find `ExperimentFilter` component
4. Check props and state

## Debug Commands

### Force Test Filter Functionality
```javascript
// Paste in browser console:
console.log('=== ABsmartly Filter Debug ===');

// Test funnel button
const funnelBtn = document.querySelector('[data-testid="filter-toggle"]');
console.log('Funnel button found:', !!funnelBtn);
if (funnelBtn) funnelBtn.click();

setTimeout(() => {
  // Test filter buttons
  const filterBtns = document.querySelectorAll('[data-filter-button="true"]');
  console.log('Filter buttons found:', filterBtns.length);
  
  filterBtns.forEach((btn, i) => {
    console.log(`Button ${i}: ${btn.dataset.filterValue} - enabled: ${!btn.disabled}`);
  });
  
  // Try clicking first filter
  if (filterBtns.length > 0) {
    console.log('Clicking first filter button...');
    filterBtns[0].click();
  }
}, 500);
```

## Expected Normal Flow

1. **Extension loads** → Console logs from useEffect
2. **Funnel clicked** → `🟢 Funnel button clicked` 
3. **Filters expand** → Filter buttons become visible
4. **Filter clicked** → `🟡 Button clicked directly` → `🔵 toggleArrayFilter called` → Alert
5. **API call made** → Network activity in DevTools
6. **Experiments updated** → List refreshes

## Report Back

Please test and report:
1. Which step fails first?
2. What console logs do you see?
3. Do any alerts appear?
4. Any JavaScript errors in console?
5. Screenshot of the extension popup (expanded filters)

## Quick Fix Attempts

If buttons don't work, try:
```javascript
// Force re-attach event listeners
document.querySelectorAll('[data-filter-button="true"]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    alert('Manual click handler: ' + btn.dataset.filterValue);
  });
});
```