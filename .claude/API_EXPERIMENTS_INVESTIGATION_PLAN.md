# API Experiments Loading Investigation Plan

## Problem Statement

Tests are failing because experiments cannot be loaded from the API:
- Visual editor tests that work correctly can load experiments
- Sidebar tests cannot load experiments from the API
- The API has a bunch of experiments available
- Visual editor tests demonstrate the sidebar injection pattern works correctly

## Key Insight

The VE tests load experiments successfully, meaning:
- The API credentials are being set correctly
- The sidebar is being injected correctly
- The message passing is working

But tests like `api-integration.spec.ts` fail with "sidebar shows experiments after API call" - suggesting the API request itself might be failing or the response isn't being handled correctly.

## Investigation Hypothesis

1. **API Request Handler Missing**: The background service worker might not be properly handling `API_REQUEST` messages
2. **Message Format Issue**: The message format from sidebar to background might be incorrect
3. **Response Format Issue**: The API response format might not match what the sidebar expects
4. **Auth Token Issue**: The API key might not be passed correctly to the background worker
5. **CORS/Network Issue**: The request might be failing at the network level

## Investigation Approach

### Phase 1: Identify the Root Cause (Quick diagnostic)
- Check `src/background/message-adapter.ts` for `API_REQUEST` handler
- Verify the API key is being passed to the background worker
- Check if experiments list is being loaded in the sidebar component
- Review error logs from failing tests

### Phase 2: Fix the Root Cause (Based on findings)
- If handler missing: Add handler to message-adapter.ts
- If message format wrong: Update BackgroundAPIClient.makeRequest()
- If response format wrong: Update response parsing in BackgroundAPIClient.getExperiments()
- If auth wrong: Verify token passing in background service worker
- If network issue: Check API endpoint configuration

### Phase 3: Verify Fixes
- Run api-integration.spec.ts to confirm experiments load
- Run all tests to ensure no regressions
- Verify visual editor tests still pass

## Expected Outcome

After fixes:
- Tests that create API requests for experiments will succeed
- Sidebar will display experiments when API is called
- All 19 currently failing tests should be fixable with proper API integration

## Files to Investigate

Primary:
- `src/background/message-adapter.ts` - Message handling
- `src/lib/background-api-client.ts` - API request code
- `tests/e2e/api-integration.spec.ts` - Failing test

Secondary:
- `src/tabs/sidebar.tsx` - Sidebar component using API
- `src/components/ExperimentList.tsx` - Experiment listing

## Questions for Agents

When working through this:
1. Is the `API_REQUEST` message handler present in message-adapter.ts?
2. Does the handler make the actual API call?
3. Is the response being returned correctly?
4. Is the sidebar component calling `getExperiments()` correctly?
5. Are error logs showing any auth or network errors?

## Success Metrics

✅ api-integration.spec.ts "sidebar shows experiments after API call" passes
✅ All tests that depend on experiments pass
✅ Visual editor tests still pass
✅ No new test failures introduced
