const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🚀 Starting extension test...');
  
  // Path to the extension
  const extensionPath = path.join(__dirname, 'build', 'chrome-mv3-prod');
  
  // Launch Chrome with the extension
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ],
    viewport: { width: 1280, height: 720 },
    devtools: true  // Open DevTools automatically
  });

  console.log('✅ Browser launched with extension');
  
  // Wait for browser to fully load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get the page
  const page = await browser.newPage();
  
  // Go to extensions page to get the extension ID
  await page.goto('chrome://extensions/');
  await page.waitForTimeout(2000);
  
  console.log('📦 Extension loaded. You need to:');
  console.log('1. Find the extension ID from chrome://extensions/');
  console.log('2. Update the extensionId variable in this script');
  console.log('3. Run the script again');
  
  // For now, let's try to interact with the extension through the toolbar
  // This is a limitation - we need the extension ID to open the popup directly
  
  console.log('\n👀 Browser will stay open. Manually click the extension icon to test.');
  console.log('Press Ctrl+C to close.');
  
  // Set up console listener for any page
  browser.on('page', async (newPage) => {
    console.log('New page opened:', newPage.url());
    
    newPage.on('console', msg => {
      console.log('PAGE CONSOLE:', msg.text());
    });
    
    newPage.on('dialog', async dialog => {
      console.log('🚨 ALERT:', dialog.message());
      await dialog.accept();
    });
    
    // If it's a popup page, try to test it
    if (newPage.url().includes('popup.html')) {
      console.log('🎯 Popup detected! Running tests...');
      await testPopup(newPage);
    }
  });
  
  // Keep the script running
  await new Promise(() => {});
})();

async function testPopup(popupPage) {
  await popupPage.waitForTimeout(2000);
  
  // Test 1: Check if search input exists
  const searchInput = await popupPage.$('input[placeholder="Search experiments..."]');
  if (searchInput) {
    console.log('✅ Search input found');
  } else {
    console.log('❌ Search input not found');
  }
  
  // Test 2: Click the funnel button
  console.log('🔽 Looking for funnel button...');
  let funnelButton = await popupPage.$('[data-testid="filter-toggle"]');
  
  if (!funnelButton) {
    // Try alternative selectors
    funnelButton = await popupPage.$('button[aria-label="Toggle filters"]');
  }
  
  if (funnelButton) {
    console.log('✅ Funnel button found, clicking...');
    await funnelButton.click();
    await popupPage.waitForTimeout(500);
    
    // Check if filters expanded
    const filterPanel = await popupPage.$('text="Experiment State"');
    if (filterPanel) {
      console.log('✅ Filter panel expanded');
      
      // Test 3: Try clicking a filter button
      console.log('🎯 Looking for Draft filter...');
      const draftButton = await popupPage.$('button:has-text("Draft")');
      if (draftButton) {
        console.log('✅ Draft button found, clicking...');
        await draftButton.click();
        await popupPage.waitForTimeout(1000);
        
        // Check if the button changed state
        const isDraftSelected = await draftButton.evaluate(el => 
          el.className.includes('bg-blue-100')
        );
        console.log('Draft selected state:', isDraftSelected);
      } else {
        console.log('❌ Draft button not found');
      }
    } else {
      console.log('❌ Filter panel did not expand');
    }
  } else {
    console.log('❌ Funnel button not found');
  }
  
  // Take a screenshot
  await popupPage.screenshot({ path: 'popup-test.png', fullPage: true });
  console.log('📸 Screenshot saved as popup-test.png');
}
