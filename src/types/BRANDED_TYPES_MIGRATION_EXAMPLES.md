# Branded Types Migration Examples

This document shows real-world examples of how to migrate critical paths to use branded types.

## Example 1: Storage Utilities

### Before (Current)

```typescript
// src/utils/storage.ts
export async function getRecentExperiments(): Promise<number[]> {
  return (await storage.get(STORAGE_KEYS.RECENT_EXPERIMENTS)) || []
}

export async function addRecentExperiment(experimentId: number): Promise<void> {
  const recent = await getRecentExperiments()
  const updated = [experimentId, ...recent.filter(id => id !== experimentId)].slice(0, 10)
  await storage.set(STORAGE_KEYS.RECENT_EXPERIMENTS, updated)
}
```

### After (With Branded Types)

```typescript
// src/utils/storage.ts
import { unsafeExperimentId, type ExperimentId } from '~src/types/branded'

export async function getRecentExperiments(): Promise<ExperimentId[]> {
  const rawIds = (await storage.get(STORAGE_KEYS.RECENT_EXPERIMENTS)) || []
  return rawIds.map(id => unsafeExperimentId(id))
}

export async function addRecentExperiment(experimentId: ExperimentId): Promise<void> {
  const recent = await getRecentExperiments()
  const updated = [experimentId, ...recent.filter(id => id !== experimentId)].slice(0, 10)
  await storage.set(STORAGE_KEYS.RECENT_EXPERIMENTS, updated)
}
```

## Example 2: Config Panel User Input

### Before

```typescript
// src/components/ConfigPanel.tsx
function ConfigPanel() {
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [applicationId, setApplicationId] = useState('')

  const handleSave = async () => {
    const config = {
      apiEndpoint,
      applicationId: parseInt(applicationId)
    }
    await setConfig(config)
  }

  return (
    <div>
      <input value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} />
      <input value={applicationId} onChange={e => setApplicationId(e.target.value)} />
      <button onClick={handleSave}>Save</button>
    </div>
  )
}
```

### After (With Validation)

```typescript
// src/components/ConfigPanel.tsx
import { apiEndpoint, applicationId } from '~src/types/branded'
import { useNotifications } from '~src/contexts/NotificationContext'

function ConfigPanel() {
  const [apiEndpointInput, setApiEndpointInput] = useState('')
  const [applicationIdInput, setApplicationIdInput] = useState('')
  const { showError, showSuccess } = useNotifications()

  const handleSave = async () => {
    try {
      const config = {
        apiEndpoint: apiEndpoint(apiEndpointInput),
        applicationId: applicationId(parseInt(applicationIdInput))
      }
      await setConfig(config)
      showSuccess('Configuration saved successfully')
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <div>
      <input
        id="api-endpoint-input"
        value={apiEndpointInput}
        onChange={e => setApiEndpointInput(e.target.value)}
        placeholder="https://api.absmartly.com"
      />
      <input
        id="application-id-input"
        value={applicationIdInput}
        onChange={e => setApplicationIdInput(e.target.value)}
        placeholder="123"
      />
      <button id="save-config-btn" onClick={handleSave}>Save</button>
    </div>
  )
}
```

## Example 3: API Client Response Deserialization

### Before

```typescript
// background/core/api-client.ts
async getExperiment(id: number): Promise<Experiment> {
  const response = await this.request(`/experiments/${id}`)
  return response.data
}

async listExperiments(): Promise<Experiment[]> {
  const response = await this.request('/experiments')
  return response.data
}
```

### After (With Unsafe Constructors)

