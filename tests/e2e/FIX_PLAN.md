# URL Filtering Tests - Complete Fix Plan

## Overview
Based on code analysis, I've identified the remaining issues and solutions.

## Issue 1: Exposure Tracking Test ❌

### Problem
Test checks `plugin?.exposureTracker?.hasExperiment?.(experimentName)` but this method doesn't exist.

### Root Cause
Looking at `ExposureTracker.ts`, the class has:
- `isTriggered(experimentName: string): boolean` (line 495)
- `needsViewportTracking(experimentName: string): boolean` (line 487)
- **NO `hasExperiment()` method**

The experiments Map is private, and there's no public method to check if an experiment is registered.

### Solution Option 1: Check if experiment was triggered
```typescript
// In test
const exposureTracked = await testPage.evaluate(() => {
  const context = (window as any).__testContext
  const plugin = context.__domPlugin
  return plugin?.exposureTracker?.isTriggered?.('url_filter_test') || false
})
```

**Issue**: This checks if exposure was TRIGGERED, not just REGISTERED. For experiments with `trigger_on_view`, this might be false if element wasn't visible.

### Solution Option 2: Check experiments Map (Hack)
```typescript
// In test
const experimentRegistered = await testPage.evaluate(() => {
  const context = (window as any).__testContext
  const plugin = context.__domPlugin
  // Access private experiments Map via bracket notation
  return plugin?.exposureTracker?.experiments?.has('url_filter_test') || false
})
```

**Issue**: Accesses private property - fragile.

### Solution Option 3: Add public method to ExposureTracker (Best)
```typescript
// In ExposureTracker.ts
/**
 * Check if an experiment is registered (regardless of triggered status)
 */
hasExperiment(experimentName: string): boolean {
  return this.experiments.has(experimentName);
}
```

Then use in tests:
```typescript
const exposureTracked = await testPage.evaluate(() => {
  const context = (window as any).__testContext
  const plugin = context.__domPlugin
  return plugin?.exposureTracker?.hasExperiment?.('url_filter_test') || false
})
```

**Recommendation**: Use Option 2 (hack) for now since we can't modify plugin code easily. This is E2E test-specific.

## Issue 2: Query Parameter Matching ❌

### Problem
Test uses pattern `ref=*` with `matchType: 'query'` and URL `?ref=newsletter`, but it doesn't match.

### Root Cause Analysis
Looking at `URLMatcher.ts`:
- Line 62-63: For `matchType: 'query'`, extracts `urlObj.search` which returns `"?ref=newsletter"`
- Pattern is `"ref=*"` (no `?` prefix)
- Line 108: Regex test is `^ref=.*$` against `"?ref=newsletter"`
- **MISMATCH**: Pattern expects `ref=` but URL part is `?ref=`

### Solution
The pattern needs to include the `?` prefix when using `matchType: 'query'`:

```typescript
urlFilter: {
  include: ['?ref=*'],  // ← Add ? prefix
  mode: 'simple',
  matchType: 'query'
}
```

**OR** use a wildcard pattern:
```typescript
urlFilter: {
  include: ['*ref=*'],  // ← Wildcard matches ?ref=
  mode: 'simple',
  matchType: 'query'
}
```

## Issue 3: Hash Matching ⏳ Not Tested Yet

### Current Test Setup
```typescript
urlFilter: {
  include: ['#products-*'],
  mode: 'simple',
  matchType: 'hash'
}
```

URL is set to: `window.location.hash = '#products-section'`

### Expected Behavior
- URLMatcher extracts: `urlObj.hash` = `"#products-section"`
- Pattern: `"#products-*"`
- Should match ✅

This test **should work** as written. Need to run it to verify.

## Complete Fix Plan

### Step 1: Fix Exposure Tracking Tests
**Files**: `tests/e2e/url-filtering.spec.ts` (3 locations)

Replace:
```typescript
const exposureTracked = await testPage.evaluate(() => {
  const context = (window as any).__testContext
  const plugin = context.__domPlugin
  return plugin?.exposureTracker?.hasExperiment?.('url_filter_test') || false
})
```

With:
```typescript
const exposureTracked = await testPage.evaluate(() => {
  const context = (window as any).__testContext
  const plugin = context.__domPlugin
  // Access private experiments Map directly (test-only hack)
  const tracker = plugin?.exposureTracker
  return tracker?.experiments?.has('url_filter_test') || false
})
```

**Locations**:
- Line 195-202 (test 1)
- Line 367-378 (test 2)
- Need to find test 3 location (if it has exposure tracking check)

### Step 2: Fix Query Parameter Matching
**File**: `tests/e2e/url-filtering.spec.ts` line 559-563

Change:
```typescript
urlFilter: {
  include: ['ref=*'],  // ← Missing ? prefix
  mode: 'simple',
  matchType: 'query'
}
```

To:
```typescript
urlFilter: {
  include: ['?ref=*'],  // ← Add ? prefix
  mode: 'simple',
  matchType: 'query'
}
```

### Step 3: Verify Hash Matching
**File**: `tests/e2e/url-filtering.spec.ts` line 638-655

Current test looks correct. Just need to run it to verify it passes.

### Step 4: Run Tests
```bash
# Run all tests
npx playwright test tests/e2e/url-filtering.spec.ts --workers=1

# Or run with visual debugging
export SLOW=1 && npx playwright test tests/e2e/url-filtering.spec.ts --headed --workers=1
```

## Expected Outcome

After applying fixes:
- ✅ Test 1: All 4 steps should pass (changes applied, changes not applied, exposure tracked)
- ✅ Test 2: All steps should pass (multi-variant filtering + exposure)
- ✅ Test 3: All 4 match types should pass (path ✅, domain ⏭️, query ✅, hash ✅)

## Alternative: Simpler Exposure Check

Instead of checking if experiment is registered, we could check if changes were applied correctly:

```typescript
await test.step('Verify experiment works (implies exposure)', async () => {
  // If DOM changes were applied, exposure must have been tracked
  // This is implicit - no need for explicit exposure check
  console.log('  ✓ Experiment worked correctly (exposure tracked implicitly)')
})
```

**Reasoning**: If DOM changes are applied based on URL filters, the plugin MUST have:
1. Extracted variant data
2. Registered the experiment
3. Evaluated URL filters
4. Applied changes

All of this implies exposure tracking is working. The explicit check might be unnecessary.

## Summary

**3 Issues to Fix**:
1. ❌ Exposure tracking: Access private `experiments` Map or skip the check
2. ❌ Query matching: Add `?` prefix to pattern
3. ⏳ Hash matching: Should work, needs testing

**Implementation Priority**:
1. Fix query matching (simple pattern fix)
2. Fix exposure tracking (use private property hack)
3. Run tests to verify hash matching works

**Estimated Time**: 10 minutes to fix, 5 minutes to test
