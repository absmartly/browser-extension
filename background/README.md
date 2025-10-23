# Background Script Architecture

This directory contains the modular refactored background script for the ABsmartly browser extension.

## Directory Structure

```
background/
├── README.md                   # This file
├── core/                       # Core functionality modules (COMPLETED)
│   ├── message-router.ts       # Chrome message routing ✓
│   ├── api-client.ts          # ABsmartly API client ✓
│   ├── config-manager.ts      # Configuration management ✓
│   └── __tests__/             # Unit tests (100% coverage) ✓
│       ├── message-router.test.ts
│       ├── api-client.test.ts
│       └── config-manager.test.ts
├── handlers/                   # Feature-specific handlers (PLANNED)
│   ├── auth-handler.ts        # Authentication (JWT/API key)
│   ├── storage-handler.ts     # Chrome storage operations
│   ├── event-buffer.ts        # SDK event buffering
│   ├── injection-handler.ts   # Content script injection
│   └── avatar-proxy.ts        # Avatar proxy service worker
├── utils/                      # Utility functions (PLANNED)
│   ├── validation.ts          # Zod schemas and validation
│   └── security.ts            # Security helpers (SSRF, domain validation)
└── types/                      # Shared TypeScript types ✓
    └── index.ts               # Type definitions
```

## Completed Modules (Phase 1)

## Module Responsibilities

### Core Modules

#### `core/message-router.ts`
- Routes messages between content scripts, sidebar, and background
- Manages Chrome runtime message listeners
- Handles port connections for real-time communication

#### `core/api-client.ts`
- Makes authenticated API requests to ABsmartly
- Handles JWT and API key authentication
- Manages request/response transformation

#### `core/config-manager.ts`
- Loads and saves extension configuration
- Validates configuration changes
- Manages configuration state

### Handler Modules

#### `handlers/auth-handler.ts`
- Handles login/logout operations
- Manages JWT token refresh
- Stores credentials securely

#### `handlers/storage-handler.ts`
- Wraps Chrome storage API (session, local, secure)
- Provides type-safe storage operations
- Manages storage migration

#### `handlers/event-buffer.ts`
- Buffers SDK events from page context
- Broadcasts events to connected listeners
- Manages event queue with size limits

#### `handlers/injection-handler.ts`
- Injects content scripts into tabs
- Manages sidebar panel opening
- Handles script injection lifecycle

#### `handlers/avatar-proxy.ts`
- Proxies avatar image requests
- Applies SSRF protection
- Handles CORS for avatar fetching

### Utility Modules

#### `utils/validation.ts`
Provides Zod schemas and validation functions:
- `ConfigSchema` - Validates ABsmartly configuration
- `APIRequestSchema` - Validates API request parameters
- `validateConfig()` - Validates config and throws on error
- `safeValidateConfig()` - Safe validation returning result object
- `validateAPIRequest()` - Validates API requests
- `safeValidateAPIRequest()` - Safe API request validation

**Example Usage:**
```typescript
import { validateConfig, ConfigSchema } from './utils/validation'

// Throws ZodError if invalid
const config = validateConfig(userInput)

// Safe validation
const result = safeValidateConfig(userInput)
if (result.success) {
  console.log(result.data.apiEndpoint)
} else {
  console.error(result.error)
}
```

#### `utils/security.ts`
Provides security validation functions:
- `validateAPIEndpoint()` - Ensures API endpoint is allowed domain
- `isSSRFSafe()` - Checks URL against SSRF blocked hosts
- `validateAvatarUrl()` - Validates avatar URLs for proxy
- `validateExtensionSender()` - Validates Chrome message sender ID
- `sanitizeHostname()` - Extracts hostname from URL safely

**Example Usage:**
```typescript
import { validateAPIEndpoint, isSSRFSafe } from './utils/security'

// Validate API endpoint
if (!validateAPIEndpoint(endpoint)) {
  throw new Error('Invalid API endpoint domain')
}

// Check for SSRF
if (!isSSRFSafe(avatarUrl)) {
  return new Response('Access blocked', { status: 403 })
}
```

## Design Principles

### 1. Single Responsibility
Each module handles one specific concern. For example:
- `auth-handler.ts` only handles authentication
- `storage-handler.ts` only handles storage operations
- `validation.ts` only handles input validation

### 2. Dependency Injection
Modules don't create their own dependencies. They accept them as parameters:

```typescript
// Good
export async function makeAPIRequest(
  config: ValidatedConfig,
  request: APIRequest
) {
  // ...
}

// Bad
export async function makeAPIRequest() {
  const config = await loadConfig() // Creates dependency internally
}
```

### 3. Pure Functions Where Possible
Prefer pure functions that don't modify global state:

```typescript
// Pure function
export function validateAPIEndpoint(endpoint: string): boolean {
  const url = new URL(endpoint)
  return ALLOWED_DOMAINS.includes(url.hostname)
}

// Impure (but sometimes necessary)
export async function saveConfig(config: Config): Promise<void> {
  await storage.set('config', config) // Side effect
}
```

### 4. Type Safety
All modules use TypeScript with strict typing:
- Use Zod for runtime validation
- Export type definitions
- No `any` types without good reason

### 5. Error Handling
Always handle errors gracefully:

