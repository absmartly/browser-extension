import { chromium } from './node_modules/.pnpm/playwright@1.54.1/node_modules/playwright/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAvatarDisplay() {
  console.log('Starting avatar display test...\n');
  
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
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get extension ID
  const backgroundPages = browser.backgroundPages();
  const backgroundPage = backgroundPages.length > 0 ? backgroundPages[0] : browser.serviceWorkers()[0];
  
  if (!backgroundPage) {
    console.error('❌ No background page or service worker found');
    await browser.close();
    return false;
  }
  
  const extensionId = backgroundPage.url().split('/')[2];
  console.log('✅ Extension ID:', extensionId);
  
  // Open extension popup
  const page = await browser.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log('Opening popup:', popupUrl);
  await page.goto(popupUrl);
  
  // Wait for popup to load
  await page.waitForLoadState('networkidle');
  console.log('✅ Extension popup loaded');
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-1-popup-initial.png' });
  
  // Click settings button
  try {
    console.log('Looking for Settings button...');
    await page.click('button:has-text("Settings")', { timeout: 5000 });
    console.log('✅ Clicked Settings button');
  } catch (e) {
    console.log('❌ Settings button not found, might already be in settings');
  }
  
  // Wait for settings page
  await page.waitForSelector('text=ABSmartly Settings', { timeout: 10000 });
  console.log('✅ Settings page loaded');
  
  // Wait for auth check to complete
  console.log('Waiting for authentication check...');
  await page.waitForTimeout(5000);
  
  // Take screenshot of settings
  await page.screenshot({ path: 'test-2-settings-page.png' });
  
  // Check for avatar
  console.log('\n--- AVATAR CHECK ---');
  const avatarCount = await page.locator('img[alt*="User"]').count();
  console.log(`Avatar elements found: ${avatarCount}`);
  
  if (avatarCount === 0) {
    console.log('❌ No avatar image found!');
    
    // Check authentication status
    const authText = await page.locator('text=Authentication Status').locator('..').textContent();
    console.log('Authentication section:', authText);
    
    // Check debug info
    try {
      const debugButton = page.locator('summary:has-text("Debug info")');
      if (await debugButton.count() > 0) {
        await debugButton.click();
        await page.waitForTimeout(500);
        const debugContent = await page.locator('pre').textContent();
        console.log('\nDebug info:', debugContent);
      }
    } catch (e) {
      console.log('No debug info available');
    }
    
    await page.screenshot({ path: 'test-3-no-avatar-found.png' });
    await browser.close();
    return false;
  }
  
  // Avatar found - check if it loaded
  const avatar = page.locator('img[alt*="User"]').first();
  
  // Get avatar properties
  const src = await avatar.getAttribute('src');
  console.log('✅ Avatar src:', src ? src.substring(0, 100) + '...' : 'none');
  
  // Check if visible
  const isVisible = await avatar.isVisible();
  console.log(`✅ Avatar visible: ${isVisible}`);
  
  // Check dimensions and load state
  const imageState = await avatar.evaluate(img => ({
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    width: img.width,
    height: img.height,
    complete: img.complete,
    src: img.src,
    currentSrc: img.currentSrc
  }));
  
  console.log('\n--- IMAGE STATE ---');
  console.log('Natural dimensions:', imageState.naturalWidth, 'x', imageState.naturalHeight);
  console.log('Display dimensions:', imageState.width, 'x', imageState.height);
  console.log('Load complete:', imageState.complete);
  console.log('Is data URL:', imageState.src.startsWith('data:'));
  
  // Success criteria
  const success = imageState.naturalWidth > 0 && 
                 imageState.naturalHeight > 0 && 
                 imageState.complete &&
                 isVisible;
  
  if (success) {
    console.log('\n✅ AVATAR TEST PASSED! Image is loaded and visible.');
  } else {
    console.log('\n❌ AVATAR TEST FAILED! Image did not load properly.');
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'test-4-final-result.png', fullPage: true });
  
  // Close browser
  await browser.close();
  
  return success;
}

// Run the test
testAvatarDisplay()
  .then(success => {
    console.log('\n=== TEST COMPLETE ===');
    if (success) {
      console.log('✅ Avatar is displaying correctly!');
      process.exit(0);
    } else {
      console.log('❌ Avatar is NOT displaying!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });