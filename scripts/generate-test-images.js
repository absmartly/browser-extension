const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function generateTestImages() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a reasonable size
  await page.setViewportSize({ width: 400, height: 200 });

  // Generate "HELLO" image
  await page.setContent(`
    <html>
      <body style="margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white;">
        <div style="font-size: 72px; font-weight: bold; font-family: Arial, sans-serif; color: black;">
          HELLO
        </div>
      </body>
    </html>
  `);

  const helloBuffer = await page.screenshot({ type: 'png' });
  const helloBase64 = helloBuffer.toString('base64');
  const helloDataUrl = `data:image/png;base64,${helloBase64}`;

  // Generate "WORLD" image
  await page.setContent(`
    <html>
      <body style="margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white;">
        <div style="font-size: 72px; font-weight: bold; font-family: Arial, sans-serif; color: black;">
          WORLD
        </div>
      </body>
    </html>
  `);

  const worldBuffer = await page.screenshot({ type: 'png' });
  const worldBase64 = worldBuffer.toString('base64');
  const worldDataUrl = `data:image/png;base64,${worldBase64}`;

  // Generate blue square image (for visual test)
  await page.setContent(`
    <html>
      <body style="margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white;">
        <div style="width: 300px; height: 300px; background: blue;"></div>
      </body>
    </html>
  `);

  const blueBuffer = await page.screenshot({ type: 'png' });
  const blueBase64 = blueBuffer.toString('base64');
  const blueDataUrl = `data:image/png;base64,${blueBase64}`;

  await browser.close();

  // Save to a file that can be imported
  const outputPath = path.join(__dirname, '..', 'src', 'lib', '__tests__', 'test-images.ts');
  const content = `// Auto-generated test images with text
export const TEST_IMAGES = {
  HELLO: '${helloDataUrl}',
  WORLD: '${worldDataUrl}',
  BLUE_SQUARE: '${blueDataUrl}'
};
`;

  fs.writeFileSync(outputPath, content);
  console.log('✓ Generated test images at:', outputPath);
  console.log('  - HELLO image (', helloBase64.length, 'bytes)');
  console.log('  - WORLD image (', worldBase64.length, 'bytes)');
  console.log('  - BLUE_SQUARE image (', blueBase64.length, 'bytes)');
}

generateTestImages().catch(console.error);