```typescript
import { debugError } from '~src/utils/debug'

try {
  const result = await riskyOperation()
  return result
} catch (error) {
  debugError('[Module] Operation failed:', error)
  throw new Error('User-friendly error message')
}
```

## Adding New Handlers

To add a new message handler:

### 1. Create the handler module

```typescript
// handlers/new-feature-handler.ts
import { debugLog } from '~src/utils/debug'

export async function handleNewFeature(data: FeatureData) {
  debugLog('[NewFeature] Processing:', data)

  // Implementation
  const result = await processFeature(data)

  return { success: true, result }
}

function processFeature(data: FeatureData) {
  // Helper function
}
```

### 2. Add validation schema (if needed)

```typescript
// utils/validation.ts
export const FeatureDataSchema = z.object({
  id: z.string().uuid(),
  value: z.number().positive()
})
```

### 3. Update message router

```typescript
// core/message-router.ts
import { handleNewFeature } from '../handlers/new-feature-handler'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_FEATURE') {
    handleNewFeature(message.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true
  }
})
```

### 4. Write comprehensive tests

```typescript
// handlers/__tests__/new-feature-handler.test.ts
describe('NewFeatureHandler', () => {
  it('should process valid feature data', async () => {
    const result = await handleNewFeature({ id: '123', value: 42 })
    expect(result.success).toBe(true)
  })

  it('should reject invalid data', async () => {
    await expect(handleNewFeature({})).rejects.toThrow()
  })
})
```

## Testing Guidelines

### Unit Test Structure

Follow this pattern for all test files:

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    describe('valid inputs', () => {
      it('should handle basic case', () => {
        expect(fn(validInput)).toBe(expectedOutput)
      })

      it('should handle edge case', () => {
        expect(fn(edgeCase)).toBe(expectedOutput)
      })
    })

    describe('invalid inputs', () => {
      it('should reject invalid input', () => {
        expect(() => fn(invalidInput)).toThrow()
      })
    })
  })
})
```

### Test Coverage Goals

- **100% line coverage** for utility modules
- **90%+ branch coverage** for handler modules
- **Test all edge cases** including:
  - Null/undefined inputs
  - Empty strings/arrays
  - Boundary values
  - Invalid types
  - Error conditions

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run in watch mode
npm run test:unit:watch

# Generate coverage report
npm run test:unit:coverage

# Run specific test file
npx jest background/utils/__tests__/validation.test.ts
```

### Test Organization

- Place tests in `__tests__/` subdirectory next to source
- Name test files `*.test.ts`
- One test file per source file
- Group related tests with `describe` blocks
- Use descriptive test names starting with "should"

## Security Considerations

### Input Validation
Always validate untrusted input:

```typescript
import { validateConfig } from './utils/validation'
import { validateAPIEndpoint } from './utils/security'

// Validate shape
const config = validateConfig(userInput)

// Validate security
if (!validateAPIEndpoint(config.apiEndpoint)) {
  throw new Error('Invalid API endpoint')
}
```

### SSRF Prevention
Check all external URLs:

```typescript
import { isSSRFSafe } from './utils/security'

if (!isSSRFSafe(url)) {
  return new Response('Blocked', { status: 403 })
}
```

### Message Origin Validation
Verify message senders:

```typescript
import { validateExtensionSender } from './utils/security'

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!validateExtensionSender(sender.id, chrome.runtime.id)) {
    return // Reject message
  }
})
```

### Secure Storage
Use encrypted storage for sensitive data:

```typescript
import { Storage } from "@plasmohq/storage"

const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
})

await secureStorage.set('apiKey', sensitiveData)
```

## Migration from Monolithic background.ts

The original `background.ts` is being refactored into this modular structure. During migration:

1. **Keep both versions** - Don't break existing functionality
2. **Migrate incrementally** - Move one handler at a time
3. **Test thoroughly** - Each migrated module must have 100% test coverage
4. **Update imports** - Change imports to use new modules
5. **Clean up** - Remove code from old file after migration confirmed

## Build Process

Plasmo automatically bundles the background script:

1. Entry point: `background.ts` or `background/index.ts`
2. Plasmo follows imports and bundles all dependencies
3. Output: `build/chrome-mv3-dev/background.js`
4. No manual build configuration needed

## Debugging

Enable debug logging:

```typescript
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

debugLog('[Module] Operation started')
debugWarn('[Module] Potential issue')
debugError('[Module] Error occurred:', error)
```

View logs in:
- Chrome DevTools → Console (background page)
- `chrome://extensions` → Extension details → Inspect views → background page

## Best Practices

1. **Use descriptive names** - Functions and variables should explain themselves
2. **Keep functions small** - Aim for <50 lines per function
3. **Export only what's needed** - Internal helpers should not be exported
4. **Document public APIs** - Use JSDoc for all exported functions
5. **Handle errors gracefully** - Never let errors bubble up silently
6. **Log important events** - Use debug utils for visibility
7. **Write tests first** - TDD helps design better APIs
8. **Follow DRY** - Extract common patterns into utilities
9. **Use TypeScript strictly** - Enable all strict flags
10. **Review before committing** - Self-review catches most issues

## Resources

- [Plasmo Framework Docs](https://docs.plasmo.com/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Zod Documentation](https://zod.dev/)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)
