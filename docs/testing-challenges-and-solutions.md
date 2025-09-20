# Testing Challenges and Solutions for ABsmartly Browser Extension

## Executive Summary

Testing a Plasmo-based browser extension with real API calls presents unique challenges due to the complex interaction between browser extension APIs, cross-origin restrictions, and the need for a real Chrome environment. This document outlines the key challenges we face and proposes comprehensive solutions.

## Current State

We have successfully created:
- ✅ Automated test server that starts without manual intervention
- ✅ Dynamic port selection to avoid conflicts
- ✅ Headed mode testing with visible browser
- ✅ Basic sidebar loading and toggle functionality
- ❌ Real API calls from within the extension context
- ❌ Full Chrome extension API availability in tests
- ❌ Proper storage state management for credentials

## Key Challenges

### 1. Chrome Extension API Availability

**Challenge**: The sidebar and content scripts rely heavily on Chrome APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`) which aren't available in a regular web page context.

**Impact**:
- `@plasmohq/storage` fails to initialize
- Message passing between components doesn't work
- API credentials can't be retrieved from storage

**Current Workarounds**:
- Mocking chrome.runtime.sendMessage
- Creating fake chrome.storage.local
- These mocks are incomplete and don't fully replicate the extension environment

### 2. Cross-Origin Restrictions

**Challenge**: When loading the extension files via HTTP server:
- Parent page: `file://` or `http://localhost:PORT1`
- Sidebar iframe: `http://localhost:PORT2/tabs/sidebar.html`
- Content script: Injected into parent page context

**Impact**:
- Cannot access iframe's window object from parent
- Cannot set localStorage or chrome APIs in iframe context
- Security errors when trying to configure the iframe environment

### 3. Plasmo Storage Dependencies

**Challenge**: `@plasmohq/storage` is tightly coupled with the Chrome extension environment:
```typescript
import { Storage } from "@plasmohq/storage"
const storage = new Storage()
// This expects chrome.storage.local to exist
```

**Impact**:
- Components using Plasmo storage fail to initialize
- Config retrieval fails, preventing API calls
- No way to inject test credentials into the storage system

### 4. Service Worker / Background Script

**Challenge**: The background script (service worker) handles all API requests to avoid CORS issues, but it's not running in our test environment.

**Impact**:
- `chrome.runtime.sendMessage` calls to background script fail
- API requests never get proxied through the background script
- No central message hub for coordinating between components

### 5. Real API Integration

**Challenge**: User requirement is to make real API calls, not mocked ones, but:
- Credentials are stored in chrome.storage (not accessible)
- Requests go through background script (not running)
- CORS prevents direct API calls from web page context

## Proposed Solutions

### Solution A: Full Chrome Extension Loading (Recommended)

**Implementation**: Load the actual built extension using Playwright's Chrome extension support

```javascript
const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
const context = await chromium.launchPersistentContext('', {
  headless: false, // Extensions don't work in headless mode
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
  ],
});

// Get extension ID dynamically
let [serviceWorker] = context.serviceWorkers();
if (!serviceWorker)
  serviceWorker = await context.waitForEvent('serviceworker');
const extensionId = serviceWorker.url().split('/')[2];

// Test the actual extension pages
await page.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`);
```

**Pros**:
- Real Chrome extension environment
- All Chrome APIs available
- Service worker runs properly
- Storage APIs work as expected
- Real API calls work through background script

**Cons**:
- Cannot run in headless mode (must use headed or new-headless)
- Extension ID changes per environment
- Requires building extension before testing

### Solution B: Hybrid Mock/Real Approach

**Implementation**: Create a test harness that bridges the gap between mock and real

1. **Create a TestExtensionBridge class**:
```javascript
class TestExtensionBridge {
  constructor(page) {
    this.page = page;
    this.storage = new Map();
    this.setupChromeAPIs();
    this.startMockServiceWorker();
  }

  async setupChromeAPIs() {
    await this.page.evaluateOnNewDocument(() => {
      window.chrome = {
        runtime: { /* full mock implementation */ },
        storage: { /* full mock implementation */ },
        tabs: { /* full mock implementation */ }
      };
    });
  }

