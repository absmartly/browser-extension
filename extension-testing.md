# Testing Challenges and Solutions for ABsmartly Browser Extension

## Executive Summary

Testing a Plasmo-based browser extension with real API calls presents unique challenges due to the complex interaction between browser extension APIs, cross-origin restrictions, and the need for a real Chrome environment. This document outlines the key challenges we face and proposes comprehensive solutions.

---

## Key Challenges

### 1. Chrome Extension API Availability
- **Problem**: `chrome.runtime`, `chrome.storage`, `chrome.tabs` unavailable in regular HTTP context.
- **Impact**:
  - `@plasmohq/storage` fails
  - Messaging breaks
  - API credentials inaccessible

### 2. Cross-Origin Restrictions
- Parent page (`http://localhost`) and sidebar iframe (`http://localhost:PORT`) differ from extension origin.
- Prevents storage access and introduces CORS errors.

### 3. Plasmo Storage Dependencies
- `@plasmohq/storage` expects `chrome.storage.local`.
- Fails without extension context.

### 4. Service Worker / Background Script
- Not running in test harness → message passing + API proxying fail.

### 5. Real API Integration
- User requirement: real API calls (no mocks).
- Blocked by missing storage, CORS, background fetch.

---

## Proposed Fixes

### 1. Load the **Real Extension** in Playwright
- Launch Chromium with extension loaded:

```ts
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`
  ]
})
```

- Extension APIs and SW available in test environment.

---

### 2. Always Use `chrome.runtime.getURL()`
Inject sidebar iframe like this:

```ts
const iframe = document.createElement("iframe")
iframe.name = "absmartly-sidebar"
iframe.src = chrome.runtime.getURL("tabs/sidebar.html")
document.documentElement.appendChild(iframe)
```

- Runs in extension origin (`chrome-extension://id/...`).
- Ensures Plasmo storage + Chrome APIs exist.

---

### 3. Deterministic Storage State
Add a test-only **seed page** (`tests/seed.html`):

```html
<!doctype html><meta charset="utf-8">
<script>
  window.seed = async (kv) => { await chrome.storage.local.set(kv); return 'ok' }
  window.clear = async () => { await chrome.storage.local.clear(); return 'ok' }
</script>
```

Seed credentials before each test, ensuring reproducibility.

---

### 4. Observe Service Worker Requests
In Playwright:

```ts
context.on('request', (req) => {
  if (req.serviceWorker()) console.log("SW request:", req.url())
})
```

Guarantees background script is really making the network calls.

---

### 5. Background Service Worker Implementation

```ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    if (msg.type === 'API_REQUEST') {
      const { path, method = 'GET', body } = msg.payload
      const creds = await chrome.storage.local.get([
        'absmartly:apiUrl', 'absmartly:apiKey'
      ])
      const res = await fetch(`${creds['absmartly:apiUrl']}${path}`, {
        method,
        headers: { 'X-API-Key': creds['absmartly:apiKey'] },
        body: body ? JSON.stringify(body) : undefined
      })
      sendResponse({ ok: res.ok, status: res.status, data: await res.json().catch(() => null) })
    }
  })()
  return true
})
```

---

## Playwright Fixtures

**`tests/fixtures/extension.ts`**

```ts
import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

type ExtFixtures = {
  context: BrowserContext
  extensionId: string
  extensionUrl: (p: string) => string
  seedStorage: (kv: Record<string, unknown>) => Promise<void>
  clearStorage: () => Promise<void>
}

export const test = base.extend<ExtFixtures>({
  context: async ({}, use) => {
    const extPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`
      ]
    })
    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')
    const extensionId = new URL(sw.url()).host
    await use(extensionId)
  },

  extensionUrl: async ({ extensionId }, use) => {
    await use((p: string) => `chrome-extension://${extensionId}/${p.replace(/^\//, '')}`)
  },

  seedStorage: async ({ context, extensionUrl }, use) => {
    const fn = async (kv: Record<string, unknown>) => {
      const page = await context.newPage()
      await page.goto(extensionUrl('tests/seed.html'))
      await page.evaluate((data) => (window as any).seed(data), kv)
      await page.close()
    }
    await use(fn)
  },

  clearStorage: async ({ context, extensionUrl }, use) => {
    const fn = async () => {
      const page = await context.newPage()
      await page.goto(extensionUrl('tests/seed.html'))
      await page.evaluate(() => (window as any).clear())
      await page.close()
    }
    await use(fn)
  }
})

export const expect = base.expect
```

---

## Example E2E API Test

**`tests/e2e/api-integration.spec.ts`**

```ts
import { test, expect } from '../fixtures/extension'

test.beforeEach(async ({ clearStorage }) => {
  await clearStorage()
})

test('sidebar boots and makes a real API call via background', async ({
  context, seedStorage, extensionUrl
}) => {
  // 1) Seed credentials
  await seedStorage({
    'absmartly:apiKey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY,
    'absmartly:apiUrl': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT,
    'absmartly:env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT
  })

  // 2) Track background requests
  const seen: string[] = []
  context.on('request', (req) => {
    if (req.serviceWorker()) seen.push(req.url())
  })

  // 3) Load sidebar
  const page = await context.newPage()
  await page.goto(extensionUrl('tabs/sidebar.html'))
  await expect(page.getByText(/ABsmartly/i)).toBeVisible()

  // 4) Trigger API call
  await page.getByRole('button', { name: /load/i }).click()

  // 5) Verify background SW made the call
  await expect.poll(() => seen.some(u => u.includes('/v1'))).toBeTruthy()
})
```

---

## CI / Docker Setup

**Dockerfile**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

WORKDIR /work
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

COPY . .
RUN pnpm build:chrome

CMD ["pnpm", "playwright", "test", "--reporter=line"]
```

---

## Test Tree

```
tests/
├─ fixtures/
│  └─ extension.ts
├─ e2e/
│  └─ api-integration.spec.ts
└─ unit/
   └─ storage.spec.ts
```

---

## Conclusion

By loading the actual extension in Playwright with the Chromium channel, using a storage seed page, and validating requests from the service worker, we achieve:

- Real Chrome API availability
- Deterministic storage state for credentials
- Real background → API integration
- Headless CI compatibility

This resolves all previously blocked ❌ items and provides a scalable foundation for ABsmartly extension testing.
