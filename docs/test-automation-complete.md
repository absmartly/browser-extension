# Test Automation Complete

## Achievement Unlocked ✅

You can now run tests with just:
```bash
npx playwright test
```

No manual steps required! The test infrastructure automatically:

1. **Builds the extension** if needed (checks if source files are newer than build)
2. **Copies seed.html** to the build directory
3. **Loads environment variables** from `.env.local`
4. **Verifies API credentials** are available
5. **Sets up Chrome with the extension** loaded
6. **Seeds storage** with test data
7. **Runs tests** in real Chrome environment

## File Structure

```
tests/
├── fixtures/
│   ├── extension.ts      # Reusable Playwright fixtures for extension testing
│   └── setup.ts          # Build verification and automatic building
├── e2e/
│   └── api-integration.spec.ts  # API integration tests
├── global-setup.ts       # Runs before all tests (build, copy files, load env)
└── seed.html            # Storage seeding page (auto-copied to build)
```

## Key Components

### Global Setup (`tests/global-setup.ts`)
- Runs once before all tests
- Builds extension if missing
- Copies seed.html to build directory
- Loads environment variables
- Verifies API credentials

### Extension Fixtures (`tests/fixtures/extension.ts`)
- Provides reusable test fixtures:
  - `context`: Browser with extension loaded
  - `extensionId`: Dynamic extension ID
  - `extensionUrl`: Helper to create extension URLs
  - `seedStorage`: Seed chrome.storage with data
  - `clearStorage`: Clear all storage
  - `getStorage`: Get current storage state

### Setup Module (`tests/fixtures/setup.ts`)
- Checks if build is outdated
- Automatically rebuilds if source files changed
- Can be skipped with `SKIP_BUILD=true`

## Running Tests

### Run all tests:
```bash
npx playwright test
```

### Run specific test file:
```bash
npx playwright test tests/e2e/api-integration.spec.ts
```

### Run in headed mode (see browser):
```bash
HEADLESS=false npx playwright test
```

### Run with slow motion for debugging:
```bash
SLOW_MO=1000 npx playwright test
```

### Skip automatic build:
```bash
SKIP_BUILD=true npx playwright test
```

## Environment Variables

Create `.env.local` with:
```env
PLASMO_PUBLIC_ABSMARTLY_API_KEY=your_api_key
PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT=https://dev-1.absmartly.com/v1
PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT=development
```

These are automatically loaded by the global setup.

## Writing New Tests

```typescript
import { test, expect } from '../fixtures/extension'

test('my test', async ({ context, seedStorage, extensionUrl }) => {
  // Seed storage with test data
  await seedStorage({
    'key': 'value'
  })

  // Open extension page
  const page = await context.newPage()
  await page.goto(extensionUrl('tabs/sidebar.html'))

  // Test your extension
  await expect(page.locator('text=ABsmartly')).toBeVisible()
})
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install chromium
      - run: npx playwright test
    env:
      PLASMO_PUBLIC_ABSMARTLY_API_KEY: ${{ secrets.API_KEY }}
      PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT: ${{ secrets.API_ENDPOINT }}
```

## Troubleshooting

### Tests hang or timeout
- Try running in headed mode: `HEADLESS=false npx playwright test`
- Add slow motion: `SLOW_MO=1000 npx playwright test`
- Check if extension built: `ls build/chrome-mv3-dev/manifest.json`

### Extension not loading
- Verify build: `npm run build`
- Check extension ID in console output
- Ensure seed.html copied: `ls build/chrome-mv3-dev/tests/seed.html`

### API calls not working
- Check `.env.local` has correct credentials
- Verify service worker is running (check console output)
- API calls go through background script, not visible in network tab

## Summary

The test infrastructure now provides:
- ✅ **Zero manual setup** - just run `npx playwright test`
- ✅ **Automatic building** - builds if source changed
- ✅ **Real Chrome environment** - all extension APIs work
- ✅ **Real API calls** - through service worker
- ✅ **Deterministic state** - storage seeding
- ✅ **CI/CD ready** - works in GitHub Actions

This fulfills your requirement: **"I just want to run `playwright test`"** 🎉