// Debug script to test extension filter functionality
// Run this in the browser console when the extension popup is open

console.log('=== ABsmartly Extension Debug Script ===');

// 1. Check if the extension popup is loaded
const plasmoContainer = document.querySelector('#__plasmo');
console.log('Plasmo container found:', !!plasmoContainer);

// 2. Look for filter buttons in the DOM
const filterButtons = document.querySelectorAll('button');
console.log('Total buttons found:', filterButtons.length);

// 3. Look specifically for experiment state filter buttons
const stateButtons = Array.from(filterButtons).filter(btn => 
  btn.textContent && ['Draft', 'Ready', 'Running', 'Development'].includes(btn.textContent.trim())
);
console.log('State filter buttons found:', stateButtons.length);
stateButtons.forEach((btn, i) => {
  console.log(`Button ${i}: "${btn.textContent}" - clickable: ${!btn.disabled}`);
});

// 4. Look for the filter toggle button (funnel icon)
const funnelButton = Array.from(filterButtons).find(btn => 
  btn.getAttribute('aria-label') === 'Toggle filters' ||
  btn.title === 'Toggle filters' ||
  btn.querySelector('svg') // Look for SVG (likely the funnel icon)
);
console.log('Funnel toggle button found:', !!funnelButton);

// 5. Check if filters are expanded
const filterPanel = document.querySelector('[class*="border-t"]') || 
                   document.querySelector('[class*="space-y-3"]');
console.log('Filter panel visible:', !!filterPanel);

// 6. Test clicking the funnel button if found
if (funnelButton) {
  console.log('Attempting to click funnel button...');
  funnelButton.click();
  
  setTimeout(() => {
    const expandedButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent && ['Draft', 'Ready', 'Running', 'Development'].includes(btn.textContent.trim())
    );
    console.log('State buttons after expansion:', expandedButtons.length);
    
    // Try clicking a filter button
    if (expandedButtons.length > 0) {
      console.log('Attempting to click Draft filter...');
      expandedButtons.find(btn => btn.textContent.trim() === 'Draft')?.click();
    }
  }, 100);
}

// 7. Check console for React errors
console.log('Check browser console for any React errors or warnings');

// 8. Log current URL to confirm we're in the right context
console.log('Current URL:', window.location.href);
console.log('Is extension popup:', window.location.href.includes('chrome-extension://'));