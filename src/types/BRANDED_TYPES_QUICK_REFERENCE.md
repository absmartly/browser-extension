# Branded Types Quick Reference Card

## When to Use Which Constructor

### ✅ Use Safe Constructors (with validation)

**When:** Creating branded types from **user input** or **external untrusted sources**

```typescript
import { experimentId, apiEndpoint, cssSelector } from '~src/types/branded'

const expId = experimentId(userInputNumber)

const endpoint = apiEndpoint(configFormInput)

const selector = cssSelector(visualEditorSelection)
```

**Throws on invalid input** - Always wrap in try-catch:
```typescript
try {
  const config = {
    apiEndpoint: apiEndpoint(userInput)
  }
} catch (error) {
  showError(error.message)
}
```

---

### ✅ Use Unsafe Constructors (no validation)

**When:** Deserializing from **trusted sources** (API, database, storage)

```typescript
import { unsafeExperimentId, unsafeVariantName } from '~src/types/branded'

const experiment = {
  ...apiResponse,
  id: unsafeExperimentId(apiResponse.id),
  variants: apiResponse.variants.map(v => ({
    ...v,
    name: unsafeVariantName(v.name)
  }))
}

const fromStorage = {
  ...storageData,
  experimentId: unsafeExperimentId(storageData.experimentId)
}
```

**No validation** - Use only when data is already validated!

---

## Available Branded Types

| Branded Type | Base Type | Validation |
|-------------|-----------|------------|
| `ExperimentId` | `number` | Positive integer |
| `ApplicationId` | `number` | Positive integer |
| `VariantName` | `string` | Non-empty, trimmed |
| `ConversationId` | `string` | Non-empty, trimmed |
| `SessionId` | `string` | Non-empty, trimmed |
| `CSSSelector` | `string` | Valid CSS syntax |
| `XPathSelector` | `string` | Non-empty, trimmed |
| `APIEndpoint` | `string` | Valid HTTP/HTTPS URL |

---

## Quick Examples

### Example 1: Config Form
```typescript
// User filling out config form
function handleSave() {
  try {
    const config = {
      apiEndpoint: apiEndpoint(endpointInput.value),
      applicationId: applicationId(parseInt(appIdInput.value))
    }
    await saveConfig(config)
    showSuccess('Saved!')
  } catch (error) {
    showError(error.message)
  }
}
```

### Example 2: API Response
```typescript
// Deserializing API response
async function getExperiment(id: ExperimentId): Promise<Experiment> {
  const response = await fetch(`/api/experiments/${id}`)
  const data = await response.json()

  return {
    ...data,
    id: unsafeExperimentId(data.id),
    variants: data.variants.map(v => ({
      ...v,
      name: unsafeVariantName(v.name)
    }))
  }
}
```

### Example 3: Visual Editor
```typescript
// Generating selector from DOM element
function createDOMChange(element: Element): DOMChange {
  return {
    selector: cssSelector(generateSelectorString(element)),
    type: 'style',
    value: {}
  }
}
```

### Example 4: Recent Experiments
```typescript
// Reading from storage
async function getRecentExperiments(): Promise<ExperimentId[]> {
  const raw = await storage.get('recent-experiments') || []
  return raw.map(id => unsafeExperimentId(id))
}

// Adding new recent experiment (already branded)
async function addRecentExperiment(id: ExperimentId): Promise<void> {
  const recent = await getRecentExperiments()
  const updated = [id, ...recent.filter(x => x !== id)].slice(0, 10)
  await storage.set('recent-experiments', updated)
}
```

---

## Common Errors and Fixes

### ❌ Error: `Type 'number' is not assignable to type 'ExperimentId'`

**Fix:** Use a constructor:
```typescript
const experiment: Experiment = {
  id: experimentId(123),
  // OR for trusted data:
  id: unsafeExperimentId(apiData.id)
}
```

### ❌ Error: `Type 'string' is not assignable to type 'APIEndpoint'`

**Fix:** Validate the URL:
```typescript
const config: ABsmartlyConfig = {
  apiEndpoint: apiEndpoint('https://api.absmartly.com')
}
```

### ❌ Error: `Type 'string' is not assignable to type 'VariantName'`

**Fix:** Use constructor:
```typescript
const variant: Variant = {
  name: variantName('control'),
  // OR for trusted data:
  name: unsafeVariantName(apiData.name)
}
```

---

## Decision Tree

```
Do you have a primitive value that needs to be a branded type?
│
├─ Is it from USER INPUT or EXTERNAL SOURCE?
│  └─ YES → Use SAFE constructor (validates)
│     └─ Wrap in try-catch, show error to user
│
└─ Is it from TRUSTED SOURCE (API, database, storage)?
   └─ YES → Use UNSAFE constructor (no validation)
      └─ No try-catch needed
```

---

## Import Cheat Sheet

```typescript
// Safe constructors (with validation)
import {
  experimentId,
  applicationId,
  variantName,
  conversationId,
  sessionId,
  cssSelector,
  xpathSelector,
  apiEndpoint
} from '~src/types/branded'

// Unsafe constructors (no validation)
import {
  unsafeExperimentId,
  unsafeApplicationId,
  unsafeVariantName,
  unsafeConversationId,
  unsafeSessionId,
  unsafeCSSSelector,
  unsafeXPathSelector,
  unsafeAPIEndpoint
} from '~src/types/branded'

// Types (for function signatures)
import type {
  ExperimentId,
  ApplicationId,
  VariantName,
  ConversationId,
  SessionId,
  CSSSelector,
  XPathSelector,
  APIEndpoint
} from '~src/types/branded'
```

---

## Testing

```typescript
// In test files, use constructors in fixtures
const mockExperiment: Experiment = {
  id: unsafeExperimentId(123),
  name: 'Test Experiment',
  variants: [
    {
      name: unsafeVariantName('control'),
      config: '{}',
      is_control: true
    }
  ]
}
```

---

## More Info

- Full guide: `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/BRANDED_TYPES_GUIDE.md`
- Migration examples: `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/BRANDED_TYPES_MIGRATION_EXAMPLES.md`
- Test suite: `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/types/__tests__/branded.test.ts`