```typescript
// background/core/api-client.ts
import { unsafeExperimentId, unsafeVariantName, unsafeApplicationId, type ExperimentId } from '~src/types/branded'
import type { Experiment } from '~src/types/absmartly'

async getExperiment(id: ExperimentId): Promise<Experiment> {
  const response = await this.request(`/experiments/${id}`)
  return this.deserializeExperiment(response.data)
}

async listExperiments(): Promise<Experiment[]> {
  const response = await this.request('/experiments')
  return response.data.map(exp => this.deserializeExperiment(exp))
}

private deserializeExperiment(data: any): Experiment {
  return {
    ...data,
    id: unsafeExperimentId(data.id),
    variants: data.variants.map(v => ({
      ...v,
      name: unsafeVariantName(v.name)
    })),
    applications: data.applications?.map(app => ({
      ...app,
      application_id: app.application_id ? unsafeApplicationId(app.application_id) : undefined
    }))
  }
}
```

## Example 4: Visual Editor Selector Generation

### Before

```typescript
// src/visual-editor/selector-generator.ts
export function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`
  }

  if (element.className) {
    const classes = element.className.trim().split(/\s+/).join('.')
    return `.${classes}`
  }

  return element.tagName.toLowerCase()
}

export function createStyleChange(element: Element, styles: Record<string, string>): DOMChange {
  return {
    selector: generateSelector(element),
    type: 'style',
    value: styles
  }
}
```

### After (With Validation)

```typescript
// src/visual-editor/selector-generator.ts
import { cssSelector, type CSSSelector } from '~src/types/branded'

export function generateSelector(element: Element): CSSSelector {
  let selectorString: string

  if (element.id) {
    selectorString = `#${element.id}`
  } else if (element.className) {
    const classes = element.className.trim().split(/\s+/).join('.')
    selectorString = `.${classes}`
  } else {
    selectorString = element.tagName.toLowerCase()
  }

  return cssSelector(selectorString)
}

export function createStyleChange(element: Element, styles: Record<string, string>): DOMChange {
  return {
    selector: generateSelector(element),
    type: 'style',
    value: styles
  }
}
```

## Example 5: Experiment List Component

### Before

```typescript
// src/components/ExperimentList.tsx
interface ExperimentListProps {
  experiments: Experiment[]
  onSelect: (experimentId: number) => void
}

function ExperimentList({ experiments, onSelect }: ExperimentListProps) {
  return (
    <div>
      {experiments.map(exp => (
        <div key={exp.id} onClick={() => onSelect(exp.id)}>
          {exp.name}
        </div>
      ))}
    </div>
  )
}
```

### After (Type-Safe)

```typescript
// src/components/ExperimentList.tsx
import type { Experiment, ExperimentId } from '~src/types/absmartly'

interface ExperimentListProps {
  experiments: Experiment[]
  onSelect: (experimentId: ExperimentId) => void
}

function ExperimentList({ experiments, onSelect }: ExperimentListProps) {
  return (
    <div>
      {experiments.map(exp => (
        <div
          id={`experiment-${exp.id}`}
          key={exp.id}
          onClick={() => onSelect(exp.id)}
        >
          {exp.name}
        </div>
      ))}
    </div>
  )
}
```

## Example 6: AI DOM Generation Context

### Before

```typescript
// src/components/AIDOMGenerator.tsx
interface ConversationMetadata {
  experimentId: number
  variantName: string
  conversationId: string
}

