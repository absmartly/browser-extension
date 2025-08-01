import type { Context } from '@absmartly/javascript-sdk';

/**
 * DOM change instruction interface
 */
export interface DOMChangeInstruction {
  selector: string;
  action: 'text' | 'html' | 'style' | 'attribute' | 'class' | 'javascript';
  value?: string;
  attribute?: string;
  css?: Record<string, string>;
  className?: string;
  script?: string;
  // Additional options for advanced features
  waitForElement?: boolean;
  applyOnce?: boolean;
  priority?: number;
}

/**
 * Configuration options for the DOM changes plugin
 */
export interface DOMChangesPluginOptions {
  /** Variable name to read DOM changes from (default: 'dom_changes') */
  variableName?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum wait time for elements (ms) */
  maxWaitTime?: number;
  /** Check interval for elements (ms) */
  checkInterval?: number;
  /** Enable MutationObserver for dynamic content */
  observeDynamicContent?: boolean;
}

/**
 * ABSmartly DOM Changes Plugin
 * Applies DOM modifications based on experiment variant variables
 */
export class ABSmartlyDOMChangesPlugin {
  private context: Context | null = null;
  private options: Required<DOMChangesPluginOptions>;
  private observer: MutationObserver | null = null;
  private appliedChanges: Set<string> = new Set();
  private pendingChanges: Map<string, DOMChangeInstruction> = new Map();
  private elementObservers: Map<string, MutationObserver> = new Map();

  constructor(options: DOMChangesPluginOptions = {}) {
    this.options = {
      variableName: options.variableName || 'dom_changes',
      debug: options.debug || false,
      maxWaitTime: options.maxWaitTime || 10000,
      checkInterval: options.checkInterval || 100,
      observeDynamicContent: options.observeDynamicContent !== false
    };
  }

  /**
   * Initialize the plugin with an ABSmartly context
   */
  async initialize(context: Context): Promise<void> {
    this.context = context;
    
    try {
      await context.ready();
      this.log('Context ready, applying DOM changes');
      
      const changes = this.getChangesFromContext();
      if (changes && changes.length > 0) {
        await this.applyChanges(changes);
        
        if (this.options.observeDynamicContent) {
          this.startGlobalObserver();
        }
      }
    } catch (error) {
      this.error('Failed to initialize plugin:', error);
    }
  }

  /**
   * Get DOM changes from the ABSmartly context
   */
  private getChangesFromContext(): DOMChangeInstruction[] {
    if (!this.context) return [];

    const changesJson = this.context.variableValue(this.options.variableName, '[]');
    
    try {
      const changes = typeof changesJson === 'string' 
        ? JSON.parse(changesJson) 
        : changesJson;
      
      if (!Array.isArray(changes)) {
        this.error('DOM changes must be an array');
        return [];
      }
      
      return changes;
    } catch (error) {
      this.error('Failed to parse DOM changes:', error);
      return [];
    }
  }

  /**
   * Apply a list of DOM changes
   */
  private async applyChanges(changes: DOMChangeInstruction[]): Promise<void> {
    // Sort by priority if specified
    const sortedChanges = [...changes].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    for (const change of sortedChanges) {
      await this.applyChange(change);
    }
  }

  /**
   * Apply a single DOM change
   */
  private async applyChange(change: DOMChangeInstruction): Promise<void> {
    const changeKey = this.getChangeKey(change);
    
    // Skip if already applied and applyOnce is true
    if (change.applyOnce && this.appliedChanges.has(changeKey)) {
      this.log(`Change already applied: ${changeKey}`);
      return;
    }

    const element = document.querySelector(change.selector);
    
    if (element) {
      this.applyChangeToElement(element as HTMLElement, change);
      this.appliedChanges.add(changeKey);
      
      // Remove from pending if it was waiting
      this.pendingChanges.delete(changeKey);
    } else if (change.waitForElement !== false) {
      // Add to pending and wait for element
      this.pendingChanges.set(changeKey, change);
      this.waitForElement(change);
    } else {
      this.warn(`Element not found for selector: ${change.selector}`);
    }
  }

  /**
   * Apply change to a specific element
   */
  private applyChangeToElement(element: HTMLElement, change: DOMChangeInstruction): void {
    this.log(`Applying ${change.action} to ${change.selector}`);

    try {
      switch (change.action) {
        case 'text':
          if (change.value !== undefined) {
            element.textContent = change.value;
          }
          break;

        case 'html':
          if (change.value !== undefined) {
            element.innerHTML = change.value;
          }
          break;

        case 'style':
          if (change.css && typeof change.css === 'object') {
            for (const [property, value] of Object.entries(change.css)) {
              element.style.setProperty(property, value);
            }
          }
          break;

        case 'attribute':
          if (change.attribute && change.value !== undefined) {
            element.setAttribute(change.attribute, change.value);
          }
          break;

        case 'class':
          if (change.className) {
            if (change.value === 'add') {
              element.classList.add(change.className);
            } else if (change.value === 'remove') {
              element.classList.remove(change.className);
            } else if (change.value === 'toggle') {
              element.classList.toggle(change.className);
            }
          }
          break;

        case 'javascript':
          if (change.script) {
            try {
              // Create a function with the element in scope
              const func = new Function('element', change.script);
              func.call(window, element);
            } catch (error) {
              this.error(`Error executing JavaScript for ${change.selector}:`, error);
            }
          }
          break;

        default:
          this.warn(`Unknown action type: ${change.action}`);
      }

      // Observe this specific element for removal
      if (this.options.observeDynamicContent) {
        this.observeElement(element, change);
      }
    } catch (error) {
      this.error(`Error applying change to ${change.selector}:`, error);
    }
  }

