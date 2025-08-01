# ABSmartly Visual Editor Browser Extension - Product Requirements Prompt (PRP)

## Purpose
Create a Browser Extension for ABsmartly where people can create experiments visually. It should be very similar to Statsig's Sidecar extension:
- https://docs.statsig.com/guides/sidecar-experiments/introduction/
- https://www.npmjs.com/package/statsig-sidecar

## Overview
Create a Visual Editor Browser Extension similar to Statsig's Sidecar that allows users to make DOM changes and create A/B tests through a visual interface.

## Core Features

### 1. Visual DOM Editor
- Allow users to select elements on any webpage
- Support multiple types of DOM modifications:
  - **Text changes**: Edit text content of elements
  - **HTML changes**: Modify inner HTML of elements
  - **Style changes**: Add/modify CSS styles
  - **Attribute changes**: Add/modify element attributes
  - **Class changes**: Add/remove CSS classes
  - **JavaScript execution**: Execute custom JavaScript code

### 2. Natural Language Support
- Integrate MCP (Model Context Protocol) with Cloudflare AI
- Allow users to describe changes in natural language
- Use Cloudflare Workers AI (https://blog.cloudflare.com/build-ai-agents-on-cloudflare/) to generate experiment payloads
- Examples:
  - "Make all buttons have rounded corners"
  - "Change the header background to blue"
  - "Hide the promotional banner"
  - "Make the text larger and easier to read"

### 3. ABSmartly Integration
- Store DOM changes as treatment variables in ABSmartly
- Create experiments directly from the extension
- Support for:
  - Creating new experiments
  - Adding variants
  - Defining treatment variables for DOM changes
  - Setting traffic allocation
- Use ABSmartly variables to store the DOM changes (https://docs.absmartly.com/docs/sdk-documentation/advanced/code-as-a-variant-variable/, https://docs.absmartly.com/docs/SDK-Documentation/basic-usage#treatment-variables)

### 4. SDK Plugin
- Create an ABSmartly SDK plugin that applies DOM changes
- Should be a subproject in a subdirectory (will be pushed to a different repository)
- Can be loaded together with the ABSmartly SDK (https://github.com/absmartly/javascript-sdk)
- The plugin should:
  - Read treatment variables
  - Apply DOM modifications based on variant assignment
  - Handle dynamic content and SPA navigation
  - Ensure changes persist across page updates
  - Use MutationObserver for late-loaded content (similar to Statsig's implementation: https://github.com/statsig-io/js-client-monorepo/tree/main/packages)

## Technical Requirements

### Authentication
- **Dual Authentication Support**:
  - API Key authentication (optional)
  - JWT authentication from browser cookies
  - If no API key provided, use JWT from ABSmartly session
  - Display authentication status in settings

### API Communication Architecture
- **All API requests MUST be made through the background service worker**
  - Avoids CORS issues with direct calls from popup/content scripts
  - Use `chrome.runtime.sendMessage` for communication between components
  - Background worker handles all ABSmartly API interactions
  - Proper error handling and response forwarding

### Settings Page Requirements
1. **ABSmartly Endpoint** (renamed from "API Endpoint")
2. **API Key** (optional field)
   - Description: "If not provided, will use JWT from browser cookies. Please authenticate into ABSmartly if no API key is set."
3. **Authentication Status Display**:
   - Make request to `/auth/current-user`
   - If authenticated: Display user name, email, picture
   - If not authenticated: Show "Not authenticated" with link to authenticate
   - User picture display: 
     - Construct full URL: `${endpoint}${user.picture.base_url}/crop/original.png`
     - Example: `https://dev-1.absmartly.com/files/avatars/[hash]/crop/original.png`
     - No authentication headers needed for image requests (uses same session)

### Experiment Filtering & Management
The extension should support all experiment filtering options available in the ABSmartly API:
- Basic filters: search, sort, page, items
- State filters: created, ready, running, development, full_on, stopped, archived, scheduled
- Significance filters: positive, negative, neutral, inconclusive
- ID-based filters: owners, teams, tags, templates, applications, unit_types
- Range filters: impact, created_at, updated_at, full_on_at
- Boolean filters: sample_ratio_mismatch, cleanup_needed, audience_mismatch, etc.
- Analysis type and experiment type filters

### Testing Requirements

#### Mandatory Testing Coverage
- **NOTHING WORKS WITHOUT TESTS**
- Every feature must have comprehensive Playwright tests
- No feature is considered complete without passing tests
- Test-driven development approach required

#### E2E Test Scenarios

1. **Natural Language DOM Manipulation**
   - Test: "Create an experiment that makes all buttons have rounded corners"
   - Verify:
     - Buttons are correctly identified
     - CSS changes are applied
     - Changes are stored in treatment variables

2. **API Payload Verification**
   - Test experiment creation flow
   - Verify:
     - Correct API endpoints are called
     - Payload structure matches ABSmartly API requirements
     - Treatment variables contain DOM change specifications

3. **Authentication Flow**
   - Test both API key and JWT authentication
   - Verify user info display
   - Test fallback behavior
   - Verify avatar image displays correctly with Playwright

4. **Visual Editor Interactions**
   - Test element selection
   - Test each type of DOM modification
   - Test undo/redo functionality

5. **SDK Plugin Integration**
   - Test DOM changes are applied correctly
   - Test variant switching
   - Test persistence across navigation
   - Test MutationObserver for late-loaded elements

#### Test Infrastructure
- Set up Playwright before ANY feature development
- Use TestSprite MCP for additional testing capabilities
- Continuous testing during development
- All tests must pass before considering work complete

## User Experience

### Extension Popup
- Clean, intuitive interface
- Quick access to:
  - Enable/disable visual editor
  - Current experiment status
  - Authentication status
  - Quick actions

### Visual Editor Overlay
- Highlight selectable elements on hover
- Show element information
- Provide editing tools contextually
- Preview changes before saving

### Experiment Creation Flow
1. Select elements to modify
2. Make changes using visual tools or natural language
3. Preview changes
4. Create experiment with variants
5. Set traffic allocation
6. Deploy

### Experiment Editing Interface

#### DOM Changes Management
When clicking on an experiment, users can edit variant variables including DOM changes:

**Variant Editor Layout:**
- Tab interface for each variant (Control, Variant A, Variant B, etc.)
- Each variant contains:
  - Standard variables section (key-value pairs)
  - DOM Changes section with specialized editor

**DOM Changes Editor Features:**
1. **List View**: Shows all DOM changes with selector, type, and description
   - Format: `[selector] | [type] | [description] [✏️][🗑️]`
   - Checkbox to enable/disable individual changes
   
2. **Add/Edit Modal**: 
   - Element selector field with visual picker icon [🎯]
   - Change type dropdown (text, style, class, attribute, html, javascript)
   - Dynamic value editor based on selected type
   - Template selector dropdown for quick common changes
   
3. **Preview Controls**:
   - ON/OFF toggle to apply changes to current page
   - Compare button (hold to see original, release to see changes)
   - Uses SDK plugin for all DOM manipulations

#### DOM Change Templates
Pre-built templates for common modifications:
- **Rounded Call-to-Action**: `border-radius: 8px`, padding, shadow, transition
- **Hide Element**: `display: none`
- **Urgent Highlight**: Red background, white text, bold
- **Text Emphasis**: Yellow background highlight with border
- **Success Style**: Green colors with success indicators
- **Disabled State**: Reduced opacity, disabled cursor

#### SDK Plugin Communication
- Extension sends messages to SDK plugin via postMessage
- SDK plugin handles all DOM manipulation and state preservation
- Extension never directly manipulates DOM
- Preview uses exact same code path as production

#### Data Structure
DOM changes stored in variant's `dom_changes` treatment variable:
```json
{
  "dom_changes": [
    {
      "selector": ".cta-button",
      "type": "style",
      "changes": {
        "border-radius": "8px",
        "background-color": "#007bff"
      }
    },
    {
      "selector": "h1.main-title",
      "type": "text",
      "value": "New Headline Text"
    },
    {
      "selector": ".old-banner",
      "type": "class",
      "add": ["d-none"],
      "remove": ["visible"]
    }
  ]
}
```

## SDK Plugin Implementation

The SDK plugin should implement the following pseudo-code structure:

import { context } from "@absmartly/javascript-sdk";  // assume context is created and available

context.ready().then(() => {
  // Get the DOM changes instructions for this user’s assigned variants
  const changesJson = context.variableValue("dom_changes", "[]");  // default to "[]" if not present
  let changes;
  try {
    changes = typeof changesJson === "string" ? JSON.parse(changesJson) : changesJson;
  } catch (e) {
    console.error("Failed to parse dom_changes JSON", e);
    changes = [];
  }

  applyDomChanges(changes);
}).catch(console.error);

// Function to apply a list of DOM changes instructions
function applyDomChanges(changesList) {
  changesList.forEach(change => {
    const { selector, action, value, attribute, css, className, script } = change;
    const element = document.querySelector(selector);
    if (!element) {
      // If element not found, observe for future insertion (for SPAs or late-loaded content)
      observeForElement(selector, () => { applyDomChanges([change]); });
      return;
    }
    switch (action) {
      case "text":
        element.textContent = value;
        break;
      case "html":
        element.innerHTML = value;
        break;
      case "style":
        if (css && typeof css === 'object') {
          // Apply each CSS property
          for (let [prop, val] of Object.entries(css)) {
            element.style.setProperty(prop, val);
          }
        }
        break;
      case "attribute":
        if (attribute) {
          element.setAttribute(attribute, value);
        }
        break;
      case "class":
        if (value === "add") {
          element.classList.add(className);
        } else if (value === "remove") {
          element.classList.remove(className);
        } else if (value === "toggle") {
          element.classList.toggle(className);
        }
        break;
      case "javascript":
        if (script) {
          try {
            // Execute the script in global context
            new Function(script)();
          } catch (err) {
            console.error("Error running variant script:", err);
          }
        }
        break;
      default:
        console.warn("Unknown action type in dom_changes:", action);
    }
  });
}

// Helper to observe DOM if an element isn't present yet
function observeForElement(selector, callback) {
  const observer = new MutationObserver((mutations, obs) => {
    if (document.querySelector(selector)) {
      obs.disconnect();
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

Here's how we load the SDK in our site:
import { SDK } from "@absmartly/javascript-sdk";

const EXP_PREFIX = 'exp_';
const EXP_PREFIX_LENGTH = EXP_PREFIX.length;

interface Env {
  ABSMARTLY_API_KEY: string;
  ABSMARTLY_CONSOLE_API_KEY: string;
  ABSMARTLY_ENVIRONMENT: string;
  ABSMARTLY_APPLICATION: string;
  ABSMARTLY_UNIT_NAME: string;
  ABSMARTLY_ENDPOINT: string;
  ABSMARTLY_API_ENDPOINT: string;
}

interface Attributes {
  [key: string]: string;
}

interface ContextParams {
  units: {
    [key: string]: string;
  };
  attributes?: Attributes;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { searchParams } = new URL(request.url);
    let absId = searchParams.get("unit");
    const goalName = searchParams.get("goal");
    const initSDK = searchParams.get("init");

    // Parse incoming cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = parseCookies(cookieHeader);

    // If no unit is provided, use cookie or generate a new one
    if (!absId) {
      if (cookies.abs && cookies.abs !== "undefined" && cookies.abs.length > 0) {
        absId = cookies.abs;
      } else if (cookies.abs_public && cookies.abs_public !== "undefined") {
        absId = cookies.abs_public;
      } else {
        absId = generateFastUniqueID();
      }
    }

    // Handle goal tracking case
    if (goalName && !initSDK) {
      return await handleGoalTracking(absId, goalName, searchParams, env);
    }

    if (initSDK) {
      return await handleSDKInit(absId, searchParams, env);
    }

    return new Response('Invalid request. Must specify either init=1 or goal parameter', { status: 400 });
  },
};

async function handleGoalTracking(absId: string, goalName: string, searchParams: URLSearchParams, env: Env): Promise<Response> {
  const properties: Record<string, string> = {};
  const attributes: Array<{ name: string; value: string; setAt: number }> = [];

  searchParams.forEach((value, key) => {
    if (key !== "unit" && key !== "goal" && !key.startsWith("prop_")) {
      attributes.push({
        name: key,
        value: value,
        setAt: Date.now()
      });
    }
    if (key.startsWith("prop_")) {
      const propName = key.replace("prop_", "");
      properties[propName] = value;
    }
  });

  // Construct the request body for the ABSmartly context API
  const now = Date.now();
  const requestBody = {
    hashed: false,
    historic: false,
    publishedAt: now,
    units: [
      {
        type: env.ABSMARTLY_UNIT_NAME,
        uid: absId
      }
    ],
    goals: [
      {
        name: goalName,
        achievedAt: now,
        properties
      }
    ],
    attributes
  };

  // Make the PUT request to track the goal in ABSmartly
  const apiResponse = await fetch(`${env.ABSMARTLY_API_ENDPOINT}/context`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Agent": "Cloudflare Worker SDK",
      "X-Environment": env.ABSMARTLY_ENVIRONMENT,
      "X-API-Key": env.ABSMARTLY_API_KEY
    },
    body: JSON.stringify(requestBody)
  });

  console.log("Goal tracking response status:", apiResponse.status);

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    console.error("Failed to track goal:", errorText);
    return apiResponse; 
  }

  return new Response('{}', { status: 200 });
}

async function handleSDKInit(absId: string, searchParams: URLSearchParams, env: Env): Promise<Response> {
  // Initialize SDK and get context data
  const serverSideData = await initializeSDK(absId, searchParams, env);
  
  // Generate response with necessary data
  const responseBody = `
    window.absId = "${absId}";
    window.serverSideData = ${JSON.stringify(serverSideData)};
    window.overriddenExperimentVariables = ${JSON.stringify(await getOverriddenVariables(searchParams, env))};
  `;

  // Set cookie headers
  const headers = new Headers({ 'Content-Type': 'text/javascript' });
  const expires = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toUTCString();
  
  headers.append(
    "Set-Cookie",
    `abs=${absId}; Expires=${expires}; Path=/; Domain=.absmartly.com; HttpOnly; SameSite=Lax`
  );
  headers.append(
    "Set-Cookie",
    `abs_public=${absId}; Expires=${expires}; Path=/; Domain=.absmartly.com; SameSite=Lax`
  );
  headers.append(
    "Set-Cookie",
    `abs_expiry=${Date.now()}; Expires=${expires}; Path=/; Domain=.absmartly.com; SameSite=Lax`
  );

  return new Response(responseBody, { status: 200, headers });
}

async function initializeSDK(absId: string, searchParams: URLSearchParams, env: Env) {
  const serverSideParams: ContextParams = {
    units: { absId },
    attributes: {},
  };

  // Extract additional attributes from query parameters
  const properties: Record<string, string> = {};
  const overrides: Record<string, string | number> = {};
  searchParams.forEach((value, key) => {
    if (
      key !== "init" &&
      key !== "unit" &&
      key !== "goal" &&
      !key.startsWith("prop_") &&
      !key.startsWith(EXP_PREFIX)
    ) {
      serverSideParams.attributes![key] = value;
    } else if (key.startsWith("prop_")) {
      const propName = key.replace("prop_", "");
      properties[propName] = value;
    } else if (key.startsWith(EXP_PREFIX)) {
      const expName = key.slice(EXP_PREFIX_LENGTH);
      overrides[expName] = isNaN(Number(value)) ? value : Number(value);
    }
  });

  // Create an SDK instance with the environment variables
  const sdk = new SDK({
    endpoint: env.ABSMARTLY_API_ENDPOINT,
    apiKey: env.ABSMARTLY_API_KEY,
    environment: env.ABSMARTLY_ENVIRONMENT,
    application: env.ABSMARTLY_APPLICATION,
    eventLogger: (context, eventName, data) => {
      console.log(eventName, data);
    },
  });

  // Create the server-side context with the SDK
  const serverSideContext = sdk.createContext(serverSideParams);

  // Apply overrides to the context
  if (Object.keys(overrides).length > 0) {
    serverSideContext.overrides(overrides);
  }

  await serverSideContext.ready();

  const goalName = searchParams.get("goal");
  if (goalName)
    serverSideContext.track(goalName, properties);

  return serverSideContext.data();
} 

async function getOverriddenVariables(searchParams: URLSearchParams, env: Env) {
  const overrides: Record<string, string | number> = {};
  const overriddenExperimentVariables: Record<string, any> = {};
  
  // Extract experiment overrides
  searchParams.forEach((value, key) => {
    if (key.startsWith("exp_")) {
      const expName = key.slice(4);
      overrides[expName] = isNaN(Number(value)) ? value : Number(value);
    }
  });

  if (Object.keys(overrides).length === 0) {
    return {};
  }

  // Define state priority
  const statePriority: Record<string, number> = {
    running: 1,
    scheduled: 2,
    development: 3,
    ready: 4,
    draft: 5,
    stopped: 6,
    archived: 7,
  };

  for (const [experimentName, variantValue] of Object.entries(overrides)) {
    try {
      const response = await fetch(
        `${env.ABSMARTLY_ENDPOINT}/v1/experiments?search=${encodeURIComponent(experimentName)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Api-Key ${env.ABSMARTLY_CONSOLE_API_KEY}`,
          },
        }
      );
      if (response.ok) {
        const { experiments } = await response.json() as { experiments: Array<{
          variants: any;
          name: string;
          state: string 
        }> };

        const matchingExperiments = experiments?.filter((exp: { name: string }) => exp.name === experimentName) || [];
        
        if (matchingExperiments.length > 0) {
          const experiment = matchingExperiments.sort((a: { state: string }, b: { state: string }) => 
            (statePriority[a.state] || 999) - (statePriority[b.state] || 999)
          )[0];

          const variantIndex = typeof variantValue === 'string'
          ? experiment.variants.findIndex(v => v.name === variantValue)
          : variantValue;

          // console.log("variantIndex", variantIndex);
          if (typeof variantIndex === 'number' && variantIndex >= 0) {
            const variant = experiment.variants[variantIndex];
            console.log("variant", variant);
            if (variant?.config) {
              try {
                // console.log("overriddenExperimentVariables", overriddenExperimentVariables);
                Object.assign(overriddenExperimentVariables, JSON.parse(variant.config));
                // console.log("overriddenExperimentVariables", overriddenExperimentVariables);
              } catch (e) {
                console.error("Failed to parse variant config:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching experiment ${experimentName}:`, error);
    }
  }

  return overriddenExperimentVariables;
}

// Helper function to parse cookies from the request header
function parseCookies(cookieHeader: string): { [key: string]: string } {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, value] = cookie.split("=").map(c => c.trim());
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as { [key: string]: string });
}

function generateFastUniqueID(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

Please come up with a plan and code examples on how to build this SDK plugin (especial attention on making it work in SPAs, even if the DOM elements that need changing are not visible in the page yet).

And with a plan on how to build the Browser Extension that allows users to create new experiments either via the ABsmartly API or via the MCP servers. Those experiments should have the DOM changes for each variant described in the variant variables passed to the experiment.

### API Integration Examples

#### GET /v1/experiments Response Structure
Example experiment payload (condensed for brevity):
```yaml
experiments:
  - id: 23736
    name: my_super_nice_experiment_1747324499388
    display_name: my_super_nice_experiment
    iteration: 2
    type: test
    state: running
    nr_variants: 2
    percentages: 50/50
    percentage_of_traffic: 100
    variants:
      - variant: 0
        config: '{"product_image_size":"200px","dom_changes":"[...]"}'
      - variant: 1
        config: '{"product_image_size":"400px","dom_changes":"[...]"}'
    # ... (additional metadata fields)
```

#### POST /v1/experiments Payload Structure
Example experiment creation payload:
```yaml
state: ready
name: my_super_nice_experiment
display_name: my_super_nice_experiment
iteration: 1
percentage_of_traffic: 100
unit_type:
  unit_type_id: 1
nr_variants: 2
percentages: 50/50
audience: '{"filter":[{"and":[{"or":[{"eq":[{"var":{"path":"country"}},{"value":"gb"}]}]}]}'
owners:
  - user_id: 3
variants:
  - variant: 0
    config: '{"product_image_size":"200px","dom_changes":"[...]"}'
  - variant: 1
    config: '{"product_image_size":"400px","dom_changes":"[...]"}'
# ... (additional fields for metrics, tags, etc.)
```

#### Fetching Experiments - Complete Examples

**Basic URL Structure:**
```
GET https://dev-1.absmartly.com/v1/experiments?state=ready,created&iterations=1&items=10&page=1&previews=1&type=test
```

**Common Query Parameters:**
- `state`: Filter by experiment state (ready, created, running, stopped, etc.)
- `iterations`: Include experiment iterations data (1 for yes, 0 for no)
- `items`: Number of experiments per page (default: 50, max: 1500)
- `page`: Page number for pagination (starts at 1)
- `previews`: Include preview data (1 for yes, 0 for no)
- `type`: Filter by experiment type (test, feature_flag, etc.)
- `search`: Search by experiment name or display name
- `sort`: Sort field (name, created_at, updated_at, start_at)
- `order`: Sort order (asc, desc)

**Extension Implementation Example:**
```typescript
// In background service worker
async function fetchExperiments(filters = {}) {
  const params = new URLSearchParams({
    state: 'ready,created,running',
    iterations: '1',
    items: '50',
    page: '1',
    previews: '1',
    type: 'test',
    ...filters
  });

  try {
    const response = await fetch(`${ABSMARTLY_ENDPOINT}/v1/experiments?${params}`, {
      headers: {
        'Authorization': `JWT ${authToken}`, // or `Api-Key ${apiKey}`
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      experiments: data.experiments || [],
      pagination: {
        page: data.page,
        items: data.items,
        total: data.total
      }
    };
  } catch (error) {
    console.error('Failed to fetch experiments:', error);
    throw error;
  }
}

// Usage in extension popup
chrome.runtime.sendMessage({
  action: 'fetchExperiments',
  filters: { state: 'running', search: 'button' }
}, (response) => {
  if (response.success) {
    displayExperiments(response.data.experiments);
  } else {
    showError(response.error);
  }
});
```

**Advanced Filtering Examples:**
```typescript
// Filter for experiments with DOM changes
const domExperiments = await fetchExperiments({
  search: 'dom_changes',
  state: 'running,ready'
});

// Get user's own experiments
const myExperiments = await fetchExperiments({
  owners: currentUser.id,
  sort: 'updated_at',
  order: 'desc'
});

// Filter by tags
const taggedExperiments = await fetchExperiments({
  tags: 'visual-editor,frontend'
});
```

### ABSmartly MCP Client Implementation

```typescript
class ABsmartlyAPIClient {
  constructor(authToken: string, baseUrl: string, authType?: 'jwt' | 'api-key') {
    // Auto-detect auth type or use provided
    // Support both API key and JWT authentication
  }
  
  // Core experiment methods
  async listExperiments(params?: ListExperimentsParams): Promise<ABsmartlyResponse>
  async getExperiment(id: number): Promise<ABsmartlyResponse>
  async createExperiment(data: any): Promise<ABsmartlyResponse>
  async updateExperiment(id: number, data: any): Promise<ABsmartlyResponse>
  async startExperiment(id: number): Promise<ABsmartlyResponse>
  async stopExperiment(id: number): Promise<ABsmartlyResponse>
  
  // User and authentication
  async getCurrentUser(): Promise<ABsmartlyResponse>
  
  // Additional methods for goals, metrics, teams, etc.
  // ... (full API client available in MCP server)
}
```

### Technical Implementation Notes

#### Browser Extension Architecture (Plasmo Framework)
- Uses Plasmo framework for cross-browser compatibility
- Background service worker for API communications
- Content scripts for DOM manipulation
- Popup interface for user interactions
- Settings page for configuration

#### Natural Language Processing
- Integration with Cloudflare Workers AI
- MCP (Model Context Protocol) for AI interactions
- Convert natural language to DOM change specifications

#### DOM Change Structure
All DOM modifications stored in variant config as `dom_changes` array with schema compatible with SDK plugin.



## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance

---

## Goal
Create a production-ready browser extension that acts as a visual editor for ABsmartly experiments, where users can also use natural language to describe the changes they want to apply to the page. This should probably use Cloudflare Workers AI (https://blog.cloudflare.com/build-ai-agents-on-cloudflare/) that generates the payload to be passed as variables to each variant of the experiment or could even call the ABsmartly MCP server to apply the changes directly to the experiment.


### Success Criteria
- [ ] Experiments can be listed and filtered via the browser extension (using all the available filters)
- [ ] Experiments can be created/edited via the browser extension
- [ ] Variant payloads with DOM changes can be generated via natural language or typed in the UI
- [ ] SDK Plugin can apply the DOM changes to the page or app even if the DOM elements are not visible in the page yet
- [ ] Browser Extension should have an actractive UI
- [ ] All tests pass and code meets quality standards

## All Needed Context

### Spec to filter experiments (copied from the MCP server)
```typescript

       // List experiments tool
        this.server.tool(
            "list_experiments",
            "List experiments with optional filtering. To filter by owner name: 1) First use list_users to find the user ID, 2) Then use the owners parameter with that ID",
            {
                // Basic query parameters
                search: z.string().optional().describe("Search experiments by name or description"),
                sort: z.string().optional().describe("Sort field (e.g., created_at, updated_at)"),
                page: z.number().optional().describe("Page number (default: 1)"),
                items: z.number().optional().describe("Items per page (default: 10)"),
                
                // Filter by experiment attributes (comma-separated lists)
                state: z.string().optional().describe("Filter by state (comma-separated: created,ready,running,development,full_on,running_not_full_on,stopped,archived,scheduled)"),
                significance: z.string().optional().describe("Filter by significance results (comma-separated: positive,negative,neutral,inconclusive)"),
                owners: z.string().optional().describe("Filter by owner user IDs (comma-separated numbers, e.g.: 3,5,7). To find a user's ID, use list_users with their full name (e.g., list_users({search: 'Cal Courtney'}))"),
                teams: z.string().optional().describe("Filter by team IDs (comma-separated numbers, e.g.: 1,2,3). Use the list_teams tool to find team IDs by name"),
                tags: z.string().optional().describe("Filter by tag IDs (comma-separated numbers, e.g.: 2,4,6). Use the list_tags tool to find tag IDs by name"),
                templates: z.string().optional().describe("Filter by template IDs (comma-separated numbers, e.g.: 238,240). Note: This expects numeric template IDs"),
                applications: z.string().optional().describe("Filter by application IDs (comma-separated numbers, e.g.: 39,3). Use the list_applications tool to find application IDs by name"),
                unit_types: z.string().optional().describe("Filter by unit type IDs (comma-separated numbers, e.g.: 42,75). Use the list_unit_types tool to find unit type IDs by name"),
                
                // Range filters (comma-separated min,max)
                impact: z.string().optional().describe("Filter by impact range (min,max: 1,5)"),
                created_at: z.string().optional().describe("Filter by creation date range (start,end) in milliseconds since epoch"),
                updated_at: z.string().optional().describe("Filter by update date range (start,end) in milliseconds since epoch"),
                full_on_at: z.string().optional().describe("Filter by full_on date range (start,end) in milliseconds since epoch"),
                
                // Boolean filters (0 or 1)
                sample_ratio_mismatch: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments with sample ratio mismatch"),
                cleanup_needed: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments that need cleanup"),
                audience_mismatch: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments with audience mismatch"),
                sample_size_reached: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments that reached sample size"),
                experiments_interact: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments that interact with other experiments"),
                group_sequential_updated: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments with updated group sequential analysis"),
                assignment_conflict: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments with assignment conflicts"),
                metric_threshold_reached: z.union([z.literal(0), z.literal(1)]).optional().describe("Filter experiments that reached metric threshold"),
                previews: z.union([z.literal(0), z.literal(1)]).optional().describe("Include experiment preview data"),
                
                // String filters
                analysis_type: z.string().optional().describe("Filter by analysis type (e.g., group_sequential,fixed_horizon)"),
                type: z.string().optional().describe("Filter by experiment type (e.g., test, feature)"),
                
                // Number filters
                iterations: z.number().optional().describe("Filter by number of iterations"),
                
                // Output format
                format: z.enum(['json', 'md']).optional().describe("Output format: 'json' for full data or 'md' for formatted markdown (default: md)")
            },
```

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://blog.cloudflare.com/build-ai-agents-on-cloudflare/
  why: Core agent creation patterns
  
- url: https://docs.absmartly.com/docs/SDK-Documentation/basic-usage
       https://docs.absmartly.com/docs/SDK-Documentation/Advanced/code-as-a-variant-variable
  why: How to load the ABsmartly SDK and use the variables
  
- url: https://docs.plasmo.com/framework 
  why: Plasmo framework for browser extensions 
  
- url: https://api-dashboard.search.brave.com/app/documentation
  why: Brave Search API REST endpoints
  
```


## Implementation Blueprint

### List of tasks to be completed

```yaml
Task 1: Setup Configuration and Environment
CREATE .env.example:
  - Include all required environment variables with descriptions

Task 2: Implement SDK Plugin 
CREATE sdk_plugin/src/index.ts:

