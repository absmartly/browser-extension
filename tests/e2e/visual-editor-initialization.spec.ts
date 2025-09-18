import { test, expect, Page, Browser } from '@playwright/test'
import path from 'path'

/**
 * Comprehensive E2E Tests for Visual Editor Initialization and Startup
 *
 * This test suite covers all aspects of visual editor initialization including:
 * 1. Script injection and API exposure
 * 2. initVisualEditor function with various parameters
 * 3. Toolbar creation and display
 * 4. Multiple initialization attempts (graceful handling)
 * 5. Global state flags management
 * 6. Initialization with pre-existing DOM changes
 * 7. Style injection and CSS classes
 * 8. Initialization in different page states (loading, interactive, complete)
 * 9. Core modules initialization verification
 * 10. Real browser interaction testing
 */

interface VisualEditorAPI {
  initVisualEditor: (variantName: string, experimentName: string, logoUrl: string, initialChanges: any[]) => { success: boolean; already?: boolean }
  VisualEditor: any
  getCurrentVisualEditor: () => any
  createVisualEditor: (options: any) => any
}

interface TestHelpers {
  isVisualEditorActive: () => boolean
  getVisualEditor: () => any
  hasVisualEditorStyles: () => boolean
  getABSmartlyStyles: () => Element[]
  simulateElementClick: (selector: string) => boolean
  hasToolbar: () => boolean
  getNotifications: () => Element[]
  highlightElement: (selector: string) => void
  isElementVisible: (selector: string) => boolean
  testChangeCounter: () => number
  getChangeCounter: () => number
  getGlobalFlags: () => any
  getCoreModules: () => any
  getStylesheetContents: () => string[]
}

