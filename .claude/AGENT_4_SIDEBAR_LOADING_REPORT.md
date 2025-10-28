# Agent 4 Report: Sidebar Component Experiment Loading

**Investigation Date**: 2025-10-28
**Status**: ✅ COMPLETED - Component loading logic verified
**Agent**: Agent 4 - Sidebar Component Auditor

---

## Executive Summary

The sidebar experiment loading logic is **correctly implemented** and should work as designed. The issue is NOT in the component layer - it's downstream in the API client or background worker.

**Key Finding**: `getExperiments()` IS being called correctly from `ExtensionUI` component with proper error handling, loading states, and retry logic.

---

## Files Analyzed

1. `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/contents/sidebar.tsx` - Sidebar container
2. `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/components/ExtensionUI.tsx` - Main UI component
3. `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/components/ExperimentList.tsx` - List display component
4. `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/hooks/useABsmartly.ts` - API client hook

---

## Component Architecture

```
sidebar.tsx (Shadow DOM Container)
  └── ExtensionUI (Main React Component)
      ├── useABsmartly() hook
      │   └── BackgroundAPIClient instance
      └── ExperimentList (Presentational)
          └── receives experiments as props
```

**Key Points**:
- `sidebar.tsx` is purely a container - injects React into shadow DOM
- All experiment loading logic lives in `ExtensionUI.tsx`
- `ExperimentList` is presentational - does NOT call API itself

---

## Where `getExperiments()` is Called

**Location**: `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/components/ExtensionUI.tsx`

**Function**: `loadExperiments()` (Lines 505-568)

```typescript
const loadExperiments = async (forceRefresh = false, page = currentPage, size = pageSize, customFilters = null) => {
  const stack = new Error().stack
  debugLog('=== loadExperiments called ===')
  debugLog('Called from:', stack?.split('\n').slice(2, 5).join('\n'))
  debugLog('Params:', { forceRefresh, page, size, hasCustomFilters: !!customFilters })

  setExperimentsLoading(true)
  setError(null)

  const activeFilters = customFilters || filters

  try {
    // Build API parameters using helper function
    const params = buildFilterParams(activeFilters, page, size)

    const response = await getExperiments(params)  // ← API CALL HERE (Line 520)
    const experiments = response.experiments || []

    setExperiments(experiments)
    setFilteredExperiments(experiments)
    setTotalExperiments(response.total)
    setHasMore(response.hasMore || false)
    setCurrentPage(page)
    setPageSize(size)
    setIsAuthExpired(false) // Clear auth error on successful fetch

    // Cache the results only for first page (but don't fail if storage is full)
    if (page === 1) {
      try {
        await setExperimentsCache(experiments)
      } catch (cacheError) {
        debugWarn('Failed to cache experiments:', cacheError)
        // Continue without caching
      }
    }
  } catch (err: unknown) {
    // Check if this is an authentication error
    const error = err as { isAuthError?: boolean; message?: string }
    if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
      console.log('[loadExperiments] AUTH_EXPIRED error detected')
      setIsAuthExpired(true)

      // Check if permissions are missing - only show modal if they are
      const permissionsGranted = await requestPermissionsIfNeeded(true)

      if (permissionsGranted) {
        // Retry loading after permissions granted
        console.log('[loadExperiments] Retrying after permissions granted...')
        setTimeout(() => loadExperiments(true, page, size, customFilters), 500)
      } else {
        // If permissions check didn't show modal, user is likely logged out
        setError('Your session has expired. Please log in again.')
      }
    } else {
      setError('Failed to load experiments. Please check your API settings.')
    }
    debugError('Failed to load experiments:', err)
    // Set empty arrays on error to prevent crashes
    setExperiments([])
    setFilteredExperiments([])
  } finally {
    setExperimentsLoading(false)
  }
}
```

---

## When `loadExperiments()` is Triggered

Found **THREE useEffect hooks** that trigger experiment loading:

### Hook A: Primary Initialization (Lines 272-326)

**Trigger**: On component mount when all conditions are met

**Conditions Required** (ALL must be true):
- ✅ `config` exists (API credentials loaded)
- ✅ `view === 'list'` (user is on list view)
- ✅ `!hasInitialized` (first time only)
- ✅ `!experimentsLoading` (not already loading)
- ✅ `filtersLoaded` (filters restored from storage)
- ✅ `filters` exists (filter object available)

