# Root Cause Found: dataSource: 'customField' Not Supported

## Issue Summary
The URL filtering tests were failing because the plugin's `VariantExtractor.extractAllVariantsForExperiment()` method **does not support `dataSource: 'customField'`**.

## Root Cause Code
**Location**: `/Users/joalves/git_tree/absmartly-sdk-plugins/src/parsers/VariantExtractor.ts:186-190`

```typescript
} else {
  // For custom field, we would need to handle it per experiment
  // This is a limitation of the current approach when extracting all variants
  continue;  // ← SKIPS ALL VARIANTS WHEN dataSource === 'customField'
}
```

## What This Means

When the plugin is initialized with `dataSource: 'customField'`:
1. The plugin calls `variantExtractor.extractAllChanges()`
2. For each experiment, it calls `extractAllVariantsForExperiment()`
3. This method checks `if (this.dataSource === 'variable')`
4. When dataSource is 'customField', it hits the `else` block and **continues** (skips the variant)
5. No variants are extracted = no changes are ever applied
6. `context.customFieldValue()` is **never called**

## Solution

Use `dataSource: 'variable'` and put data in `variant.config`:

### Working Configuration

```typescript
// SDK Mock
{
  experiments: [{
    name: 'test_exp',
    variants: [
      {
        config: JSON.stringify({
          __dom_changes: []  // Control variant
        })
      },
      {
        config: JSON.stringify({
          __dom_changes: {
            changes: [{ ... }],
            urlFilter: { ... }
          }
        })
      }
    ]
  }]
}

// Plugin Config
new DOMChangesPlugin({
  context,
  autoApply: true,
  spa: true,
  dataSource: 'variable', // ← MUST BE 'variable', not 'customField'
  dataFieldName: '__dom_changes',
  debug: true
})
```

## Test Results

✅ All 3 tests passing with `dataSource: 'variable'`:
- Basic plugin functionality without URL filter
- URL filtering with path match (/products/*)
- URL filtering excludes non-matching URLs (/about)

## Files Updated

- Created `url-filtering-working.spec.ts` with working tests
- Updated plugin file from stale Oct 1 build to fresh Oct 7 build
- Documented root cause for future reference

## Plugin Limitation

The plugin currently **cannot** use `dataSource: 'customField'` for extracting all variants. This is a known limitation mentioned in the code comments. The plugin only supports:

1. **dataSource: 'variable'** with data in:
   - `variant.variables[dataFieldName]` (preferred)
   - `variant.config[dataFieldName]` (fallback)

2. **dataSource: 'customField'** is:
   - Not implemented in `extractAllVariantsForExperiment()`
   - Would require calling `context.customFieldValue()` for each experiment
   - Currently skipped with `continue` statement

## Next Steps

The original test file needs to be updated to use `dataSource: 'variable'` instead of `dataSource: 'customField'`.
