const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Path to the extension
  const extensionPath = path.join(__dirname, 'build', 'chrome-mv3-prod');
  
  // Launch browser with extension
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  // Wait a bit for extension to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get the extension ID
  const extensionPage = await browser.newPage();
  await extensionPage.goto('chrome://extensions/');
  
  // Get all pages including extension popup
  const pages = browser.pages();
  console.log('Total pages:', pages.length);
  
  // Find the extension popup page
  let popupPage;
  for (const page of pages) {
    const url = page.url();
    console.log('Page URL:', url);
    if (url.includes('chrome-extension://') && url.includes('popup.html')) {
      popupPage = page;
      break;
    }
  }
  
  if (!popupPage) {
    // Open the extension popup manually
    const [background] = browser.serviceWorkers();
    const extensionId = background.url().split('/')[2];
    console.log('Extension ID:', extensionId);
    
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  }
  
  // Wait for the page to load
  await popupPage.waitForLoadState('networkidle');
  
  // Click on settings if needed
  try {
    await popupPage.click('button:has-text("Settings")', { timeout: 5000 });
  } catch (e) {
    console.log('Settings button not found or already in settings');
  }
  
  // Wait for settings to load
  await popupPage.waitForSelector('text=ABSmartly Settings', { timeout: 10000 });
  
  // Check authentication status
  const authSection = await popupPage.locator('text=Authentication Status').locator('..').textContent();
  console.log('Auth section content:', authSection);
  
  // Check if user image exists
  const userImage = await popupPage.locator('img[alt*="User"]').count();
  console.log('User images found:', userImage);
  
  if (userImage > 0) {
    const imgSrc = await popupPage.locator('img[alt*="User"]').first().getAttribute('src');
    console.log('Image src:', imgSrc);
    
    // Check if image loads
    const imgElement = await popupPage.locator('img[alt*="User"]').first();
    const isVisible = await imgElement.isVisible();
    console.log('Image visible:', isVisible);
    
    // Check image natural dimensions
    const dimensions = await imgElement.evaluate(img => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: img.width,
      height: img.height
    }));
    console.log('Image dimensions:', dimensions);
  }
  
  // Check debug info if available
  try {
    const debugSummary = await popupPage.locator('summary:has-text("Debug info")');
    if (await debugSummary.count() > 0) {
      await debugSummary.click();
      const debugContent = await popupPage.locator('pre').textContent();
      console.log('Debug content:', debugContent);
    }
  } catch (e) {
    console.log('No debug info found');
  }
  
  // Take a screenshot
  await popupPage.screenshot({ path: 'extension-settings.png' });
  console.log('Screenshot saved as extension-settings.png');
  
  // Keep browser open for manual inspection
  console.log('Browser will stay open for inspection. Press Ctrl+C to exit.');
})();