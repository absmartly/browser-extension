const { chromium } = require('@playwright/test');
const path = require('path');

async function testExtensionAvatar() {
  // Path to the extension
  const extensionPath = path.join(__dirname, 'build', 'chrome-mv3-prod');
  
  console.log('Loading extension from:', extensionPath);
  
  // Launch browser with extension
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  // Wait for extension to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get extension ID by checking service workers
  const [worker] = browser.serviceWorkers();
  if (!worker) {
    console.error('No service worker found');
    await browser.close();
    return;
  }
  
  const extensionId = worker.url().split('/')[2];
  console.log('Extension ID:', extensionId);
  
  // Open extension popup
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  
  // Wait for popup to load
  await page.waitForLoadState('networkidle');
  console.log('Extension popup loaded');
  
  // Check if we need to click settings
  const settingsButton = page.locator('button:has-text("Settings")');
  if (await settingsButton.count() > 0) {
    console.log('Clicking Settings button');
    await settingsButton.click();
    await page.waitForSelector('text=ABSmartly Settings');
  }
  
  // Wait for authentication check to complete
  await page.waitForTimeout(3000);
  
  // Look for user avatar
  const avatarSelector = 'img[alt*="User"]';
  const avatarCount = await page.locator(avatarSelector).count();
  console.log('Avatar images found:', avatarCount);
  
  if (avatarCount > 0) {
    const avatar = page.locator(avatarSelector).first();
    
    // Get avatar src
    const src = await avatar.getAttribute('src');
    console.log('Avatar src:', src);
    
    // Check if src matches expected pattern
    const expectedPattern = /https:\/\/.*\/files\/avatars\/.*\/crop\/original\.png/;
    if (expectedPattern.test(src)) {
      console.log('✅ Avatar URL matches expected pattern');
    } else {
      console.log('❌ Avatar URL does not match expected pattern');
    }
    
    // Check if image is visible
    const isVisible = await avatar.isVisible();
    console.log('Avatar visible:', isVisible);
    
    // Get image dimensions
    const box = await avatar.boundingBox();
    if (box) {
      console.log('Avatar dimensions:', box.width, 'x', box.height);
    }
    
    // Check if image actually loaded
    const naturalSize = await avatar.evaluate(img => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete
    }));
    
    console.log('Image natural size:', naturalSize.naturalWidth, 'x', naturalSize.naturalHeight);
    console.log('Image load complete:', naturalSize.complete);
    
    if (naturalSize.naturalWidth > 0 && naturalSize.naturalHeight > 0) {
      console.log('✅ Avatar image successfully loaded');
    } else {
      console.log('❌ Avatar image failed to load');
    }
  } else {
    console.log('❌ No avatar image found');
    
    // Check debug info
    const debugButton = page.locator('summary:has-text("Debug info")');
    if (await debugButton.count() > 0) {
      await debugButton.click();
      const debugContent = await page.locator('pre').textContent();
      console.log('Debug info:', debugContent);
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: 'avatar-test-result.png', fullPage: true });
  console.log('Screenshot saved as avatar-test-result.png');
  
  // Keep browser open for inspection
  console.log('\nTest complete. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to exit.');
}

// Run the test
testExtensionAvatar().catch(console.error);