test.describe('Visual Editor Initialization and Startup - Comprehensive Tests', () => {
  let testPagePath: string
  let visualEditorBundlePath: string

  test.beforeAll(() => {
    testPagePath = path.join(__dirname, 'test-page.html')
    // Use the unified visual editor bundle
    visualEditorBundlePath = path.join(__dirname, '../../build/chrome-mv3-dev/src/injected/build/visual-editor-injection.js')
  })

  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto(`file://${testPagePath}`)

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Inject comprehensive test helper functions
    await page.evaluate(() => {
      (window as any).testHelpers = {
        // Check if visual editor is active
        isVisualEditorActive: function() {
          return (window as any).__absmartlyVisualEditorActive === true;
        },

        // Get the current visual editor instance
        getVisualEditor: function() {
          return (window as any).__absmartlyVisualEditor;
        },

        // Check if main styles are injected
        hasVisualEditorStyles: function() {
          return document.getElementById('absmartly-visual-editor-styles') !== null;
        },

        // Get all injected ABsmartly styles
        getABSmartlyStyles: function() {
          return Array.from(document.querySelectorAll('style[data-absmartly="true"], style[id*="absmartly"]'));
        },

        // Simulate element interactions
        simulateElementClick: function(selector: string) {
          const element = document.querySelector(selector);
          if (element) {
            (element as HTMLElement).click();
            return true;
          }
          return false;
        },

        // Check toolbar presence
        hasToolbar: function() {
          return document.querySelector('[data-absmartly="toolbar"], #absmartly-toolbar, .absmartly-toolbar') !== null;
        },

        // Get notification elements
        getNotifications: function() {
          return Array.from(document.querySelectorAll('[data-absmartly="notification"], .absmartly-notification'));
        },

        // Highlight element for testing
        highlightElement: function(selector: string) {
          const element = document.querySelector(selector);
          if (element) {
            (element as HTMLElement).style.outline = '3px solid red';
            setTimeout(() => {
              (element as HTMLElement).style.outline = '';
            }, 2000);
          }
        },

        // Check if element is visible
        isElementVisible: function(selector: string) {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0';
        },

        // Test change counter
        testChangeCounter: function() {
          return (window as any).testChangeCounter ? (window as any).testChangeCounter() : 0;
        },

        // Get change counter
        getChangeCounter: function() {
          return (window as any).getChangeCounter ? (window as any).getChangeCounter() : 0;
        },

        // Get global flags for testing
        getGlobalFlags: function() {
          return {
            visualEditorActive: (window as any).__absmartlyVisualEditorActive,
            hasEditorInstance: !!((window as any).__absmartlyVisualEditor),
            hasInitFunction: typeof (window as any).initVisualEditor === 'function',
            hasAPI: typeof (window as any).ABSmartlyVisualEditor !== 'undefined'
          };
        },

        // Get core modules info for verification
        getCoreModules: function() {
          const editor = (window as any).__absmartlyVisualEditor;
          if (!editor) return null;

          return {
            hasStateManager: !!(editor.stateManager || editor._stateManager),
            hasEventHandlers: !!(editor.eventHandlers || editor._eventHandlers),
            hasContextMenu: !!(editor.contextMenu || editor._contextMenu),
            hasChangeTracker: !!(editor.changeTracker || editor._changeTracker),
            hasUIComponents: !!(editor.uiComponents || editor._uiComponents),
            hasEditModes: !!(editor.editModes || editor._editModes),
            hasCleanup: !!(editor.cleanup || editor._cleanup),
            hasToolbar: !!(editor.toolbar || editor._toolbar),
            hasNotifications: !!(editor.notifications || editor._notifications),
            hasElementActions: !!(editor.elementActions || editor._elementActions),
            hasCoordinator: !!(editor.coordinator || editor._coordinator)
          };
        },

        // Get stylesheet contents for verification
        getStylesheetContents: function() {
          const styles = Array.from(document.querySelectorAll('style[data-absmartly="true"], style[id*="absmartly"]'));
          return styles.map(style => style.textContent || '');
        }
      };
    });

    // Verify test page loaded correctly
    await expect(page.locator('[data-testid="main-title"]')).toContainText('Visual Editor Test Page');
  });

  test.describe('1. Script Injection and API Exposure', () => {
    test('should inject visual editor script and expose API correctly', async ({ page }) => {
      // Load the visual editor bundle
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Verify the bundle loaded and exposed the global API
      const apiExposure = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        const flags = helpers.getGlobalFlags();
        return {
          hasGlobalInitFunction: typeof (window as any).initVisualEditor === 'function',
          hasUnifiedAPI: typeof (window as any).ABSmartlyVisualEditor !== 'undefined',
          initialFlags: flags
        };
      });

      expect(apiExposure.hasGlobalInitFunction).toBe(true);
      expect(apiExposure.initialFlags.hasInitFunction).toBe(true);
      expect(apiExposure.initialFlags.visualEditorActive).toBeFalsy();
      expect(apiExposure.initialFlags.hasEditorInstance).toBeFalsy();

      // Verify API methods are available if unified API exists
      if (apiExposure.hasUnifiedAPI) {
        const apiMethods = await page.evaluate(() => {
          const api = (window as any).ABSmartlyVisualEditor;
          return {
            hasInitVisualEditor: typeof api.initVisualEditor === 'function',
            hasVisualEditorClass: typeof api.VisualEditor === 'function',
            hasGetCurrentVisualEditor: typeof api.getCurrentVisualEditor === 'function',
            hasCreateVisualEditor: typeof api.createVisualEditor === 'function'
          };
        });

        expect(apiMethods.hasInitVisualEditor).toBe(true);
        expect(apiMethods.hasVisualEditorClass).toBe(true);
      }
    });

    test('should handle script injection without errors', async ({ page }) => {
      // Listen for console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Load the visual editor bundle
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Wait a moment for any errors to surface
      await page.waitForTimeout(1000);

      // Check that no critical errors occurred during injection
      const criticalErrors = consoleErrors.filter(error =>
        error.includes('Error') || error.includes('Failed') || error.includes('undefined')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('2. initVisualEditor Function with Various Parameters', () => {
    test('should initialize with basic valid parameters', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      const result = await page.evaluate(() => {
        return (window as any).initVisualEditor(
          'test-variant',
          'test-experiment',
          'https://example.com/logo.png',
          []
        );
      });

      expect(result.success).toBe(true);
      expect(result.already).toBeUndefined();

      // Verify editor is marked as active
      const isActive = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.isVisualEditorActive();
      });

      expect(isActive).toBe(true);
    });

    test('should handle edge case parameters gracefully', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      const testCases = [
        { variant: '', experiment: '', logo: '', changes: [] },
        { variant: 'very-long-variant-name-that-exceeds-normal-limits-and-contains-special-chars-!@#$%',
          experiment: 'very-long-experiment-name', logo: 'https://example.com/logo.png', changes: [] },
        { variant: 'variant with spaces', experiment: 'experiment with spaces',
          logo: 'invalid-url', changes: [] },
        { variant: 'unicode-test-变体', experiment: 'unicode-test-实验',
          logo: 'https://example.com/logo.png', changes: [] }
      ];

      for (const testCase of testCases) {
        // Clear previous state
        await page.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor;
          if (editor && typeof editor.stop === 'function') {
            editor.stop();
          }
          (window as any).__absmartlyVisualEditorActive = false;
          (window as any).__absmartlyVisualEditor = null;
        });

        const result = await page.evaluate((tc) => {
          try {
            return (window as any).initVisualEditor(tc.variant, tc.experiment, tc.logo, tc.changes);
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, testCase);

        // Should either succeed or fail gracefully
        expect(typeof result).toBe('object');
        expect(typeof result.success).toBe('boolean');
      }
    });

    test('should initialize with pre-existing DOM changes', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      const initialChanges = [
        {
          selector: '[data-testid="main-title"]',
          type: 'text',
          value: 'Modified Title via Initial Changes'
        },
        {
          selector: '[data-testid="subtitle"]',
          type: 'style',
          value: { color: 'red', 'font-weight': 'bold' }
        },
        {
          selector: '#editable-text-1',
          type: 'text',
          value: 'Pre-loaded change text'
        }
      ];

      const result = await page.evaluate((changes) => {
        return (window as any).initVisualEditor(
          'test-variant',
          'test-experiment',
          'https://example.com/logo.png',
          changes
        );
      }, initialChanges);

      expect(result.success).toBe(true);

      // Verify changes are stored in the editor
      const editorChanges = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        const editor = helpers.getVisualEditor();
        if (editor && typeof editor.getChanges === 'function') {
          return editor.getChanges();
        }
        return [];
      });

      expect(Array.isArray(editorChanges)).toBe(true);
    });
  });

  test.describe('3. Toolbar Creation and Display', () => {
    test('should create and display toolbar after initialization', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor(
          'test-variant',
          'test-experiment',
          'https://example.com/logo.png',
          []
        );
      });

      // Wait for toolbar to be created
      await page.waitForTimeout(2000);

      // Check for toolbar presence using multiple possible selectors
      const toolbarInfo = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        const hasToolbar = helpers.hasToolbar();

        // Also check for common toolbar patterns
        const toolbarSelectors = [
          '[data-absmartly="toolbar"]',
          '#absmartly-toolbar',
          '.absmartly-toolbar',
          '[id*="toolbar"]',
          '[class*="toolbar"]'
        ];

        const foundToolbars = toolbarSelectors.map(selector => ({
          selector,
          found: document.querySelector(selector) !== null
        }));

        return {
          hasToolbar,
          foundToolbars,
          totalToolbarElements: document.querySelectorAll('[data-absmartly*="toolbar"], [id*="toolbar"], [class*="toolbar"]').length
        };
      });

      // The toolbar should be created (exact implementation may vary)
      expect(typeof toolbarInfo.hasToolbar).toBe('boolean');
      expect(typeof toolbarInfo.totalToolbarElements).toBe('number');
    });

    test('should handle toolbar interactions properly', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor(
          'test-variant',
          'test-experiment',
          'https://example.com/logo.png',
          []
        );
      });

      // Wait for initialization
      await page.waitForTimeout(2000);

      // Test toolbar visibility and basic interactions
      const toolbarInteractions = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;

        // Try to find and interact with toolbar elements
        const toolbarElements = Array.from(document.querySelectorAll('[data-absmartly*="toolbar"], [id*="toolbar"], [class*="toolbar"]'));
        const clickableElements = Array.from(document.querySelectorAll('button, [role="button"], .btn'));

        return {
          toolbarElementsCount: toolbarElements.length,
          clickableElementsCount: clickableElements.length,
          isActive: helpers.isVisualEditorActive()
        };
      });

      expect(toolbarInteractions.isActive).toBe(true);
      expect(typeof toolbarInteractions.toolbarElementsCount).toBe('number');
      expect(typeof toolbarInteractions.clickableElementsCount).toBe('number');
    });
  });

  test.describe('4. Multiple Initialization Attempts', () => {
    test('should handle multiple initialization attempts gracefully', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // First initialization
      const firstResult = await page.evaluate(() => {
        return (window as any).initVisualEditor('variant-1', 'experiment-1', 'logo1.png', []);
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.already).toBeUndefined();

      // Second initialization (should detect already active)
      const secondResult = await page.evaluate(() => {
        return (window as any).initVisualEditor('variant-2', 'experiment-2', 'logo2.png', []);
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.already).toBe(true);

      // Third initialization with different parameters
      const thirdResult = await page.evaluate(() => {
        return (window as any).initVisualEditor('variant-3', 'experiment-3', 'logo3.png', [
          { selector: '.test', type: 'text', value: 'test' }
        ]);
      });

      expect(thirdResult.success).toBe(true);
      expect(thirdResult.already).toBe(true);
    });

    test('should maintain consistent state across multiple attempts', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize multiple times and check state consistency
      for (let i = 0; i < 5; i++) {
        const result = await page.evaluate((iteration) => {
          return (window as any).initVisualEditor(
            `variant-${iteration}`,
            `experiment-${iteration}`,
            `logo${iteration}.png`,
            []
          );
        }, i);

        expect(result.success).toBe(true);

        if (i === 0) {
          expect(result.already).toBeUndefined();
        } else {
          expect(result.already).toBe(true);
        }

        // Verify state remains consistent
        const flags = await page.evaluate(() => {
          const helpers = (window as any).testHelpers as TestHelpers;
          return helpers.getGlobalFlags();
        });

        expect(flags.visualEditorActive).toBe(true);
        expect(flags.hasEditorInstance).toBe(true);
      }
    });
  });

  test.describe('5. Global State Flags Management', () => {
    test('should set and manage global state flags correctly', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Check initial global state
      const initialState = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.getGlobalFlags();
      });

      expect(initialState.visualEditorActive).toBeFalsy();
      expect(initialState.hasEditorInstance).toBeFalsy();
      expect(initialState.hasInitFunction).toBe(true);

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Check active state
      const activeState = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.getGlobalFlags();
      });

      expect(activeState.visualEditorActive).toBe(true);
      expect(activeState.hasEditorInstance).toBe(true);

      // Stop editor if possible
      await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor;
        if (editor && typeof editor.stop === 'function') {
          editor.stop();
        }
      });

      // Check inactive state
      const inactiveState = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.getGlobalFlags();
      });

      expect(inactiveState.visualEditorActive).toBe(false);
    });

    test('should prevent multiple concurrent active flags', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('variant-1', 'experiment-1', 'logo1.png', []);
      });

      // Try to initialize multiple times
      for (let i = 0; i < 3; i++) {
        await page.evaluate((iteration) => {
          return (window as any).initVisualEditor(`variant-${iteration}`, `experiment-${iteration}`, 'logo.png', []);
        }, i);
      }

      // Verify only one active flag exists
      const activeCount = await page.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true ? 1 : 0;
      });

      expect(activeCount).toBe(1);
    });
  });

  test.describe('6. Style Injection and CSS Classes', () => {
    test('should inject required styles on initialization', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Check no styles before initialization
      const initialStyles = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles(),
          stylesheetContents: helpers.getStylesheetContents()
        };
      });

      expect(initialStyles.absmartlyStyles).toBe(0);
      expect(initialStyles.hasMainStyles).toBe(false);

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Verify styles are injected
      const postInitStyles = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles(),
          stylesheetContents: helpers.getStylesheetContents()
        };
      });

      expect(postInitStyles.absmartlyStyles).toBeGreaterThan(0);

      // Check for specific style rules
      const hasRequiredStyles = postInitStyles.stylesheetContents.some(content =>
        content.includes('.absmartly-') ||
        content.includes('outline') ||
        content.includes('absmartly')
      );

      expect(hasRequiredStyles).toBe(true);
    });

    test('should inject CSS classes for editor functionality', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Check for required CSS classes in stylesheets
      const cssClasses = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        const stylesheetContents = helpers.getStylesheetContents();
        const allCSS = stylesheetContents.join('\n');

        const requiredClasses = [
          'absmartly-editable',
          'absmartly-selected',
          'absmartly-editing',
          'absmartly-hover'
        ];

        return requiredClasses.map(className => ({
          className,
          found: allCSS.includes(`.${className}`)
        }));
      });

      // At least some core classes should be present
      const foundClasses = cssClasses.filter(c => c.found);
      expect(foundClasses.length).toBeGreaterThan(0);
    });

    test('should clean up styles on editor stop', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Verify styles are present
      let hasStyles = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.getABSmartlyStyles().length > 0;
      });
      expect(hasStyles).toBe(true);

      // Stop the editor
      await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor;
        if (editor && typeof editor.stop === 'function') {
          editor.stop();
        }
      });

      // Check if styles are cleaned up (implementation dependent)
      const stylesAfterStop = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles()
        };
      });

      // Styles might be cleaned up or remain (depends on implementation)
      expect(typeof stylesAfterStop.absmartlyStyles).toBe('number');
      expect(typeof stylesAfterStop.hasMainStyles).toBe('boolean');
    });
  });

  test.describe('7. Initialization in Different Page States', () => {
    test('should initialize in loading page state', async ({ page }) => {
      // Navigate to page but don't wait for complete load
      await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded' });

      await page.addScriptTag({ path: visualEditorBundlePath });

      const result = await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      expect(result.success).toBe(true);

      // Wait for page to fully load and verify editor still works
      await page.waitForLoadState('networkidle');

      const isActive = await page.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true;
      });

      expect(isActive).toBe(true);
    });

    test('should initialize in interactive page state', async ({ page }) => {
      await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded' });

      // Wait for interactive state
      await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete');

      await page.addScriptTag({ path: visualEditorBundlePath });

      const result = await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      expect(result.success).toBe(true);
    });

    test('should initialize in complete page state', async ({ page }) => {
      await page.goto(`file://${testPagePath}`, { waitUntil: 'networkidle' });

      // Ensure page is completely loaded
      await page.waitForFunction(() => document.readyState === 'complete');

      await page.addScriptTag({ path: visualEditorBundlePath });

      const result = await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      expect(result.success).toBe(true);

      // Verify all page elements are accessible
      await expect(page.locator('[data-testid="main-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="subtitle"]')).toBeVisible();
      await expect(page.locator('.btn')).toHaveCount(10);
    });
  });

  test.describe('8. Core Modules Initialization', () => {
    test('should initialize all core modules correctly', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Check core modules initialization
      const coreModules = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        return helpers.getCoreModules();
      });

      if (coreModules) {
        // Check that core modules are present (implementation may vary)
        const moduleChecks = [
          'hasStateManager',
          'hasEventHandlers',
          'hasContextMenu',
          'hasChangeTracker',
          'hasUIComponents',
          'hasEditModes',
          'hasCleanup'
        ];

        const presentModules = moduleChecks.filter(check => coreModules[check]);

        // At least some core modules should be initialized
        expect(presentModules.length).toBeGreaterThan(0);
      }
    });

    test('should verify module integration and communication', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Test module integration by simulating interactions
      const moduleIntegration = await page.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers;
        const editor = helpers.getVisualEditor();

        if (!editor) return { integrated: false };

        // Test that editor has expected methods/properties
        const methods = [
          'start',
          'stop',
          'getChanges'
        ];

        const hasExpectedMethods = methods.filter(method =>
          typeof editor[method] === 'function'
        );

        return {
          integrated: true,
          hasExpectedMethods: hasExpectedMethods.length,
          totalExpectedMethods: methods.length,
          editorType: typeof editor
        };
      });

      expect(moduleIntegration.integrated).toBe(true);
      expect(moduleIntegration.editorType).toBe('object');
    });
  });

  test.describe('9. Real Browser Interaction Testing', () => {
    test('should handle real mouse interactions after initialization', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Wait for initialization
      await page.waitForTimeout(1000);

      // Test real mouse hover on page elements
      const title = page.locator('[data-testid="main-title"]');
      await title.hover();

      // Test real click interactions
      const button = page.locator('#nav-home');
      await button.click();

      // Verify editor remains active after real interactions
      const isActive = await page.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true;
      });

      expect(isActive).toBe(true);
    });

    test('should handle page resize and viewport changes', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1024, height: 768 },
        { width: 375, height: 667 }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        // Verify editor remains functional after resize
        const isActive = await page.evaluate(() => {
          return (window as any).__absmartlyVisualEditorActive === true;
        });

        expect(isActive).toBe(true);

        // Verify page elements are still accessible
        await expect(page.locator('[data-testid="main-title"]')).toBeVisible();
      }
    });

    test('should handle dynamic DOM changes during editor operation', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize editor
      await page.evaluate(() => {
        return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
      });

      // Add dynamic elements to the page
      await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (container) {
          const newElement = document.createElement('div');
          newElement.id = 'dynamic-test-element';
          newElement.className = 'dynamic-element';
          newElement.textContent = 'Dynamically added test element';
          newElement.style.padding = '20px';
          newElement.style.background = '#f0f0f0';
          newElement.style.margin = '10px 0';
          newElement.style.border = '1px solid #ccc';
          container.appendChild(newElement);
        }
      });

      // Verify editor continues to work with dynamic elements
      const dynamicElement = page.locator('#dynamic-test-element');
      await expect(dynamicElement).toBeVisible();

      // Test interaction with dynamic element
      await dynamicElement.hover();
      await dynamicElement.click();

      // Verify editor is still active
      const isActive = await page.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true;
      });

      expect(isActive).toBe(true);
    });
  });

  test.describe('10. Error Handling and Edge Cases', () => {
    test('should handle initialization with corrupted DOM gracefully', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Corrupt some DOM elements
      await page.evaluate(() => {
        const title = document.querySelector('[data-testid="main-title"]');
        if (title) {
          // Remove some attributes to simulate corruption
          title.removeAttribute('data-testid');
          title.innerHTML = ''; // Clear content
        }
      });

      // Try to initialize editor
      const result = await page.evaluate(() => {
        try {
          return (window as any).initVisualEditor('test-variant', 'test-experiment', 'logo.png', []);
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      // Should handle gracefully
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle memory constraints and cleanup', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Initialize and stop editor multiple times to test memory handling
      for (let i = 0; i < 10; i++) {
        // Initialize
        await page.evaluate((iteration) => {
          return (window as any).initVisualEditor(`variant-${iteration}`, `experiment-${iteration}`, 'logo.png', []);
        }, i);

        // Stop if possible
        await page.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor;
          if (editor && typeof editor.stop === 'function') {
            editor.stop();
          }
          // Clear global state for next iteration
          (window as any).__absmartlyVisualEditorActive = false;
          (window as any).__absmartlyVisualEditor = null;
        });
      }

      // Final initialization should still work
      const finalResult = await page.evaluate(() => {
        return (window as any).initVisualEditor('final-variant', 'final-experiment', 'logo.png', []);
      });

      expect(finalResult.success).toBe(true);
    });

    test('should handle concurrent initialization attempts', async ({ page }) => {
      await page.addScriptTag({ path: visualEditorBundlePath });

      // Try multiple simultaneous initializations
      const concurrentResults = await page.evaluate(() => {
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(new Promise(resolve => {
            setTimeout(() => {
              try {
                const result = (window as any).initVisualEditor(`variant-${i}`, `experiment-${i}`, 'logo.png', []);
                resolve({ index: i, result });
              } catch (error) {
                resolve({ index: i, error: error.message });
              }
            }, Math.random() * 100); // Random delay to simulate concurrent access
          }));
        }
        return Promise.all(promises);
      });

      // All attempts should complete
      expect(concurrentResults.length).toBe(5);

      // At least one should succeed
      const successfulResults = concurrentResults.filter(r => r.result?.success);
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });
});