  /**
   * Wait for an element to appear in the DOM
   */
  private waitForElement(change: DOMChangeInstruction): void {
    const changeKey = this.getChangeKey(change);
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(change.selector);
      
      if (element) {
        this.log(`Element found after waiting: ${change.selector}`);
        this.applyChangeToElement(element as HTMLElement, change);
        this.appliedChanges.add(changeKey);
        this.pendingChanges.delete(changeKey);
      } else if (Date.now() - startTime > this.options.maxWaitTime) {
        this.warn(`Timeout waiting for element: ${change.selector}`);
        this.pendingChanges.delete(changeKey);
      } else {
        setTimeout(checkElement, this.options.checkInterval);
      }
    };

    checkElement();
  }

  /**
   * Start global MutationObserver for dynamic content
   */
  private startGlobalObserver(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      // Check if any pending changes can now be applied
      for (const [changeKey, change] of this.pendingChanges.entries()) {
        const element = document.querySelector(change.selector);
        if (element) {
          this.applyChangeToElement(element as HTMLElement, change);
          this.appliedChanges.add(changeKey);
          this.pendingChanges.delete(changeKey);
        }
      }

      // Check if any applied elements were removed and need reapplication
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          this.handleRemovedNodes(mutation.removedNodes);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.log('Started global MutationObserver');
  }

  /**
   * Observe a specific element for removal
   */
  private observeElement(element: HTMLElement, change: DOMChangeInstruction): void {
    const changeKey = this.getChangeKey(change);
    
    // Clean up existing observer if any
    const existingObserver = this.elementObservers.get(changeKey);
    if (existingObserver) {
      existingObserver.disconnect();
    }

    const observer = new MutationObserver(() => {
      // Check if element is still in DOM
      if (!document.contains(element)) {
        this.log(`Element removed from DOM: ${change.selector}`);
        // Mark as not applied so it can be reapplied if element reappears
        this.appliedChanges.delete(changeKey);
        this.pendingChanges.set(changeKey, change);
        observer.disconnect();
        this.elementObservers.delete(changeKey);
      }
    });

    // Observe the parent for child removals
    if (element.parentNode) {
      observer.observe(element.parentNode, {
        childList: true
      });
      this.elementObservers.set(changeKey, observer);
    }
  }

  /**
   * Handle removed nodes
   */
  private handleRemovedNodes(removedNodes: NodeList): void {
    removedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        // Check if any of our applied changes were on this element or its children
        for (const changeKey of this.appliedChanges) {
          const change = this.getChangeFromKey(changeKey);
          if (change && (element.matches(change.selector) || element.querySelector(change.selector))) {
            this.log(`Applied element removed: ${change.selector}`);
            this.appliedChanges.delete(changeKey);
            this.pendingChanges.set(changeKey, change);
          }
        }
      }
    });
  }

  /**
   * Generate a unique key for a change
   */
  private getChangeKey(change: DOMChangeInstruction): string {
    return `${change.selector}-${change.action}-${change.attribute || ''}-${change.className || ''}`;
  }

  /**
   * Get change from key (for reapplication)
   */
  private getChangeFromKey(changeKey: string): DOMChangeInstruction | null {
    // Check pending changes first
    for (const [key, change] of this.pendingChanges) {
      if (key === changeKey) return change;
    }
    
    // If not in pending, we need to get it from the original context
    const allChanges = this.getChangesFromContext();
    for (const change of allChanges) {
      if (this.getChangeKey(change) === changeKey) {
        return change;
      }
    }
    
    return null;
  }

  /**
   * Clean up observers and resources
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    for (const observer of this.elementObservers.values()) {
      observer.disconnect();
    }
    this.elementObservers.clear();

    this.appliedChanges.clear();
    this.pendingChanges.clear();
    this.context = null;

    this.log('Plugin destroyed');
  }

  /**
   * Logging utilities
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[ABSmartly DOM Changes]', ...args);
    }
  }

  private warn(...args: any[]): void {
    console.warn('[ABSmartly DOM Changes]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[ABSmartly DOM Changes]', ...args);
  }
}

/**
 * Factory function to create and initialize the plugin
 */
export async function createDOMChangesPlugin(
  context: Context,
  options?: DOMChangesPluginOptions
): Promise<ABSmartlyDOMChangesPlugin> {
  const plugin = new ABSmartlyDOMChangesPlugin(options);
  await plugin.initialize(context);
  return plugin;
}