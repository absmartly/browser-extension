const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Load the performance test HTML file
  const filePath = 'file://' + path.resolve(__dirname, 'test-selector-performance.html');
  await page.goto(filePath);

  // Wait for the test to complete
  await page.waitForSelector('.results', { timeout: 10000 });

  // Get the results
  const results = await page.evaluate(() => {
    const resultDivs = document.querySelectorAll('.results > div');
    const testResults = [];

    resultDivs.forEach(div => {
      const text = div.innerText;
      if (text.includes('Selector:')) {
        const lines = text.split('\n');
        const name = lines[0];
        const selector = lines[1].replace('Selector: ', '');
        const time = parseFloat(lines[2].match(/[\d.]+/)[0]);
        const opsPerSec = lines[3].replace('Ops/sec: ', '').replace(/,/g, '');
        testResults.push({ name, selector, time, opsPerSec });
      }
    });

    return testResults;
  });

  console.log('\n=== SELECTOR PERFORMANCE TEST RESULTS ===\n');
  console.log('Ranking (fastest to slowest):');
  console.log('-'.repeat(80));

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   Selector: ${result.selector}`);
    console.log(`   Time: ${result.time}ms`);
    console.log(`   Ops/sec: ${result.opsPerSec}`);
    if (index === 0) {
      console.log('   🏆 FASTEST');
    } else {
      const relativeSpeed = (result.time / results[0].time).toFixed(2);
      console.log(`   ${relativeSpeed}x slower than fastest`);
    }
    console.log();
  });

  // Get the analysis
  const analysis = await page.evaluate(() => {
    const analysisSection = document.querySelector('.results:last-of-type');
    return analysisSection ? analysisSection.innerText : '';
  });

  console.log('=== ANALYSIS ===');
  console.log(analysis);

  // Keep browser open for 5 seconds to see results
  await page.waitForTimeout(5000);

  await browser.close();
})();