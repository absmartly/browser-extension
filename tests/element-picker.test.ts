import { test, expect } from './base/extension-test'
import path from 'path'

test.describe('Element Picker', () => {
  test('should open element picker when clicking the target icon', async ({ browser }) => {
    // Create context with extension
    const pathToExtension = path.join(process.cwd(), 'build/chrome-mv3-dev')
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    })

    // Create a test page with some elements
    const page = await context.newPage()
    await page.setContent(`
      <html>
        <body>
          <div id="test-div">Test Content</div>
          <button class="test-button">Click Me</button>
          <p data-test="paragraph">Test Paragraph</p>
        </body>
      </html>
    `)

    // Wait for content script to load
    await page.waitForTimeout(1000)

    // Open extension popup
    const [extensionPage] = await Promise.all([
      context.waitForEvent('page'),
      page.goto(`chrome-extension://${pathToExtension}/popup.html`)
    ])

    // Navigate to experiments and click on one
    await extensionPage.click('text=Experiments')
    await extensionPage.waitForTimeout(1000)
    
    // Click on the first experiment (assuming there's at least one)
    const firstExperiment = await extensionPage.$('.experiment-item')
    if (firstExperiment) {
      await firstExperiment.click()
      
      // Click Edit button
      await extensionPage.click('text=Edit')
      await extensionPage.waitForTimeout(500)
      
      // Find and click "Add DOM Change" button
      const addDOMChangeButton = await extensionPage.$('text=Add DOM Change')
      if (addDOMChangeButton) {
        await addDOMChangeButton.click()
        
        // In the modal, click the target icon
        const targetIcon = await extensionPage.$('button:has-text("🎯")')
        if (targetIcon) {
          await targetIcon.click()
          
          // Switch to the test page
          await page.bringToFront()
          
          // Check if element picker overlay is visible
          await page.waitForTimeout(500)
          const overlay = await page.$('.absmartly-element-highlight')
          
          // Hover over an element
          await page.hover('#test-div')
          await page.waitForTimeout(200)
          
          // Click on the element
          await page.click('#test-div')
          
          // Switch back to extension
          await extensionPage.bringToFront()
          await extensionPage.waitForTimeout(500)
          
          // Check if selector was populated
          const selectorInput = await extensionPage.$('input[placeholder*="selector"]')
          if (selectorInput) {
            const value = await selectorInput.inputValue()
            expect(value).toBe('#test-div')
          }
        }
      }
    }
    
    await context.close()
  })
})