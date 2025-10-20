import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('MultiSelect Tags Widget', () => {
  test('should allow adding and removing CSS classes with pill-style tags', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]
    
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Wait for experiments to load
    await page.waitForSelector('text=ABSmartly Experiments', { timeout: 10000 })
    
    // Click on first experiment
    const firstExperiment = await page.locator('[data-experiment-id]').first()
    await firstExperiment.click()
    
    // Wait for experiment details
    await page.waitForSelector('text=Experiment Details', { timeout: 10000 })
    
    // Find a variant section and look for DOM Changes
    const variantSection = await page.locator('.border.rounded-lg').first()
    
    // Add a new DOM change
    const addButton = await variantSection.locator('button:has-text("Add DOM Change")')
    await addButton.click()
    
    // Wait for the DOM change form
    await page.waitForSelector('input[placeholder*="selector"]')
    
    // Fill in selector
    await page.fill('input[placeholder*="selector"]', '.test-element')
    
    // Select 'class' type from dropdown
    const typeSelect = await page.locator('select').first()
    await typeSelect.selectOption('class')
    
    // Wait for class inputs to appear
    await page.waitForSelector('text=Classes to Add')
    
    // Test "Classes to Add" multiselect
    const addClassesSection = await page.locator('div:has-text("Classes to Add")').locator('..')
    const addClassesInput = await addClassesSection.locator('input[placeholder*="Type class name"]')
    
    // Add first class
    await addClassesInput.fill('active')
    await addClassesInput.press('Enter')
    
    // Verify pill appears with green background
    const activePill = await addClassesSection.locator('span:has-text("active")')
    await expect(activePill).toBeVisible()
    await expect(activePill).toHaveClass(/bg-green-100/)
    
    // Add second class
    await addClassesInput.fill('highlighted')
    await addClassesInput.press('Enter')
    
    // Verify both pills are visible
    await expect(addClassesSection.locator('span:has-text("active")')).toBeVisible()
    await expect(addClassesSection.locator('span:has-text("highlighted")')).toBeVisible()
    
    // Test removing a class by clicking X
    const removeButton = await activePill.locator('button[aria-label*="Remove"]')
    await removeButton.click()
    
    // Verify pill is removed
    await expect(addClassesSection.locator('span:has-text("active")')).not.toBeVisible()
    await expect(addClassesSection.locator('span:has-text("highlighted")')).toBeVisible()
    
    // Test "Classes to Remove" multiselect
    const removeClassesSection = await page.locator('div:has-text("Classes to Remove")').locator('..')
    const removeClassesInput = await removeClassesSection.locator('input[placeholder*="Type class name"]')
    
    // Add class to remove list
    await removeClassesInput.fill('disabled')
    await removeClassesInput.press('Enter')
    
    // Verify pill appears with red background
    const disabledPill = await removeClassesSection.locator('span:has-text("disabled")')
    await expect(disabledPill).toBeVisible()
    await expect(disabledPill).toHaveClass(/bg-red-100/)
    
    // Test that adding same class to "remove" removes it from "add"
    await removeClassesInput.fill('highlighted')
    await removeClassesInput.press('Enter')
    
    // Verify 'highlighted' moved from add to remove
    await expect(addClassesSection.locator('span:has-text("highlighted")')).not.toBeVisible()
    await expect(removeClassesSection.locator('span:has-text("highlighted")')).toBeVisible()
    
    // Save the DOM change
    const saveButton = await page.locator('button:has([data-slot-icon])').filter({ hasText: '' }).first()
    await saveButton.click()
    
    // Verify the change was saved
    await expect(page.locator('text=.test-element')).toBeVisible()
    
    console.log('✅ MultiSelect tags widget test completed successfully')
    
    await context.close()
  })
  
  test('should handle edge cases in MultiSelect tags', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]
    
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForSelector('text=ABSmartly Experiments', { timeout: 10000 })
    
    // Click on first experiment
    const firstExperiment = await page.locator('[data-experiment-id]').first()
    await firstExperiment.click()
    
    // Add DOM change and select class type
    const variantSection = await page.locator('.border.rounded-lg').first()
    await variantSection.locator('button:has-text("Add DOM Change")').click()
    await page.fill('input[placeholder*="selector"]', '.test-element')
    await page.locator('select').first().selectOption('class')
    
    // Test empty class name (should not add)
    const addClassesInput = await page.locator('div:has-text("Classes to Add")').locator('..').locator('input[placeholder*="Type class name"]')
    await addClassesInput.fill('   ')
    await addClassesInput.press('Enter')
    
    // Verify no pill was added
    const pills = await page.locator('div:has-text("Classes to Add")').locator('..').locator('span.bg-green-100')
    await expect(pills).toHaveCount(0)
    
    // Test duplicate class (should not add twice)
    await addClassesInput.fill('duplicate-test')
    await addClassesInput.press('Enter')
    await addClassesInput.fill('duplicate-test')
    await addClassesInput.press('Enter')
    
    // Verify only one pill exists
    const duplicatePills = await page.locator('span:has-text("duplicate-test")')
    await expect(duplicatePills).toHaveCount(1)
    
    console.log('✅ MultiSelect edge cases handled correctly')
    
    await context.close()
  })
})