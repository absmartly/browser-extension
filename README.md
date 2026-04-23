# ABsmartly Browser Extension

A browser extension for creating, editing and debugging ABsmartly experiments directly on any webpage. Build DOM-based A/B tests visually or with AI assistance — no code changes required in the target site.

## Highlights

- **Experiment management** — browse, filter, create, start, stop, and favorite experiments against any ABsmartly workspace
- **Visual editor** — point-and-click element selection, inline text/HTML/style edits, drag-to-move, resize, and context-menu actions on the live page
- **DOM changes** — 11 change types covering text, HTML, inline styles, pseudo-state style rules, classes, attributes, JavaScript, move, remove, insert, and create
- **Vibe Studio (AI)** — generate or refine DOM changes from natural-language prompts; supports Claude (subscription bridge or API), OpenAI, OpenRouter, and Gemini
- **Variant override testing** — force any variant on the current page to preview assignments before going live
- **Per-variant code injection** — attach head/body start/end JavaScript and URL filters per variant
- **Events debug view** — live feed of SDK events (exposures, goals, custom) fired on the active page
- **Multi-browser** — Chrome, Edge, Firefox, and Safari via Plasmo

## Installation

### Load the development build (recommended for contributors)

```bash
git clone https://github.com/absmartly/browser-extension.git
cd absmartly-browser-extension
npm install
npm run build:dev      # one-shot dev build
# or: npm run dev      # watch mode with hot reload
```

Then in Chrome / Edge:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `build/chrome-mv3-dev`

Firefox and Safari builds are emitted under `build/firefox-mv*` and `build/safari-mv*` after `npm run build`.

### Production build

```bash
npm run build          # all browsers
npm run package        # zip for store submission
```

## First-run configuration

Open the extension by clicking its toolbar icon — the sidebar slides in on the right side of the active tab. Then:

1. Click the gear icon to open **Settings**.
2. Fill in **Authentication**:
   - **API Endpoint** — your workspace URL, e.g. `https://demo.absmartly.com`
   - **API Key** — JWT or personal API key
