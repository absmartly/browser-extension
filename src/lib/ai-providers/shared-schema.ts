// Shared JSON schema for all AI providers
// This is the single source of truth for the response structure
export const SHARED_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    domChanges: {
      type: 'array',
      description: 'Array of DOM change objects. Each must have: selector (CSS), type (text|html|style|styleRules|class|attribute|javascript|move|create|delete), and type-specific properties.',
      items: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for target element(s)' },
          type: {
            type: 'string',
            enum: ['text', 'html', 'style', 'styleRules', 'class', 'attribute', 'javascript', 'move', 'create', 'delete'],
            description: 'Type of DOM change to apply'
          },
          value: { description: 'Value for text/html/attribute changes, or CSS object for style changes' },
          css: { type: 'object', description: 'CSS properties object for style type (alternative to value)' },
          states: { type: 'object', description: 'CSS states for styleRules type (normal, hover, active, focus)' },
          add: { type: 'array', items: { type: 'string' }, description: 'Classes to add (for class type)' },
          remove: { type: 'array', items: { type: 'string' }, description: 'Classes to remove (for class type)' },
          element: { type: 'string', description: 'HTML to create (for create type)' },
          targetSelector: { type: 'string', description: 'Target location (for move/create types)' },
          position: { type: 'string', enum: ['before', 'after', 'firstChild', 'lastChild'], description: 'Position relative to target' },
          important: { type: 'boolean', description: 'Add !important flag to styles' },
          waitForElement: { type: 'boolean', description: 'Wait for element to appear (SPA mode)' }
        },
        required: ['selector', 'type']
      }
    },
    response: {
      type: 'string',
      description: 'Markdown explanation of what you changed and why. No action descriptions (no "I\'ll click..." or "Let me navigate...").'
    },
    action: {
      type: 'string',
      enum: ['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'],
      description: 'How to apply changes: append=add to existing, replace_all=clear all first, replace_specific=replace specific selectors, remove_specific=remove specific selectors, none=no changes'
    },
    targetSelectors: {
      type: 'array',
      description: 'CSS selectors to target when action is replace_specific or remove_specific',
      items: { type: 'string' }
    }
  },
  required: ['domChanges', 'response', 'action']
} as const
