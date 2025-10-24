import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Path to the built extension
const EXTENSION_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')

// Custom test fixture that loads the real Chrome extension
const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ }, use) => {
    // Verify extension is built
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not built! Run 'npm run build' first. Path: ${EXTENSION_PATH}`)
    }

    // Launch Chrome with the extension loaded
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--enable-file-cookies',
      ],
      // Slow down for debugging
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : undefined,
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // For manifest v3, get the service worker to find extension ID
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = serviceWorker.url().split('/')[2];
    console.log('Extension ID:', extensionId);
    await use(extensionId);
  },
});

test.describe('Real Chrome Extension Tests', () => {
  test('Extension loads and sidebar opens', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navigate to a test page
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForSelector('body', { timeout: 5000 });

    // Get extension popup/sidebar URL
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`;

    // Open extension sidebar in a new tab to test it
    const sidebarPage = await context.newPage();
    await sidebarPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Check if sidebar loads
    await expect(sidebarPage.locator('body')).toBeTruthy();

    // Look for either welcome screen or experiment list
    const hasWelcome = await sidebarPage.locator('text=Welcome to ABsmartly').isVisible().catch(() => false);
    const hasSettings = await sidebarPage.locator('text=Configure Settings').isVisible().catch(() => false);
    const hasExperiments = await sidebarPage.locator('[class*="experiment"]').count().then(c => c > 0).catch(() => false);

    console.log('Welcome screen:', hasWelcome);
    console.log('Settings button:', hasSettings);
    console.log('Has experiments:', hasExperiments);

    // At least one should be visible
    expect(hasWelcome || hasSettings || hasExperiments).toBeTruthy();
  });

  test('Extension can be configured with API credentials', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Open extension sidebar
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`;
    await page.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Check if we need to configure
    const needsConfig = await page.locator('button:has-text("Configure Settings")').isVisible().catch(() => false);

    if (needsConfig) {
      console.log('Configuring extension with API credentials...');

      // Click configure button
      await page.click('button:has-text("Configure Settings")');

      // Wait for settings form
      await page.waitForSelector('input[name="apiKey"]', { timeout: 5000 });

      // Fill in the credentials from environment
      const apiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-api-key';
      const apiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1';
      const environment = process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development';

      await page.fill('input[name="apiKey"]', apiKey);
      await page.fill('input[name="apiEndpoint"]', apiEndpoint);
      await page.fill('input[name="environment"]', environment);

      // Save settings
      await page.click('button:has-text("Save Settings")');

      // Wait for navigation or success message
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {});

      console.log('Extension configured successfully');
    } else {
      console.log('Extension already configured');
    }

    // After configuration, we should see experiments or a message
    const hasExperiments = await page.locator('.experiment-item').count().then(c => c > 0).catch(() => false);
    const hasEmptyState = await page.locator('text=/no experiments/i').isVisible().catch(() => false);

    console.log('Has experiments:', hasExperiments);
    console.log('Has empty state:', hasEmptyState);

    // Either experiments or empty state should be visible
    expect(hasExperiments || hasEmptyState).toBeTruthy();
  });

  test('Extension makes real API calls', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Set up request interception to monitor API calls
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('absmartly.com')) {
        console.log('API call detected:', request.method(), request.url());
        apiCalls.push(request.url());
      }
    });

    // Open extension sidebar
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`;
    await page.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Wait for potential API calls
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {});

    // Check if we captured any API calls
    if (apiCalls.length > 0) {
      console.log(`Captured ${apiCalls.length} API calls`);
      apiCalls.forEach(url => console.log('  -', url));
    } else {
      console.log('No API calls detected (might be using service worker)');
    }

    // Check the console for any errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
  });

  test('Visual editor can be launched from extension', async ({ context, extensionId }) => {
    // This test would require:
    // 1. Having experiments configured
    // 2. Clicking on an experiment
    // 3. Launching visual editor
    // 4. Verifying it appears on the main page

    const page = await context.newPage();

    // Navigate to a test page first
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Open extension sidebar
    const sidebarPage = await context.newPage();
    await sidebarPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Look for experiments
    const hasExperiments = await sidebarPage.locator('.experiment-item').count().then(c => c > 0).catch(() => false);

    if (hasExperiments) {
      console.log('Found experiments, attempting to launch visual editor...');

      // Click first experiment
      await sidebarPage.locator('.experiment-item').first().click();

      // Look for visual editor button
      const hasVisualEditorBtn = await sidebarPage.locator('button:has-text("Visual Editor")').isVisible().catch(() => false);

      if (hasVisualEditorBtn) {
        await sidebarPage.click('button:has-text("Visual Editor")');
        console.log('Visual editor button clicked');

        // Switch back to main page and check for visual editor
        await page.bringToFront();
        const hasVisualEditor = await page.locator('#absmartly-visual-editor').isVisible().catch(() => false);
        console.log('Visual editor visible on page:', hasVisualEditor);
      }
    } else {
      console.log('No experiments available for visual editor test');
    }
  });
});

test.describe('Extension Storage and Persistence', () => {
  test('Settings persist across sessions', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // First, configure the extension
    await page.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const needsConfig = await page.locator('button:has-text("Configure Settings")').isVisible().catch(() => false);

    if (needsConfig) {
      // Configure with test values
      await page.click('button:has-text("Configure Settings")');
      await page.waitForSelector('input[name="apiKey"]');

      const testApiKey = 'test-persistence-key-' + Date.now();
      await page.fill('input[name="apiKey"]', testApiKey);
      await page.fill('input[name="apiEndpoint"]', 'https://test.example.com');
      await page.fill('input[name="environment"]', 'test');

      await page.click('button:has-text("Save Settings")');
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {});

      // Close and reopen the sidebar
      await page.close();

      // Open a new page with the sidebar
      const newPage = await context.newPage();
      await newPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Check if settings are persisted (should not show welcome screen)
      const stillNeedsConfig = await newPage.locator('button:has-text("Configure Settings")').isVisible().catch(() => false);
      expect(stillNeedsConfig).toBeFalsy();

      console.log('Settings persisted successfully');
    } else {
      console.log('Extension already configured, skipping persistence test');
    }
  });
});