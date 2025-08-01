import { ABSmartlyDOMChangesPlugin, createDOMChangesPlugin } from '../src/index';
import type { Context } from '@absmartly/javascript-sdk';

// Mock the ABSmartly context
let mockContext: Partial<Context>;

describe('ABSmartlyDOMChangesPlugin', () => {
  let plugin: ABSmartlyDOMChangesPlugin;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset context mock
    mockContext = {
      ready: jest.fn().mockResolvedValue(undefined),
      variableValue: jest.fn()
    };
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    if (plugin) {
      plugin.destroy();
    }
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should initialize with default options', async () => {
      (mockContext.variableValue as jest.Mock).mockReturnValue('[]');
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(mockContext.ready).toHaveBeenCalled();
      expect(mockContext.variableValue).toHaveBeenCalledWith('dom_changes', '[]');
    });

    it('should use custom variable name', async () => {
      (mockContext.variableValue as jest.Mock).mockReturnValue('[]');
      
      plugin = new ABSmartlyDOMChangesPlugin({ variableName: 'custom_changes' });
      await plugin.initialize(mockContext as Context);

      expect(mockContext.variableValue).toHaveBeenCalledWith('custom_changes', '[]');
    });

    it('should handle initialization errors', async () => {
      (mockContext.ready as jest.Mock).mockRejectedValue(new Error('Context error'));
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Failed to initialize plugin:',
        expect.any(Error)
      );
    });
  });

  describe('DOM changes parsing', () => {
    it('should parse JSON string changes', async () => {
      const changes = [{ selector: '.test', action: 'text', value: 'Hello' }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(JSON.stringify(changes));
      
      document.body.innerHTML = '<div class="test">Original</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test')?.textContent).toBe('Hello');
    });

    it('should handle already parsed changes', async () => {
      const changes = [{ selector: '.test', action: 'text', value: 'Hello' }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Original</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test')?.textContent).toBe('Hello');
    });

    it('should handle invalid JSON', async () => {
      (mockContext.variableValue as jest.Mock).mockReturnValue('invalid json');
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Failed to parse DOM changes:',
        expect.any(Error)
      );
    });

    it('should handle non-array changes', async () => {
      (mockContext.variableValue as jest.Mock).mockReturnValue('{}');
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'DOM changes must be an array'
      );
    });
  });

  describe('DOM change actions', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="test-text">Original Text</div>
        <div class="test-html"><span>Original</span></div>
        <div class="test-style">Styled Element</div>
        <div class="test-attr" data-test="original">Attribute Test</div>
        <div class="test-class">Class Test</div>
        <button class="test-js">Click Me</button>
      `;
    });

    it('should change text content', async () => {
      const changes = [{ selector: '.test-text', action: 'text', value: 'New Text' }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-text')?.textContent).toBe('New Text');
    });

    it('should change HTML content', async () => {
      const changes = [{ selector: '.test-html', action: 'html', value: '<strong>New HTML</strong>' }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-html')?.innerHTML).toBe('<strong>New HTML</strong>');
    });

    it('should apply styles', async () => {
      const changes = [{
        selector: '.test-style',
        action: 'style',
        css: { 'background-color': 'red', 'font-size': '20px' }
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      const element = document.querySelector('.test-style') as HTMLElement;
      expect(element.style.backgroundColor).toBe('red');
      expect(element.style.fontSize).toBe('20px');
    });

    it('should set attributes', async () => {
      const changes = [{
        selector: '.test-attr',
        action: 'attribute',
        attribute: 'data-test',
        value: 'modified'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-attr')?.getAttribute('data-test')).toBe('modified');
    });

    it('should add classes', async () => {
      const changes = [{
        selector: '.test-class',
        action: 'class',
        className: 'new-class',
        value: 'add'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-class')?.classList.contains('new-class')).toBe(true);
    });

    it('should remove classes', async () => {
      document.querySelector('.test-class')?.classList.add('remove-me');
      
      const changes = [{
        selector: '.test-class',
        action: 'class',
        className: 'remove-me',
        value: 'remove'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-class')?.classList.contains('remove-me')).toBe(false);
    });

    it('should toggle classes', async () => {
      const changes = [{
        selector: '.test-class',
        action: 'class',
        className: 'toggle-me',
        value: 'toggle'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(document.querySelector('.test-class')?.classList.contains('toggle-me')).toBe(true);
    });

    it('should execute JavaScript', async () => {
      const mockFn = jest.fn();
      (window as any).testFunction = mockFn;
      
      const changes = [{
        selector: '.test-js',
        action: 'javascript',
        script: 'element.dataset.modified = "true"; window.testFunction(element);'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      const element = document.querySelector('.test-js') as HTMLElement;
      expect(element.dataset.modified).toBe('true');
      expect(mockFn).toHaveBeenCalledWith(element);
      
      delete (window as any).testFunction;
    });

    it('should handle JavaScript errors gracefully', async () => {
      const changes = [{
        selector: '.test-js',
        action: 'javascript',
        script: 'throw new Error("Script error");'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Error executing JavaScript for .test-js:',
        expect.any(Error)
      );
    });

    it('should warn about unknown action types', async () => {
      const changes = [{
        selector: '.test',
        action: 'unknown' as any,
        value: 'test'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Test</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Unknown action type: unknown'
      );
    });
  });

  describe('priority and applyOnce', () => {
    it('should apply changes in priority order', async () => {
      const results: string[] = [];
      (window as any).recordChange = (value: string) => results.push(value);
      
      const changes = [
        {
          selector: '.test',
          action: 'javascript',
          script: 'window.recordChange("low");',
          priority: 1
        },
        {
          selector: '.test',
          action: 'javascript',
          script: 'window.recordChange("high");',
          priority: 10
        },
        {
          selector: '.test',
          action: 'javascript',
          script: 'window.recordChange("medium");',
          priority: 5
        }
      ];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Test</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(results).toEqual(['high', 'medium', 'low']);
      
      delete (window as any).recordChange;
    });

    it('should respect applyOnce setting', async () => {
      let clickCount = 0;
      (window as any).incrementCounter = () => clickCount++;
      
      const changes = [{
        selector: '.test',
        action: 'javascript',
        script: 'window.incrementCounter();',
        applyOnce: true
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Test</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin({ debug: true });
      await plugin.initialize(mockContext as Context);
      
      // Try to apply the same change again
      await plugin.initialize(mockContext as Context);

      expect(clickCount).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        expect.stringContaining('Change already applied')
      );
      
      delete (window as any).incrementCounter;
    });
  });

  describe('element waiting', () => {
    it('should wait for elements that appear later', (done) => {
      const changes = [{
        selector: '.delayed-element',
        action: 'text',
        value: 'Found!',
        waitForElement: true
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin({ checkInterval: 10, maxWaitTime: 1000 });
      plugin.initialize(mockContext as Context).then(() => {

      // Add element after a delay
      setTimeout(() => {
        const div = document.createElement('div');
        div.className = 'delayed-element';
        div.textContent = 'Original';
        document.body.appendChild(div);
      }, 50);

        // Check if change was applied
        setTimeout(() => {
          expect(document.querySelector('.delayed-element')?.textContent).toBe('Found!');
          done();
        }, 100);
      });
    });

    it('should timeout if element never appears', (done) => {
      const changes = [{
        selector: '.never-appears',
        action: 'text',
        value: 'Found!',
        waitForElement: true
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin({ checkInterval: 10, maxWaitTime: 50 });
      plugin.initialize(mockContext as Context).then(() => {

        setTimeout(() => {
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[ABSmartly DOM Changes]',
            'Timeout waiting for element: .never-appears'
          );
          done();
        }, 100);
      });
    });

    it('should not wait if waitForElement is false', async () => {
      const changes = [{
        selector: '.not-present',
        action: 'text',
        value: 'Found!',
        waitForElement: false
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      plugin = new ABSmartlyDOMChangesPlugin();
      await plugin.initialize(mockContext as Context);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Element not found for selector: .not-present'
      );
    });
  });

  describe('MutationObserver functionality', () => {
    it('should reapply changes when elements are re-added', (done) => {
      const changes = [{
        selector: '.dynamic',
        action: 'text',
        value: 'Modified'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      // Create initial element
      const div = document.createElement('div');
      div.className = 'dynamic';
      div.textContent = 'Original';
      document.body.appendChild(div);
      
      plugin = new ABSmartlyDOMChangesPlugin({ observeDynamicContent: true });
      plugin.initialize(mockContext as Context).then(() => {

        expect(div.textContent).toBe('Modified');

        // Remove and re-add element
        div.remove();
        
        setTimeout(() => {
          const newDiv = document.createElement('div');
          newDiv.className = 'dynamic';
          newDiv.textContent = 'New Original';
          document.body.appendChild(newDiv);
          
          setTimeout(() => {
            expect(newDiv.textContent).toBe('Modified');
            done();
          }, 50);
        }, 50);
      });
    });

    it('should not observe if observeDynamicContent is false', async () => {
      const changes = [{
        selector: '.test',
        action: 'text',
        value: 'Modified'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Original</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin({ 
        observeDynamicContent: false,
        debug: true 
      });
      await plugin.initialize(mockContext as Context);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Started global MutationObserver'
      );
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const changes = [{
        selector: '.test',
        action: 'text',
        value: 'Modified'
      }];
      (mockContext.variableValue as jest.Mock).mockReturnValue(changes);
      
      document.body.innerHTML = '<div class="test">Original</div>';
      
      plugin = new ABSmartlyDOMChangesPlugin({ debug: true });
      await plugin.initialize(mockContext as Context);
      
      plugin.destroy();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ABSmartly DOM Changes]',
        'Plugin destroyed'
      );
    });
  });

  describe('createDOMChangesPlugin factory', () => {
    it('should create and initialize plugin', async () => {
      (mockContext.variableValue as jest.Mock).mockReturnValue('[]');
      
      const plugin = await createDOMChangesPlugin(mockContext as Context, { debug: true });

      expect(plugin).toBeInstanceOf(ABSmartlyDOMChangesPlugin);
      expect(mockContext.ready).toHaveBeenCalled();
      
      plugin.destroy();
    });
  });
});