  async startMockServiceWorker() {
    // Intercept all chrome.runtime.sendMessage calls
    // Make real API calls using Node.js fetch
    // Return responses as if from service worker
  }
}
```

2. **Use Playwright's route interception for API calls**:
```javascript
await page.route('**/api.absmartly.com/**', async (route) => {
  const response = await fetch(route.request().url(), {
    headers: {
      'X-API-Key': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY,
      'X-Environment': 'development'
    }
  });
  await route.fulfill({ response });
});
```

**Pros**:
- Can run in any mode (headless or headed)
- Full control over API responses
- Can inject test data easily
- Works with current test infrastructure

**Cons**:
- Not testing the real extension environment
- Mocks may diverge from real Chrome APIs
- Complex to maintain

### Solution C: Plasmo-Specific Testing Framework

**Investigation Needed**: Research or create a Plasmo-specific testing framework

1. **Check Plasmo's Itero TestBed** (mentioned in their docs)
2. **Create Plasmo Storage Mock**:
```javascript
// @plasmohq/storage-mock
export class Storage {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key);
  }

  async set(key, value) {
    this.data.set(key, value);
  }
}
```

3. **Use Jest for unit tests, Playwright for E2E**:
- Jest: Mock all Plasmo dependencies
- Playwright: Load real extension as in Solution A

### Solution D: Docker/CI Environment

**Implementation**: Create a consistent testing environment

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Install extension dependencies
COPY package.json .
RUN npm install

# Build extension
COPY . .
RUN npm run build

# Run tests with real extension
CMD ["npx", "playwright", "test", "--project=extension"]
```

## Recommended Approach

### Phase 1: Immediate (What Works Now)
1. Continue using current test infrastructure for basic UI testing
2. Mock API responses for immediate test coverage
3. Focus on testing UI interactions and state management

### Phase 2: Short-term (1-2 weeks)
1. Implement Solution A (Full Chrome Extension Loading)
2. Create test fixtures for common scenarios
3. Set up CI/CD pipeline with headed Chrome

### Phase 3: Long-term (1 month)
1. Contribute to Plasmo community with testing solutions
2. Create reusable testing utilities for Plasmo extensions
3. Consider building a Plasmo testing library

## Implementation Checklist

### Immediate Actions
- [x] Create test server for serving extension files
- [x] Set up basic Playwright tests
- [ ] Implement full Chrome extension loading in Playwright
- [ ] Create test fixtures for extension context
- [ ] Document testing patterns for team

### Required Dependencies
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0",
    "@types/chrome": "^0.0.254"
  }
}
```

### Environment Setup
```bash
# .env.test
PLASMO_PUBLIC_ABSMARTLY_API_KEY=your_api_key
PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT=https://dev-1.absmartly.com/v1
PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT=development
```

### Test Structure
```
tests/
├── fixtures/
│   ├── extension-context.ts    # Reusable extension loading
│   ├── api-bridge.ts          # API mocking/bridging
│   └── storage-mock.ts        # Storage mocking
├── e2e/
│   ├── sidebar.spec.ts        # Sidebar functionality
│   ├── visual-editor.spec.ts  # Visual editor tests
│   └── api-integration.spec.ts # Real API tests
└── unit/
    ├── storage.spec.ts         # Storage unit tests
    └── api-client.spec.ts      # API client tests
```

## Code Examples

### Example: Loading Real Extension
```typescript
import { test as base, chromium } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  extensionId: string;
  extensionPage: Page;
}>({
  extensionId: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../build/chrome-mv3-dev');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Get extension ID
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker)
      serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = serviceWorker.url().split('/')[2];

    await use(extensionId);
    await context.close();
  },

  extensionPage: async ({ extensionId }, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=...`],
    });
    const page = await context.newPage();
    await use(page);
  },
});

test('sidebar loads with real extension', async ({ extensionPage, extensionId }) => {
  // Navigate to extension sidebar
  await extensionPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`);

  // Test real functionality
  await expect(extensionPage.locator('text=ABsmartly')).toBeVisible();
});
```

### Example: Mocking Plasmo Storage
```typescript
// tests/mocks/plasmo-storage.ts
export class MockStorage {
  private store = new Map<string, any>();

  async get(key: string) {
    return this.store.get(key);
  }

  async set(key: string, value: any) {
    this.store.set(key, value);
  }

  async remove(key: string) {
    this.store.delete(key);
  }

  watch(config: any) {
    // Mock implementation
    return {
      unwatch: () => {}
    };
  }
}

// In test
jest.mock('@plasmohq/storage', () => ({
  Storage: MockStorage
}));
```

## Resources and References

1. [Playwright Chrome Extensions Documentation](https://playwright.dev/docs/chrome-extensions)
2. [Plasmo Framework Documentation](https://docs.plasmo.com/framework)
3. [Chrome Extension Testing Best Practices](https://developer.chrome.com/docs/extensions/mv3/testing/)
4. [Jest Mocking Documentation](https://jestjs.io/docs/mock-functions)

## Conclusion

Testing Plasmo-based browser extensions with real API calls requires a multi-faceted approach. While we can't perfectly replicate the extension environment in a simple web page context, we can achieve comprehensive testing by:

1. Using Playwright's Chrome extension loading for true E2E tests
2. Creating robust mocks for unit testing
3. Building a bridge layer for integration tests
4. Contributing back to the Plasmo community with our solutions

The key is to balance test authenticity with development velocity, using the right tool for each testing scenario.