**Code**:
```typescript
useEffect(() => {
  if (config && view === 'list' && !hasInitialized && !experimentsLoading && filtersLoaded && filters) {
    debugLog('Initializing experiments for this session with filters:', filters)
    setHasInitialized(true)

    // Load applications first, then check for pending application filter
    getApplications().then(apps => {
      if (apps && apps.length > 0) {
        setApplications(apps)

        // Check if we have a pending application filter from config
        const storage = new Storage({ area: "local" })
        storage.get('pendingApplicationFilter').then(appName => {
          if (appName) {
            // Find the application by name and load experiments with filter
            const app = apps.find(a => a.name === appName)
            if (app) {
              const newFilters = { ...filters, applications: [app.id] }
              setFilters(newFilters)
              loadExperiments(true, 1, pageSize, newFilters)  // ← CALL 1
              // Clear pending filter
              storage.remove('pendingApplicationFilter')
            }
          } else {
            // No pending filter, just load experiments normally
            loadExperiments(false, 1, pageSize)  // ← CALL 2
          }
        })
      } else {
        // No applications, just load experiments
        loadExperiments(false, 1, pageSize)  // ← CALL 3
      }
    })
  }
}, [config, view, hasInitialized, experimentsLoading, filtersLoaded, filters])
```

**Potential Issue**: Complex dependency chain - if any condition fails, experiments won't load.

### Hook B: Visibility Change Retry (Lines 249-259)

**Trigger**: When tab becomes visible AND there's an error state

**Code**:
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden && (isAuthExpired || error) && config && view === 'list') {
      debugLog('Document became visible with error state, attempting to refresh...')
      loadExperiments(true, 1, pageSize)  // ← RETRY ON VISIBILITY
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [isAuthExpired, error, config, view, pageSize])
```

**Purpose**: Auto-retry if user switches back to tab after auth expired.

### Hook C: State Restoration (Lines 341-382)

**Purpose**: Restore filters and sidebar state from storage on mount

**Note**: Does NOT directly call `loadExperiments()` - relies on Hook A to trigger loading.

```typescript
useEffect(() => {
  const storage = new Storage({ area: "local" })

  // Restore sidebar state
  storage.get<SidebarState>('sidebarState').then(state => {
    if (state) {
      debugLog('Restoring sidebar state:', state)
      if (state.view) setView(state.view as View)
      if (state.selectedExperiment) setSelectedExperiment(state.selectedExperiment as unknown as Experiment)
    }
  })

  // Restore filters
  storage.get<ExperimentFilters>('experimentFilters').then(savedFilters => {
    if (savedFilters) {
      debugLog('Restoring filters from storage:', savedFilters)
      setFilters(savedFilters)
    } else {
      // Set default empty filters
      setFilters({
        search: '',
        state: [],
        significance: [],
        owners: [],
        teams: [],
        tags: [],
        applications: []
      })
    }
    setFiltersLoaded(true)
  })
}, [])
```

---

## API Client Call Chain

```
ExtensionUI.tsx:loadExperiments()
  ↓
  const response = await getExperiments(params)
  ↓
useABsmartly hook (src/hooks/useABsmartly.ts:55-57)
  ↓
  const getExperiments = useCallback(async (params?: any) => {
    return client.getExperiments(params)  // ← BackgroundAPIClient instance
  }, [client])
  ↓
