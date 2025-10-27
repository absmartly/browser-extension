# Unit Tests for Claude API Communication and OAuth

This document describes the comprehensive unit test suite for Claude API communication, OAuth authentication, and message bridge functionality in the ABsmartly browser extension.

## Test Files Overview

### 1. AI DOM Generator Tests (`src/lib/__tests__/ai-dom-generator.test.ts`)

Comprehensive tests for the Claude API integration that generates DOM changes from user prompts.

**Key Test Cases:**
- ✅ Basic DOM change generation from Claude responses
- ✅ Markdown code block handling (with and without backticks)
- ✅ HTML content slicing (max 50K characters)
- ✅ API key validation and error handling
- ✅ Response type validation
- ✅ JSON parsing and error recovery
- ✅ Multiple DOM changes generation
- ✅ Claude API error propagation
- ✅ Anthropic client initialization with dangerouslyAllowBrowser flag
- ✅ Edge cases: empty HTML, empty prompts

**Coverage:**
- Response format variations
- Error scenarios
- Token limits
- Edge cases

**Run Tests:**
```bash
npm test -- src/lib/__tests__/ai-dom-generator.test.ts
```

### 2. OAuth Authentication Tests (`src/utils/__tests__/oauth.test.ts`)

Complete OAuth 2.0 flow testing including authorization, token exchange, refresh, and revocation.

**Key Test Cases:**

#### Authorization Flow
- ✅ Generate authorization URL with correct parameters
- ✅ Handle multiple OAuth scopes
- ✅ Generate unique state values for CSRF protection
- ✅ Properly encode redirect URIs

#### Token Exchange
- ✅ Exchange authorization code for access token
- ✅ Handle token endpoint errors
- ✅ Invalid authorization code handling
- ✅ Token expiration time calculation

#### State Validation
- ✅ Validate correct state parameters
- ✅ Reject mismatched state
- ✅ Reject missing state
- ✅ Clear state after validation

#### Token Refresh
- ✅ Refresh expired tokens using refresh token
- ✅ Handle invalid refresh tokens
- ✅ Network error handling

#### Token Revocation
- ✅ Revoke access tokens
- ✅ Revoke refresh tokens
- ✅ Handle revocation errors

#### Token Storage
- ✅ Secure token storage
- ✅ Token expiration detection

**Coverage:**
- Full OAuth 2.0 authorization code flow
- Security validations (CSRF, token validation)
- Error handling and recovery
- Token lifecycle management

**Run Tests:**
```bash
npm test -- src/utils/__tests__/oauth.test.ts
```

### 3. Message Bridge Tests (`src/utils/__tests__/message-bridge.test.ts`)

Tests for the unified message bridge that handles both production (chrome.runtime) and test (window.postMessage) communication.

**Key Test Cases:**

#### Bridge Initialization
- ✅ Production mode initialization with chrome.runtime
- ✅ Test mode initialization with window.postMessage

#### Message Sending
- ✅ Send messages in production mode
- ✅ Send messages in test mode
- ✅ Handle fire-and-forget messaging

#### AI Features
- ✅ Handle AI_GENERATE_DOM_CHANGES messages
- ✅ Handle CAPTURE_HTML messages
- ✅ Propagate AI generation errors

#### Timeouts
- ✅ Timeout long-running requests
- ✅ Custom timeout values
- ✅ No timeout for successful messages

#### Response Handling
- ✅ Handle response callbacks
- ✅ Track multiple concurrent messages
- ✅ Malformed response handling

#### Test Mode
- ✅ Route messages through iframe
- ✅ Handle postMessage errors
- ✅ Differentiate message sources

#### Error Handling
- ✅ Handle chrome.runtime errors
- ✅ Handle missing message listeners
- ✅ Graceful error recovery

#### Listener Setup
- ✅ Register message listeners in production
- ✅ Handle incoming messages in test mode

