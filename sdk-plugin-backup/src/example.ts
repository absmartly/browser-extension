import { SDK, Context } from '@absmartly/javascript-sdk';
import { createDOMChangesPlugin } from './index';

/**
 * Example usage of the ABSmartly DOM Changes Plugin
 */
async function initializeABSmartly() {
  // Initialize the ABSmartly SDK
  const sdk = new SDK({
    endpoint: 'https://your-absmartly-endpoint.com',
    apiKey: 'your-api-key',
    environment: 'production',
    application: 'website'
  });

  // Create a context
  const context = sdk.createContext({
    units: {
      userId: 'user-123',
      sessionId: 'session-456'
    }
  });

  // Initialize the DOM Changes plugin
  const domPlugin = await createDOMChangesPlugin(context, {
    debug: true,
    observeDynamicContent: true,
    maxWaitTime: 5000
  });

  // The plugin will automatically apply DOM changes based on the variant

  // Clean up when done (e.g., on page unload)
  window.addEventListener('beforeunload', () => {
    domPlugin.destroy();
  });
}

// Example DOM changes that would be stored in ABSmartly variant variables:
const exampleDOMChanges = [
  {
    selector: '.hero-title',
    action: 'text',
    value: 'Welcome to Our New Experience!'
  },
  {
    selector: '.cta-button',
    action: 'style',
    css: {
      'background-color': '#ff6b6b',
      'font-size': '18px',
      'padding': '15px 30px'
    }
  },
  {
    selector: '.feature-section',
    action: 'class',
    className: 'highlighted',
    value: 'add'
  },
  {
    selector: '.promo-banner',
    action: 'html',
    value: '<strong>Limited Time Offer:</strong> Get 20% off your first purchase!'
  },
  {
    selector: '.product-image',
    action: 'attribute',
    attribute: 'src',
    value: '/images/product-variant-b.jpg'
  },
  {
    selector: '.analytics-trigger',
    action: 'javascript',
    script: `
      element.addEventListener('click', () => {
        console.log('Variant B button clicked');
        // Custom analytics or behavior
      });
    `
  }
];

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeABSmartly);
} else {
  initializeABSmartly();
}