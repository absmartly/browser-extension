# ABSmartly Browser Extension

A powerful browser extension for ABSmartly that enables visual editing of A/B test experiments. Create and manage DOM-based experiments without writing code.

## Features

- 🎨 **Visual Editor**: Select elements on any webpage and apply changes visually
- 🧪 **Experiment Management**: Create, edit, start, and stop experiments directly from the extension
- 🔍 **Advanced Filtering**: Filter experiments by state, significance, owners, tags, and more
- 💾 **DOM Changes**: Apply text, HTML, style, attribute, class, and JavaScript changes
- 🚀 **SDK Integration**: Works seamlessly with the ABSmartly JavaScript SDK
- 🌐 **Multi-browser Support**: Built with Plasmo framework for Chrome, Firefox, Edge, and Safari

## Installation

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/absmartly/browser-extension.git
cd absmartly-browser-extension
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Run the development server:
```bash
pnpm dev
# or
npm run dev
```

4. Load the extension in your browser:
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

### Production Build

```bash
pnpm build
# or
npm run build
```

This creates production builds for all supported browsers in the `build/` directory.

## Configuration

1. Click the ABSmartly extension icon in your browser toolbar
2. Click the settings icon (⚙️)
3. Enter your ABSmartly API credentials:
   - **API Key**: Your ABSmartly API key (JWT or API key format)
   - **API Endpoint**: Your ABSmartly API endpoint (e.g., `https://demo.absmartly.com`)

## Usage

### Visual Editor

1. Navigate to any webpage where you want to create an experiment
2. Click the ABSmartly extension icon
3. Click the paint brush icon (🎨) to open the visual editor
4. Click "Start Selection" to begin selecting elements
5. Click on any element on the page to select it
6. Apply changes:
   - **Text**: Change the text content
   - **Style**: Add CSS properties
   - **Class**: Add, remove, or toggle CSS classes
   - **Attribute**: Set HTML attributes
7. Click "Export Changes as JSON" to copy the changes

### Creating Experiments

1. Click the ABSmartly extension icon
2. Click the plus icon (➕) to create a new experiment
3. Fill in the experiment details:
   - Experiment name and display name
   - Traffic percentage
   - Unit type and primary metric
   - Variants (minimum 2)
4. For each variant, you can:
   - Edit DOM changes manually
   - Import changes from the visual editor
5. Click "Create Experiment" to save

### Filtering Experiments

1. Click the funnel icon (🔽) to expand filters
2. Available filters:
   - **Search**: Search by experiment name
   - **State**: Filter by experiment state (running, stopped, etc.)
   - **Significance**: Filter by result significance
   - **Issues**: Filter by SRM, cleanup needed, etc.
3. Applied filters show a badge with the count

## SDK Plugin

The extension includes a companion SDK plugin for applying DOM changes on your website:

```javascript
import { SDK } from '@absmartly/javascript-sdk';
import { createDOMChangesPlugin } from '@absmartly/dom-changes-plugin';

// Initialize ABSmartly SDK
const sdk = new SDK({
  endpoint: 'https://your-endpoint.absmartly.com',
  apiKey: 'your-api-key',
  environment: 'production',
  application: 'website'
});

// Create context
const context = sdk.createContext({
  units: { userId: 'user-123' }
});

// Initialize DOM Changes plugin
const domPlugin = await createDOMChangesPlugin(context, {
  debug: true,
  observeDynamicContent: true
});
```

## DOM Change Format

DOM changes are stored as JSON in experiment variant variables:

```json
[
  {
    "selector": ".hero-title",
    "action": "text",
    "value": "New Hero Title"
  },
  {
    "selector": ".cta-button",
    "action": "style",
    "css": {
      "background-color": "#28a745",
      "font-size": "20px"
    }
  },
  {
    "selector": ".feature",
    "action": "class",
    "className": "highlighted",
    "value": "add"
  }
]
```

## Architecture

- **Popup**: Main extension UI built with React and Tailwind CSS
- **Content Script**: Injected into web pages for visual editing
- **Background Script**: Handles messaging between popup and content scripts
- **SDK Plugin**: Separate package for applying DOM changes on target websites

## Development

### Project Structure

```
absmartly-browser-extension/
├── popup.tsx              # Main popup UI
├── content.tsx            # Content script for visual editor
├── background.ts          # Background service worker
├── src/
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # API client and utilities
│   ├── types/            # TypeScript types
│   └── utils/            # Helper functions
├── sdk-plugin/           # SDK plugin package
│   ├── src/              # Plugin source code
│   └── tests/            # Plugin tests
└── style.css             # Global styles
```

### Testing

Run tests for the SDK plugin:

```bash
cd sdk-plugin
npm test
```

### Building for Production

```bash
# Build extension
npm run build

# Build SDK plugin
cd sdk-plugin
npm run build
```

## Browser Compatibility

- ✅ Chrome/Chromium (Manifest V3)
- ✅ Microsoft Edge
- ✅ Firefox
- ✅ Safari (via Plasmo)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- [ABSmartly Documentation](https://docs.absmartly.com)
- [Report Issues](https://github.com/absmartly/browser-extension/issues)