// Manual test script to verify the experiment variables bug is fixed
// Run this with: node tests/manual-test-variables-bug.js

const puppeteer = require('puppeteer');

async function testExperimentVariablesPersistence() {
  console.log('🧪 Testing Experiment Variables Persistence Bug Fix...\n');

  // Launch browser with extension loaded
  const browser = await puppeteer.launch({
    headless: false, // Show browser for manual verification
    args: [
      `--disable-extensions-except=${__dirname}/../`,
      `--load-extension=${__dirname}/../`
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Wait a bit for extension to initialize
    await page.waitForTimeout(2000);
    
    // Get extension ID (this is a simplified approach)
    const targets = await browser.targets();
    const extensionTarget = targets.find(target => target.url().includes('chrome-extension://'));
    
    if (!extensionTarget) {
      throw new Error('Extension not found. Make sure to build it first with: npm run build');
    }
    
    const extensionId = extensionTarget.url().split('//')[1].split('/')[0];
    console.log(`✅ Extension loaded with ID: ${extensionId}`);
    
    // Navigate to extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    console.log('✅ Opened extension popup');
    
    // Wait for initial load
    await page.waitForTimeout(3000);
    
    // Take screenshot of experiments list
    await page.screenshot({ path: 'tests/screenshots/01-experiments-list.png' });
    console.log('📸 Screenshot: experiments list');
    
    // Click on the first experiment
    const experimentExists = await page.evaluate(() => {
      const experiments = document.querySelectorAll('.cursor-pointer');
      if (experiments.length > 0) {
        experiments[0].click();
        return true;
      }
      return false;
    });
    
    if (!experimentExists) {
      console.log('⚠️  No experiments found in the list. Please ensure you have experiments loaded.');
      return;
    }
    
    console.log('✅ Clicked on first experiment');
    
    // Wait for detail view to load
    await page.waitForTimeout(2000);
    
    // Check if variants section is visible
    const variantsVisible = await page.evaluate(() => {
      const variantsHeader = Array.from(document.querySelectorAll('h3')).find(
        el => el.textContent.includes('Variants')
      );
      return !!variantsHeader;
    });
    
    console.log(`✅ Variants section visible: ${variantsVisible}`);
    
    // Check if variables are visible
    const variablesInfo = await page.evaluate(() => {
      const variableHeaders = Array.from(document.querySelectorAll('h5')).filter(
        el => el.textContent.includes('Variables')
      );
      const variableInputs = document.querySelectorAll('input[type="text"]');
      
      return {
        headersCount: variableHeaders.length,
        inputsCount: variableInputs.length,
        firstInputValue: variableInputs[0]?.value || 'none'
      };
    });
    
    console.log(`✅ Variables sections found: ${variablesInfo.headersCount}`);
    console.log(`✅ Variable inputs found: ${variablesInfo.inputsCount}`);
    console.log(`✅ First variable value: ${variablesInfo.firstInputValue}`);
    
    // Take screenshot of experiment detail
    await page.screenshot({ path: 'tests/screenshots/02-experiment-detail-initial.png' });
    console.log('📸 Screenshot: experiment detail initial view');
    
    // Wait to ensure no flickering
    console.log('⏱️  Waiting 3 seconds to check for flickering...');
    await page.waitForTimeout(3000);
    
    // Check if variables are STILL visible (this is the bug we're testing)
    const variablesStillVisible = await page.evaluate(() => {
      const variableHeaders = Array.from(document.querySelectorAll('h5')).filter(
        el => el.textContent.includes('Variables')
      );
      return variableHeaders.length > 0;
    });
    
    if (variablesStillVisible) {
      console.log('✅ SUCCESS: Variables are still visible after waiting!');
      console.log('🎉 Bug is FIXED - variables no longer disappear!');
    } else {
      console.log('❌ FAILURE: Variables disappeared!');
      console.log('🐛 Bug is NOT fixed - variables are disappearing');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/03-experiment-detail-after-wait.png' });
    console.log('📸 Screenshot: experiment detail after waiting');
    
    // Test going back and forth
    console.log('\n🔄 Testing navigation back and forth...');
    
    // Click back button
    await page.evaluate(() => {
      const backButton = Array.from(document.querySelectorAll('button')).find(
        el => el.textContent.includes('Back to experiments')
      );
      if (backButton) backButton.click();
    });
    
    await page.waitForTimeout(1000);
    
    // Click on experiment again
    await page.evaluate(() => {
      const experiments = document.querySelectorAll('.cursor-pointer');
      if (experiments.length > 0) {
        experiments[0].click();
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Final check
    const finalVariablesVisible = await page.evaluate(() => {
      const variableHeaders = Array.from(document.querySelectorAll('h5')).filter(
        el => el.textContent.includes('Variables')
      );
      return variableHeaders.length > 0;
    });
    
    if (finalVariablesVisible) {
      console.log('✅ Variables still visible after navigation!');
    } else {
      console.log('❌ Variables disappeared after navigation!');
    }
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Initial load: ${variantsVisible ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`After waiting: ${variablesStillVisible ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`After navigation: ${finalVariablesVisible ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\nScreenshots saved in tests/screenshots/');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n👀 Browser left open for manual inspection. Close it when done.');
    // await browser.close();
  }
}

// Run the test
testExperimentVariablesPersistence();