3. (Optional) Under **SDK Configuration**, set the `window` property name where the host site exposes the SDK context (default: `ABsmartly`) and the variant config field that stores DOM changes (default: `__dom_changes`).
4. (Optional) Under **AI Provider**, pick a provider and supply an API key / model. See [AI (Vibe Studio)](#ai-vibe-studio) below.
5. (Optional) Under **Global Defaults**, set default unit type, application, and metrics so new experiments pre-fill sensibly.
6. When the extension first runs on a site, accept the **site permission** banner so the extension can read/modify the page.

Credentials are stored in Chrome extension storage and never leave your machine except to call your configured ABsmartly endpoint.

## Core workflows

### Browsing and filtering experiments

The experiment list is the default view. It supports:

- **Text search** by name (debounced)
- **State filters** — Draft, Ready, Running, Development, Full On, Running (Not Full On), Stopped, Archived, Scheduled
- **Significance filters** — Positive, Negative, Neutral, Inconclusive
- **Facets** — Owners, Teams, Tags, Applications
- **Issues & alerts** — SRM, Cleanup Needed, Audience Mismatch, Sample Size Reached, Experiments Interact, Assignment Conflict
- **Favorites** — heart icon toggles a persisted favorite flag
- **Pagination** — configurable page size, refresh forces a re-fetch

### Creating experiments

Click the **+** dropdown in the list header:

- **From scratch** — opens the experiment editor with empty metadata and two variants.
- **From template** — searchable template picker; the selected template pre-fills metadata, variants, and variant variables.

Fill in name, traffic %, unit type, primary/secondary metrics, owners, teams, tags, applications, and audience filter (JSON or builder). Add DOM changes to variants via the inline editor, JSON editor, visual editor, or Vibe Studio. Save to create.

### Editing an experiment

Click a list row to open the experiment detail. From here:

- **Lifecycle actions** — start, stop, or transition state (subject to permissions and workspace rules)
- **Metadata** — name, display name, traffic, audience, unit type, metrics, owners, teams, tags, applications, full-on capability
- **Variants** — add / remove / rename, edit DOM changes per variant, toggle between the inline editor and raw JSON, manage variant variables (key-value pairs)
- **URL filters per variant** — simple mode (single pattern or list) or advanced mode with include/exclude rules, simple-vs-regex matching, and match-type selection (full URL, path, domain, query, hash)
- **Per-variant code injection** — four injection points (head start, head end, body start, body end) with a syntax-highlighted JS editor, per-injection URL filter, and enable/disable toggle

### Editing DOM changes

The DOM changes editor is where each variant's modifications are defined. Two surfaces are available for every variant:

- **Inline editor** — visual list with one row per change, dedicated sub-editors for each change type
- **JSON editor** — raw JSON with CodeMirror syntax highlighting and validation

The 11 supported change types are:

| Type | Purpose |
|------|---------|
| `text` | Replace the element's text content |
| `html` | Replace inner HTML |
| `style` | Set inline CSS properties (with optional `!important` and persist) |
| `styleRules` | Pseudo-state CSS rules (normal / hover / active / focus) |
| `class` | Add, remove, or toggle classes (merge or replace) |
| `attribute` | Set HTML attributes including `data-*` / `aria-*` (merge or replace) |
| `javascript` | Run an inline script with access to `element`, `document`, `window`, `console`, `experimentName` |
| `move` | Relocate the element (before / after / firstChild / lastChild of a target) |
| `remove` | Remove the element from the DOM |
| `insert` | Insert new HTML at a position relative to a selector |
| `create` | Create a new element from HTML |

Per-change options include `waitForElement`, `triggerOnView`, `persistStyle` / `persistAttribute` / `persistScript`, and merge vs replace modes.

A **live preview** toggle applies pending changes against the current tab without saving. JavaScript changes surface diagnostics inline when preview is on.

### Visual editor

Click the paint-brush icon on any variant to launch the on-page visual editor (see `src/visual-editor/README.md` for internals). Capabilities:

- Click-to-pick elements with a hover tooltip
- Context menu: Edit text, Edit HTML, Edit styles, Copy selector, Copy HTML, Hide, Delete, Undelete, Move, Resize
- Mode switcher for rearrange and resize modes (with eight-point resize handles)
- Full undo/redo with Ctrl/Cmd+Z and Ctrl/Cmd+Y
- Robust multi-strategy selector generation
- Shadow-DOM-isolated UI so the host site's styles don't leak in
- All captured mutations are serialized into DOM changes when you save

### AI (Vibe Studio)

Open Vibe Studio from a variant to generate or refine DOM changes conversationally.

Supported providers (configured in Settings → AI Provider):

- **Claude via Claude Code Bridge** — no API key; uses a local Claude Code connection
- **Claude via Anthropic API** — direct API calls, optional custom endpoint
- **OpenAI** — GPT models
- **OpenRouter** — multi-model aggregator
- **Google Gemini**

Features:

- Multi-turn chat with markdown rendering
- Image attachments (auto-compressed screenshots)
- Model picker with dynamic model-list fetching per provider
- Custom system-prompt override via a full-screen markdown editor
- Conversation history persistence per variant
- Change viewer modal showing the generated JSON and the AI's rationale, with copy-to-clipboard and restore-previous-state

### Testing assignments with variant overrides

From the experiment list, each row exposes a variant-override selector. Selecting a variant:

- Forces that variant on the current page (scoped to this device/browser)
- Surfaces a "reload with overrides" banner when the override differs from the SDK's natural assignment
- Supports separate overrides for development environments
- Can be cleared all at once via the list toolbar

Under the hood this uses the query-string / cookie override protocol configured in Settings → Query String Overrides.

### Events debugging

The Events Debug view (Settings → Events Debug) streams SDK events fired on the active page — context creation, exposures, goals, custom events — with timestamps and full payloads. Pause, resume, and clear controls let you isolate specific interactions.

## DOM change JSON format

DOM changes are persisted in a variant's config as an array under the configured field (default `__dom_changes`):

```json
[
  {
    "selector": ".hero-title",
    "type": "text",
    "value": "New Hero Title"
  },
  {
    "selector": ".cta-button",
    "type": "style",
    "value": {
      "background-color": "#28a745",
      "font-size": "20px"
    },
    "important": true
  },
  {
    "selector": ".feature",
    "type": "class",
    "add": ["highlighted"],
    "mode": "merge"
  },
  {
    "selector": "#signup",
    "type": "javascript",
    "value": "element.addEventListener('click', () => console.log('cta clicked'))"
  }
]
```

See `src/types/dom-changes.ts` for the full discriminated union.

## Applying DOM changes on your site

Pair the extension with the ABsmartly DOM changes plugin in your application:

```javascript
import { SDK } from "@absmartly/javascript-sdk"
import { createDOMChangesPlugin } from "@absmartly/dom-changes-plugin"

const sdk = new SDK({
  endpoint: "https://your-endpoint.absmartly.com",
  apiKey: "your-api-key",
  environment: "production",
  application: "website"
})

const context = sdk.createContext({ units: { userId: "user-123" } })

await createDOMChangesPlugin(context, {
  debug: true,
  observeDynamicContent: true
})
```

## Architecture

```
absmartly-browser-extension/
├── background.ts                 # Service worker: API proxy, messaging hub
├── content.ts                    # Injected into every page: visual editor, SDK bridge relay
├── tabs/sidebar.tsx              # Plasmo tab entry for the sidebar React app
├── src/
│   ├── components/               # React UI (sidebar, editors, views)
│   ├── contents/sidebar.tsx      # Sidebar injection entry
│   ├── content/                  # Element picker + on-page helpers
│   ├── visual-editor/            # On-page visual editor (see its README)
│   ├── sdk-bridge/               # Bridge injected into the page context
│   ├── injection/                # SDK plugin loader
│   ├── lib/                      # API client, storage, AI providers
│   ├── hooks/                    # Shared React hooks
│   ├── contexts/                 # React context providers
│   ├── prompts/                  # Default AI system prompts
│   ├── types/                    # TypeScript types (dom-changes, messages, etc.)
│   └── utils/                    # Helpers
├── public/                       # Static assets, including built SDK-changes plugin
└── scripts/                      # Build scripts (dev-build, post-build, build-sdk-bridge)
```

Messaging: background service worker is the hub. The sidebar talks to background via a port, content scripts relay page events, and the SDK bridge uses `window.postMessage` inside the page.

## Development

### Common scripts

```bash
npm run dev                 # Plasmo dev server + SDK bridge watcher
npm run build:dev           # One-shot development build (used by tests)
npm run build               # Production build for all browsers
npm run build:sdk-bridge    # Rebuild just the injected SDK bridge bundle
npm run package             # Package extension zip for store submission
npm run typecheck           # TypeScript check, no emit

npm run test                # Unit + E2E
npm run test:unit           # Jest unit tests
npm run test:unit:watch     # Jest in watch mode
npm run test:unit:coverage  # Jest with coverage
npm run test:e2e            # Playwright E2E (requires build:dev first)
npm run test:e2e:ui         # Playwright UI mode
npm run test:quick          # Unit + visual-editor E2E only
```

### Testing

- **Unit tests** live beside source in `__tests__` directories and under `src/**/__tests__`; run with `npm run test:unit`.
- **E2E tests** live in `tests/e2e/` and use Playwright against the built extension in `build/chrome-mv3-dev`. Always run `npm run build:dev` first.
- Run a single E2E spec: `npx playwright test tests/e2e/visual-editor-complete.spec.ts`.

### Code style

- Prettier with 2-space indent, no semicolons, double quotes (see `.prettierrc.mjs`)
- TypeScript strict mode
- Tailwind CSS for styling

## Browser compatibility

- Chrome / Chromium — Manifest V3
- Microsoft Edge
- Firefox
- Safari (via Plasmo)

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit with a clear message; follow the existing `type(scope): subject` pattern (`fix(dom-editor): ...`, `test(e2e): ...`).
4. `npm run typecheck && npm run test:unit` before pushing.
5. Open a pull request.

## License

MIT — see `LICENSE`.

## Support

- [ABsmartly documentation](https://docs.absmartly.com)
- [Report issues](https://github.com/absmartly/browser-extension/issues)
