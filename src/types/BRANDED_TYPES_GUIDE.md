# Branded Types Implementation Guide

## Overview

This project uses **branded types** to prevent primitive type confusion and add runtime validation for domain primitives. Branded types provide compile-time type safety while being zero-cost at runtime.

## What are Branded Types?

Branded types are TypeScript's way of creating distinct types from primitive types to prevent accidental misuse:

```typescript
// WITHOUT branded types - easy to mix up
function updateExperiment(experimentId: number, applicationId: number) { }
updateExperiment(123, 456)  // Which is which? Easy to swap!

// WITH branded types - compiler prevents confusion
function updateExperiment(experimentId: ExperimentId, applicationId: ApplicationId) { }
updateExperiment(experimentId(123), applicationId(456))  // Clear and safe!
```

## Available Branded Types

Located in `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/branded.ts`:

### Numeric IDs
- **ExperimentId** - Must be positive integer
- **ApplicationId** - Must be positive integer

### String Identifiers
- **VariantName** - Non-empty string (trimmed)
- **ConversationId** - Non-empty string (trimmed)
- **SessionId** - Non-empty string (trimmed)

### Selectors
- **CSSSelector** - Valid CSS selector syntax
- **XPathSelector** - Non-empty XPath string

### URLs
- **APIEndpoint** - Valid HTTP/HTTPS URL

## Constructor Functions

### Safe Constructors (with validation)

Use these when creating branded values from user input or untrusted sources:

```typescript
import { experimentId, cssSelector, apiEndpoint } from '~src/types/branded'

const expId = experimentId(42)

const selector = cssSelector('.button')

const endpoint = apiEndpoint('https://api.absmartly.com')
```

All safe constructors:
- Validate input format
- Throw descriptive errors on invalid input
- Trim whitespace for strings
- Return branded type on success

### Unsafe Constructors (no validation)

Use these ONLY when deserializing from trusted sources (database, API responses):

```typescript
import { unsafeExperimentId, unsafeCSSSelector } from '~src/types/branded'

const data = await apiClient.getExperiment()
const expId = unsafeExperimentId(data.id)

const domChange = {
  selector: unsafeCSSSelector('.button'),
  type: 'style',
  value: { color: 'red' }
}
```

Unsafe constructors:
- Skip validation (faster)
- Use when data is already validated
- Typical use: API deserialization, database reads

## Where Branded Types Are Used

### Domain Types Updated

#### `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/absmartly.ts`

```typescript
export interface Experiment {
  readonly id: ExperimentId              // ✅ Was: number
  readonly name: string
  readonly variants: readonly Variant[]
  // ...
}

export interface Variant {
  readonly name: VariantName            // ✅ Was: string
  // ...
}

export interface Application {
  readonly application_id?: ApplicationId  // ✅ Was: number
  // ...
}

type ABsmartlyConfigBase = {
  apiEndpoint: APIEndpoint               // ✅ Was: string
  applicationId?: ApplicationId          // ✅ Was: number
  // ...
}

export interface AIDOMGenerationConversation {
  id: ConversationId                     // ✅ Was: string
  experimentId: ExperimentId             // ✅ Was: number
  variantName: VariantName               // ✅ Was: string
  // ...
}
```

#### `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/dom-changes.ts` (Planned)

```typescript
// TODO: Update in gradual migration
export interface DOMChangeStyle {
  selector: CSSSelector                  // TODO: Currently string
  type: 'style'
  // ...
}
```

## Migration Strategy

### Phase 1: Infrastructure (COMPLETED ✅)
- [x] Created branded.ts with all type definitions
- [x] Created comprehensive test suite (59 tests passing)
- [x] Updated core domain types (Experiment, Variant, Config)

### Phase 2: Critical Paths (IN PROGRESS)
Update high-impact usage sites with safe constructors:

#### API Client Responses
```typescript
// background/core/api-client.ts
async getExperiment(id: number): Promise<Experiment> {
  const response = await this.request(`/experiments/${id}`)
  return {
    ...response.data,
    id: unsafeExperimentId(response.data.id),  // Trusted API data
    variants: response.data.variants.map(v => ({
      ...v,
      name: unsafeVariantName(v.name)
    }))
  }
}
```

#### User Input Validation
```typescript
// src/components/ConfigPanel.tsx
function handleSaveConfig() {
  try {
    const config: ABsmartlyConfig = {
      apiEndpoint: apiEndpoint(apiEndpointInput),  // Validates URL
      applicationId: applicationId(parseInt(appIdInput))  // Validates positive int
    }
    await saveConfig(config)
  } catch (error) {
    showError(error.message)  // "Invalid API endpoint: must be HTTP/HTTPS"
  }
}
```

#### DOM Changes Creation
```typescript
// src/visual-editor/selector-generator.ts
function createDOMChange(element: Element): DOMChange {
  const selectorString = generateSelector(element)
  return {
    selector: cssSelector(selectorString),  // Validates CSS syntax
    type: 'style',
    value: {}
  }
}
```

### Phase 3: Gradual Migration (TODO)
- Update remaining usage sites incrementally
- Add to code review checklist
- Document in contribution guide

## Error Handling

All safe constructors throw descriptive errors:

```typescript
try {
  const id = experimentId(-1)
} catch (error) {
  // error.message: "Invalid experiment ID: -1. Must be a positive integer."
}

try {
  const selector = cssSelector('[invalid')
} catch (error) {
  // error.message: "Invalid CSS selector syntax: [invalid"
}

try {
  const endpoint = apiEndpoint('ftp://example.com')
} catch (error) {
  // error.message: "Protocol must be http or https"
}
```

## Best Practices

### ✅ DO

1. **Use safe constructors for user input:**
   ```typescript
   const experimentId = experimentId(parseInt(userInput))
   ```

2. **Use unsafe constructors for trusted data:**
   ```typescript
   const experiments = apiData.map(exp => ({
     ...exp,
     id: unsafeExperimentId(exp.id)
   }))
   ```

3. **Catch validation errors and show to user:**
   ```typescript
   try {
     const endpoint = apiEndpoint(input)
   } catch (error) {
     showError(error.message)
   }
   ```

4. **Let branded types flow through your codebase:**
   ```typescript
   function getExperiment(id: ExperimentId): Promise<Experiment> { }
   function updateExperiment(id: ExperimentId, data: Partial<Experiment>) { }
   ```

### ❌ DON'T

1. **Don't bypass type safety with 'as':**
   ```typescript
   const id = 123 as ExperimentId
   ```

2. **Don't use unsafe constructors for user input:**
   ```typescript
   const endpoint = unsafeAPIEndpoint(userInput)
   ```

3. **Don't validate in multiple places:**
   ```typescript
   if (isValidUrl(input)) {
     const endpoint = apiEndpoint(input)
   }
   ```
   Just let the constructor validate and catch the error.

## Type Safety Benefits

### Prevents Primitive Confusion

```typescript
// Compiler error: Type 'ApplicationId' is not assignable to type 'ExperimentId'
function foo(expId: ExperimentId) { }
const appId = applicationId(123)
foo(appId)  // ❌ Compile error!
```

### Enforces Validation

```typescript
// Runtime error: Invalid experiment ID: 0. Must be a positive integer.
const id = experimentId(0)  // ❌ Throws immediately

// Runtime error: Invalid CSS selector syntax: [invalid
const selector = cssSelector('[invalid')  // ❌ Throws immediately
```

### Self-Documenting Code

```typescript
// BEFORE: What is this number?
function updateExperiment(id: number) { }

// AFTER: Clear domain intent
function updateExperiment(id: ExperimentId) { }
```

### Refactoring Safety

Changing a type signature updates all callers:

```typescript
// Change experimentId from number to string?
// Branded types make the refactor safe:
// 1. Update ExperimentId definition
// 2. Compiler shows ALL places that need updating
// 3. No silent bugs
```

## Testing

Comprehensive test suite at `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/__tests__/branded.test.ts`:

- ✅ 59 tests passing
- ✅ Validates all constructor functions
- ✅ Tests error conditions
- ✅ Verifies type safety
- ✅ Real-world integration scenarios

Run tests:
```bash
npm run test:unit -- src/types/__tests__/branded.test.ts
```

## Future Enhancements

Potential additions:

1. **VariantId** - Numeric variant identifier
2. **UnitTypeId** - Unit type identifier
3. **MetricId** - Metric identifier
4. **EmailAddress** - Validated email format
5. **UUID** - Validated UUID format

## References

- TypeScript Handbook: [Nominal Typing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Branded Types Pattern](https://egghead.io/blog/using-branded-types-in-typescript)
- Task 3.3 from comprehensive-review-fixes-2026-02-07.md
