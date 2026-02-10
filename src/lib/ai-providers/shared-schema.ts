import type { JSONSchema } from './tool-types'

export const SHARED_TOOL_SCHEMA: JSONSchema = {
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
          value: { description: 'Value for text/html/attribute changes, or CSS properties object for style changes' },
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

export const CSS_QUERY_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    selectors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of CSS selectors for elements to retrieve (e.g., ["#main-content", ".hero-section", "header"])'
    }
  },
  required: ['selectors']
} as const

export const CSS_QUERY_DESCRIPTION = 'Retrieves the HTML content of page sections by CSS selector(s). Use this to inspect elements before making changes. You can request multiple selectors at once for efficiency.'

export const XPATH_QUERY_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    xpath: {
      type: 'string',
      description: 'XPath expression to evaluate. Examples: "//button[contains(text(), \'Submit\')]", "//div[@class=\'card\']//h2", "//a[starts-with(@href, \'https\')]", "//*[contains(@class, \'hero\') and contains(text(), \'Welcome\')]"'
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of results to return (default: 10)'
    }
  },
  required: ['xpath']
} as const

export const XPATH_QUERY_DESCRIPTION = 'Executes an XPath query on the page DOM. Use this for complex element selection that CSS selectors cannot handle, such as selecting by text content, parent/ancestor traversal, or complex conditions. Returns matching nodes with their HTML and generated CSS selectors.'

export const DOM_CHANGES_TOOL_DESCRIPTION = 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.'