#### Performance
- ✅ Handle rapid consecutive messages
- ✅ Clean up completed handlers

**Coverage:**
- Both production and test environments
- Message routing and delivery
- Error scenarios and recovery
- Performance under load

**Run Tests:**
```bash
npm test -- src/utils/__tests__/message-bridge.test.ts
```

## Running All Tests

### Run All Unit Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- src/lib/__tests__/ai-dom-generator.test.ts
npm test -- src/utils/__tests__/oauth.test.ts
npm test -- src/utils/__tests__/message-bridge.test.ts
```

### Watch Mode (Re-run on Changes)
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm test -- --coverage
```

### Verbose Output
```bash
npm test -- --verbose
```

## Test Structure

All tests follow Jest conventions:
- Organized with `describe()` blocks for logical grouping
- Clear `it()` test cases with descriptive names
- Mocked external dependencies (axios, Anthropic SDK, chrome APIs)
- Setup/teardown with `beforeEach()` and `afterEach()`
- Proper error assertion with `rejects.toThrow()`

## Mocking Strategy

### API Mocking
- `axios` - Mocked for HTTP requests
- `@anthropic-ai/sdk` - Mocked for Claude API calls
- `chrome.runtime` - Mocked for message passing
- `chrome.cookies` - Mocked for cookie access
- Debug utilities - Mocked to avoid console spam

### localStorage
- Cleared before each test
- Used for OAuth state validation

### Global Objects
- `chrome` - Full mock implementation
- `window` - Partial mock for postMessage and addEventListener

## Key Testing Patterns

### 1. Async/Await Testing
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toEqual(expectedValue)
})
```

### 2. Error Testing
```typescript
it('should throw on invalid input', async () => {
  await expect(functionThatThrows()).rejects.toThrow('Error message')
})
```

### 3. Mock Verification
```typescript
expect(mockFn).toHaveBeenCalledWith(
  expect.objectContaining({
    expectedProp: 'expectedValue'
  })
)
```

### 4. Timeout Testing
```typescript
const startTime = Date.now()
await operation()
const elapsed = Date.now() - startTime
expect(elapsed).toBeGreaterThanOrEqual(expectedTimeout)
```

## OAuth Implementation Notes

The tests validate a complete OAuth 2.0 authorization code flow:

1. **Authorization Request**: User is redirected to authorization endpoint
2. **Authorization Grant**: User approves and receives authorization code
3. **Token Exchange**: Authorization code is exchanged for access token
4. **State Validation**: CSRF protection via state parameter verification
5. **Token Refresh**: Expired tokens are refreshed using refresh token
6. **Token Revocation**: Users can revoke access

### Security Features Tested
- State parameter generation and validation (CSRF protection)
- Authorization code validation
- Token expiration detection
- Secure token storage
- Proper error handling for auth failures

## Improvements Made

### From Existing Tests
- Extended error handling test coverage
- Added performance tests for concurrent messaging
- Improved edge case handling
- Better separation of concerns

### New Features Added
- Comprehensive OAuth test suite (previously missing)
- Message bridge timeout testing
- Test/production mode differentiation
- Response callback handling tests

## Future Enhancements

Potential areas for expansion:
1. Integration tests with real APIs (disabled by default)
2. Performance benchmarking
3. End-to-end OAuth flow with UI automation
4. Security vulnerability scanning
5. Mutation testing for better coverage
6. Contract testing with API specifications

## Troubleshooting

### Test Failures
1. Check that all mocks are properly cleared with `jest.clearAllMocks()`
2. Verify async operations with `async/await`
3. Check timeout settings for long-running tests
4. Review console errors with `--verbose` flag

### Coverage Gaps
Run: `npm test -- --coverage` to identify untested code paths

### Mock Issues
Ensure mocks are set up in `beforeEach()` and not persisting between tests

## CI/CD Integration

These tests are ready for:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI

All tests should pass before merging to main branch.
