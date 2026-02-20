import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Experiment Variables Persistence', () => {
  let extensionId: string

  test.beforeEach(async ({ page, context }) => {
    // Load the extension
    const pathToExtension = path.join(__dirname, '../')
    
    // Get extension ID from management page
    const extensionPage = await context.newPage()
    await extensionPage.goto('chrome://extensions/')
    
    // Note: In real tests, you'd need to load the unpacked extension
    // For now, we'll test the functionality assuming extension is loaded
  })

  test('experiment variables should persist after clicking on experiment', async ({ page }) => {
    // Navigate to a test page where the extension is active
    await page.goto('https://example.com')
    
    // Open the extension popup
    // Note: This requires the extension to be properly loaded
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Wait for experiments list to load
    await page.waitForSelector('[data-testid="experiments-list"]', { timeout: 10000 })
    
    // Click on the first experiment in the list
    const firstExperiment = await page.locator('[data-testid="experiment-item"]').first()
    await firstExperiment.click()
    
    // Wait for experiment detail view to load
    await page.waitForSelector('[data-testid="experiment-detail"]', { timeout: 5000 })
    
    // Check that variants section is visible
    const variantsSection = await page.locator('h3:has-text("Variants")')
    await expect(variantsSection).toBeVisible()
    
    // Check that variables are visible and stay visible
    await page.waitForSelector('h5:has-text("Variables")', { timeout: 5000 })
    
    // Wait a bit to ensure no flickering occurs
    await page.waitForTimeout(2000)
    
    // Verify variables section is still visible (not disappeared)
    const variablesSection = await page.locator('h5:has-text("Variables")')
    await expect(variablesSection).toBeVisible()
    
    // Check that variable inputs are present
    const variableInputs = await page.locator('input[type="text"]').filter({ hasText: /.+/ })
    const inputCount = await variableInputs.count()
    expect(inputCount).toBeGreaterThan(0)
    
    // Test editing a variable
    if (inputCount > 0) {
      const firstVariableInput = variableInputs.first()
      await firstVariableInput.click()
      await firstVariableInput.fill('test_value_updated')
      
      // Verify the value persists
      await expect(firstVariableInput).toHaveValue('test_value_updated')
    }
    
    // Test DOM Changes section is also visible
    const domChangesSection = await page.locator('text=DOM Changes')
    await expect(domChangesSection).toBeVisible()
    
    // Navigate back to experiments list
    await page.locator('button:has-text("Back to experiments")').click()
    
    // Click on the same experiment again
    await firstExperiment.click()
    
    // Verify variables are still visible (no disappearing bug)
    await expect(variablesSection).toBeVisible()
    
    // If we edited a value, verify it's still there
    if (inputCount > 0) {
      const firstVariableInput = variableInputs.first()
      await expect(firstVariableInput).toHaveValue('test_value_updated')
    }
  })

  test('handles empty variants gracefully', async ({ page }) => {
    // Test case for experiments with no variants
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Find an experiment with no variants (if any)
    // This would need mock data or specific test setup
    
    // Verify the UI doesn't break
    await expect(page.locator('[data-testid="experiment-detail"]')).toBeVisible()
  })

  test('preserves data during rapid experiment switching', async ({ page }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Click between multiple experiments rapidly
    const experiments = await page.locator('[data-testid="experiment-item"]').all()
    
    if (experiments.length >= 2) {
      // Click first experiment
      await experiments[0].click()
      await page.waitForSelector('h5:has-text("Variables")')
      
      // Immediately click second experiment
      await page.locator('button:has-text("Back to experiments")').click()
      await experiments[1].click()
      await page.waitForSelector('h5:has-text("Variables")')
      
      // Go back to first experiment
      await page.locator('button:has-text("Back to experiments")').click()
      await experiments[0].click()
      
      // Verify variables are still visible
      const variablesSection = await page.locator('h5:has-text("Variables")')
      await expect(variablesSection).toBeVisible()
    }
  })
})