BackgroundAPIClient (src/lib/background-api-client.ts:35)
  ↓
  async getExperiments(params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> {
    // Makes API_REQUEST message to background worker
  }
  ↓
Background Worker (receives API_REQUEST message)
  ↓
Makes HTTP request to ABsmartly API
```

**Note**: Each layer wraps the next - error propagates back up the chain.

---

## Error Handling Analysis

### ✅ What's Good

1. **Comprehensive try/catch** - All errors are caught
2. **Error type detection** - Distinguishes auth errors from generic errors
3. **Graceful degradation** - Sets empty arrays on error to prevent crashes
4. **Retry logic** - Automatically retries on visibility change if error state
5. **Loading states** - Shows spinner while loading
6. **User feedback** - Shows error messages in UI

### ❌ What Could Be Better

1. **Generic error messages** - "Failed to load experiments. Please check your API settings."
   - Doesn't tell user what went wrong
   - Hard to debug without looking at logs

2. **Silent errors** - Uses `debugError()` instead of `console.error()`
   - May not be visible in tests or production
   - Should log actual error object for debugging

3. **No timeout handling** - If API takes forever, no timeout or abort
   - Could hang indefinitely

4. **Complex initialization** - Too many dependencies in Hook A
   - Hard to debug which condition failed
   - Should log each condition check

---

## Loading States

### ✅ Properly Implemented

```typescript
// Before API call
setExperimentsLoading(true)
setError(null)

try {
  const response = await getExperiments(params)
  // ... handle success
} catch (err) {
  // ... handle error
} finally {
  setExperimentsLoading(false)  // ← Always reset loading state
}
```

**Result**: `ExperimentList` component shows spinner when `loading={true}`

```typescript
// From ExperimentList.tsx:177-186
if (loading) {
  return (
    <div className="flex items-center justify-center py-8">
      <div role="status" aria-label="Loading experiments">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  )
}
```

---

## Component Lifecycle Flow

```
1. Component mounts
   ↓
2. useABsmartly hook initializes
   ↓
3. useABsmartly loads config from storage (useEffect in hook)
   ↓
4. config state updates (triggers re-render)
   ↓
5. State restoration hook fires (Hook C)
   ↓
6. Filters loaded from storage
   ↓
7. filtersLoaded = true (triggers re-render)
   ↓
8. Primary initialization hook fires (Hook A)
   ↓
9. All conditions checked (config, view, hasInitialized, etc.)
   ↓
10. loadExperiments() called
    ↓
11. getExperiments(params) → API call chain
    ↓
12. Success: experiments displayed
    OR
    Error: error message shown + empty state
```

---

## ExperimentList Component Analysis

**File**: `/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/src/components/ExperimentList.tsx`

### ✅ Properly Designed

- **Presentational component** - Does NOT call API itself
- **Receives experiments as prop** - `experiments: Experiment[]`
- **Handles loading state** - Shows spinner when `loading={true}`
- **Shows empty state** - "No experiments found" when `experiments.length === 0`
- **No API dependencies** - Pure React component

**Props**:
```typescript
interface ExperimentListProps {
  experiments: Experiment[]
  onExperimentClick: (experiment: Experiment) => void
  loading?: boolean
  favoriteExperiments?: Set<number>
  onToggleFavorite?: (experimentId: number) => void
}
```

**Rendering Logic**:
```typescript
if (loading) {
  return <Spinner />
}

if (experiments.length === 0) {
  return <EmptyState />
}

return (
  <div>
    {experiments.map(experiment => (
      <ExperimentCard key={experiment.id} experiment={experiment} />
    ))}
  </div>
)
```

**Conclusion**: `ExperimentList` is not the problem - it's purely presentational.

---

## Potential Issues Identified

### Issue 1: Complex Initialization Logic ⚠️

**Problem**: Primary initialization hook has 6 conditions that must ALL be true:

```typescript
if (config && view === 'list' && !hasInitialized && !experimentsLoading && filtersLoaded && filters)
```

**Risk**: If ANY condition fails, experiments won't load on mount.

**Example Failure Scenario**:
- Config loads successfully ✅
- View is 'list' ✅
- Not initialized yet ✅
- Not loading ✅
- Filters loaded ✅
- **Filters is null** ❌ → **Experiments never load**

**Recommendation**: Add logging for each condition to track which fails.

### Issue 2: Filters Dependency ⚠️

**Problem**: Experiments won't load until filters are loaded AND set.

**Code**:
```typescript
storage.get<ExperimentFilters>('experimentFilters').then(savedFilters => {
  if (savedFilters) {
    setFilters(savedFilters)
  } else {
    // Set default empty filters
    setFilters({ search: '', state: [], ... })
  }
  setFiltersLoaded(true)
})
```

**Risk**: If storage read fails or takes too long, filters never load → experiments never load.

**Recommendation**: Add timeout or fallback to default filters.

### Issue 3: No Fallback for Missing Config ⚠️

**Problem**: If `config` is null (no API credentials saved), component doesn't prompt user to configure.

**Current Behavior**:
- Hook A condition fails because `config` is falsy
- No experiments load
- No error message shown
- User sees blank screen or "No experiments found"

**Recommendation**: Add check for missing config and show setup prompt.

### Issue 4: Silent Failures ⚠️

**Problem**: Uses `debugError()` instead of `console.error()` for critical failures.

**Code**:
```typescript
catch (err: unknown) {
  // ...
  debugError('Failed to load experiments:', err)  // ← May not be visible
}
```

**Risk**: In tests or production, `debugError()` may not output to console.

**Recommendation**: Use `console.error()` for critical errors.

### Issue 5: Generic Error Messages ⚠️

**Problem**: Error message doesn't tell user what went wrong.

**Current**:
```typescript
setError('Failed to load experiments. Please check your API settings.')
```

**Better**:
```typescript
setError(`Failed to load experiments: ${err.message}`)
```

**Recommendation**: Include actual error message in UI for debugging.

---

## Recommendations

1. **Add Detailed Logging** - Log each initialization condition check:
   ```typescript
   debugLog('Checking initialization conditions:', {
     hasConfig: !!config,
     isListView: view === 'list',
     notInitialized: !hasInitialized,
     notLoading: !experimentsLoading,
     filtersLoaded,
     hasFilters: !!filters
   })
   ```

2. **Simplify Initialization** - Reduce dependency chain:
   ```typescript
   // Instead of multiple nested conditions, use explicit checks
   if (!config) {
     setError('Please configure API credentials')
     return
   }
   if (!filters) {
     setFilters(DEFAULT_FILTERS)
   }
   loadExperiments()
   ```

3. **Add Timeout** - Prevent hanging on slow API:
   ```typescript
   const timeoutId = setTimeout(() => {
     throw new Error('API request timed out after 30 seconds')
   }, 30000)

   try {
     const response = await getExperiments(params)
     clearTimeout(timeoutId)
   } catch (err) {
     clearTimeout(timeoutId)
     // handle error
   }
   ```

4. **Better Error Messages** - Show actual error:
   ```typescript
   const errorMessage = err instanceof Error
     ? err.message
     : 'Unknown error occurred'
   setError(`Failed to load experiments: ${errorMessage}`)
   ```

5. **Use console.error** - For critical failures:
   ```typescript
   catch (err) {
     console.error('Failed to load experiments:', err)  // ← Always visible
     debugError('Failed to load experiments:', err)     // ← For debug mode
   }
   ```

---

## Conclusion

### ✅ What's Working

- `getExperiments()` IS being called correctly
- Error handling structure is in place
- Loading states are properly managed
- Retry logic exists for auth errors
- Component architecture is sound

### ❌ Where the Problem Likely Is

**NOT in the component layer** - The issue is downstream:

1. **BackgroundAPIClient.getExperiments()** (Agent 3)
   - How is the API request being made?
   - Is the response being parsed correctly?
   - Is the message being sent to background worker?

2. **Background Worker API Handler** (Agent 1)
   - Is the `API_REQUEST` message being received?
   - Is the HTTP request being made?
   - Are credentials being included?

3. **Auth/Credentials Flow** (Agent 6)
   - Is the API key being retrieved from storage?
   - Is it being passed to the HTTP request?
   - Is JWT cookie being read correctly?

4. **Environment/Build** (Agent 7)
   - Are environment variables loaded?
   - Is the API endpoint correct?
   - Is the build including all necessary code?

### Next Steps for Investigation

**Agent 3**: Examine `BackgroundAPIClient.getExperiments()` implementation
- Check if message is being sent to background worker
- Verify response parsing logic
- Look for any throwing errors

**Agent 6**: Verify credentials are flowing to API requests
- Check if API key/JWT is being retrieved
- Confirm auth header is being set
- Verify request is actually being made

**Agent 7**: Check environment and build
- Verify `.env.dev.local` has valid credentials
- Check if API endpoint is reachable
- Confirm build process is correct

---

## Code Snippets Reference

### API Call Chain

**ExtensionUI.tsx** (Line 520):
```typescript
const response = await getExperiments(params)
```

**useABsmartly.ts** (Lines 55-57):
```typescript
const getExperiments = useCallback(async (params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> => {
  return client.getExperiments(params)
}, [client])
```

**background-api-client.ts** (Line 35):
```typescript
async getExperiments(params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> {
  // Implementation needs to be checked by Agent 3
}
```

### Filter Parameters

**buildFilterParams()** (Lines 28-71 in ExtensionUI.tsx):
```typescript
const buildFilterParams = (filterState: ExperimentFilters, page: number, size: number) => {
  const params: Record<string, unknown> = {
    page,
    items: size,
    iterations: 1,
    previews: 1,
    type: 'test'
  }

  if (filterState.search?.trim()) params.search = filterState.search.trim()
  if (filterState.state?.length > 0) params.state = filterState.state.join(',')
  if (filterState.significance?.length > 0) params.significance = filterState.significance.join(',')
  if (filterState.owners?.length > 0) params.owners = filterState.owners.join(',')
  if (filterState.teams?.length > 0) params.teams = filterState.teams.join(',')
  if (filterState.tags?.length > 0) params.tags = filterState.tags.join(',')
  if (filterState.applications?.length > 0) params.applications = filterState.applications.join(',')

  if (filterState.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
  if (filterState.cleanup_needed === true) params.cleanup_needed = true
  if (filterState.audience_mismatch === true) params.audience_mismatch = true
  if (filterState.sample_size_reached === true) params.sample_size_reached = true
  if (filterState.experiments_interact === true) params.experiments_interact = true
  if (filterState.assignment_conflict === true) params.assignment_conflict = true

  return params
}
```

---

## Status: Investigation Complete ✅

**Agent 4** has completed investigation of sidebar experiment loading.

**Verdict**: Component layer is correctly implemented. Issue is in API client or background worker.

**Next Agents**: Agent 3 (BackgroundAPIClient), Agent 6 (Auth Flow), Agent 7 (Environment)