function createConversation(metadata: ConversationMetadata): AIDOMGenerationConversation {
  return {
    id: metadata.conversationId,
    experimentId: metadata.experimentId,
    variantName: metadata.variantName,
    messages: [],
    conversationSession: {
      id: generateSessionId(),
      conversationId: metadata.conversationId
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    firstUserMessage: '',
    isActive: true
  }
}
```

### After (With Branded Types)

```typescript
// src/components/AIDOMGenerator.tsx
import {
  conversationId,
  sessionId,
  experimentId,
  variantName,
  unsafeConversationId,
  unsafeSessionId,
  type ConversationId,
  type SessionId,
  type ExperimentId,
  type VariantName
} from '~src/types/branded'

interface ConversationMetadata {
  experimentId: ExperimentId
  variantName: VariantName
  conversationId: ConversationId
}

function createConversation(metadata: ConversationMetadata): AIDOMGenerationConversation {
  return {
    id: metadata.conversationId,
    experimentId: metadata.experimentId,
    variantName: metadata.variantName,
    messages: [],
    conversationSession: {
      id: sessionId(generateSessionId()),
      conversationId: metadata.conversationId
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    firstUserMessage: '',
    isActive: true
  }
}

function deserializeStoredConversation(data: any): StoredConversation {
  return {
    ...data,
    id: unsafeConversationId(data.id),
    experimentId: data.experimentId ? unsafeExperimentId(data.experimentId) : undefined,
    variantName: unsafeVariantName(data.variantName),
    conversationSession: {
      ...data.conversationSession,
      id: data.conversationSession.id ? unsafeSessionId(data.conversationSession.id) : undefined,
      conversationId: data.conversationSession.conversationId
        ? unsafeConversationId(data.conversationSession.conversationId)
        : undefined
    }
  }
}
```

## Example 7: Message Handlers in Background Script

### Before

```typescript
// background/main.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_EXPERIMENT') {
    const experimentId = message.experimentId
    apiClient.getExperiment(experimentId)
      .then(exp => sendResponse({ success: true, data: exp }))
      .catch(err => sendResponse({ success: false, error: err.message }))
  }

  if (message.type === 'UPDATE_CONFIG') {
    setConfig(message.config)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
  }
})
```

### After (With Validation)

```typescript
// background/main.ts
import { experimentId, apiEndpoint, applicationId } from '~src/types/branded'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_EXPERIMENT') {
    try {
      const expId = experimentId(message.experimentId)
      apiClient.getExperiment(expId)
        .then(exp => sendResponse({ success: true, data: exp }))
        .catch(err => sendResponse({ success: false, error: err.message }))
    } catch (error) {
      sendResponse({
        success: false,
        error: `Invalid experiment ID: ${error.message}`
      })
    }
  }

  if (message.type === 'UPDATE_CONFIG') {
    try {
      const validatedConfig = {
        ...message.config,
        apiEndpoint: apiEndpoint(message.config.apiEndpoint),
        applicationId: message.config.applicationId
          ? applicationId(message.config.applicationId)
          : undefined
      }
      setConfig(validatedConfig)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }))
    } catch (error) {
      sendResponse({
        success: false,
        error: `Invalid configuration: ${error.message}`
      })
    }
  }
})
```

## Migration Checklist

When migrating a module to use branded types:

- [ ] Import necessary branded types and constructors
- [ ] Update function signatures to use branded types
- [ ] Use **safe constructors** for user input and external data
- [ ] Use **unsafe constructors** for trusted data (API responses, database reads)
- [ ] Add try-catch blocks around safe constructor calls
- [ ] Update error messages to use branded type validation errors
- [ ] Add IDs to UI elements for testing (e.g., `id="api-endpoint-input"`)
- [ ] Update tests to use branded types
- [ ] Verify TypeScript compilation succeeds
- [ ] Run unit tests
- [ ] Run E2E tests if UI changed

## Common Patterns

### Pattern 1: Deserialize from API
```typescript
const experiments = apiResponse.map(exp => ({
  ...exp,
  id: unsafeExperimentId(exp.id),
  variants: exp.variants.map(v => ({
    ...v,
    name: unsafeVariantName(v.name)
  }))
}))
```

### Pattern 2: Validate User Input
```typescript
try {
  const endpoint = apiEndpoint(userInput)
  await saveConfig({ apiEndpoint: endpoint })
  showSuccess('Saved successfully')
} catch (error) {
  showError(error.message)
}
```

### Pattern 3: Generate from DOM
```typescript
function getSelectorFromElement(element: Element): CSSSelector {
  const selectorString = generateSelectorString(element)
  return cssSelector(selectorString)
}
```

### Pattern 4: Pass Through Layers
```typescript
async function selectExperiment(id: ExperimentId) {
  const experiment = await getExperiment(id)
  await addRecentExperiment(id)
  return experiment
}
```
