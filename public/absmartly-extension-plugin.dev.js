var ABsmartlyExtensionPlugin = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
  };

  // src/plugin-extensions/browser-bundle.ts
  var browser_bundle_exports = {};
  __export(browser_bundle_exports, {
    CodeInjector: () => CodeInjector,
    ExtensionDOMPlugin: () => ExtensionDOMPlugin,
    MessageBridge: () => MessageBridge,
    StateManager: () => StateManager
  });

  // src/plugin-extensions/StateManager.ts
  var StateManager = class {
    constructor(debug = false) {
      __publicField(this, "stateMap", /* @__PURE__ */ new Map());
      __publicField(this, "appliedChanges", /* @__PURE__ */ new Map());
      __publicField(this, "debug");
      this.debug = debug;
    }
    /**
     * Store the original state of an element before modification
     */
    storeState(element, experimentName) {
      if (!this.stateMap.has(element)) {
        this.stateMap.set(element, /* @__PURE__ */ new Map());
      }
      const elementStates = this.stateMap.get(element);
      if (!elementStates.has(experimentName)) {
        const state = {
          textContent: element.textContent || void 0,
          innerHTML: element.innerHTML || void 0,
          attributes: this.captureAttributes(element),
          styles: this.captureStyles(element),
          classList: Array.from(element.classList)
        };
        elementStates.set(experimentName, state);
        if (this.debug) {
          console.log(`[StateManager] Stored state for ${experimentName}:`, state);
        }
      }
      return elementStates.get(experimentName);
    }
    /**
     * Track an applied change
     */
    trackChange(change) {
      const { experimentName } = change;
      if (!this.appliedChanges.has(experimentName)) {
        this.appliedChanges.set(experimentName, []);
      }
      const appliedChange = {
        ...change,
        appliedAt: Date.now()
      };
      this.appliedChanges.get(experimentName).push(appliedChange);
      if (this.debug) {
        console.log(`[StateManager] Tracked change for ${experimentName}:`, appliedChange);
      }
    }
    /**
     * Get original state for an element
     */
    getState(element, experimentName) {
      return this.stateMap.get(element)?.get(experimentName) || null;
    }
    /**
     * Get all applied changes for an experiment
     */
    getAppliedChanges(experimentName) {
      return this.appliedChanges.get(experimentName) || [];
    }
    /**
     * Revert an element to its original state
     */
    revertElement(element, experimentName) {
      const state = this.getState(element, experimentName);
      if (!state) {
        if (this.debug) {
          console.warn(`[StateManager] No state found for element in ${experimentName}`);
        }
        return false;
      }
      try {
        if (state.textContent !== void 0) {
          element.textContent = state.textContent;
        }
        if (state.innerHTML !== void 0) {
          element.innerHTML = state.innerHTML;
        }
        if (state.attributes) {
          Object.entries(state.attributes).forEach(([attr, value]) => {
            if (value === null) {
              element.removeAttribute(attr);
            } else {
              element.setAttribute(attr, value);
            }
          });
        }
        if (state.styles) {
          const htmlElement = element;
          Object.entries(state.styles).forEach(([prop, value]) => {
            htmlElement.style[prop] = value;
          });
        }
        if (state.classList) {
          element.className = state.classList.join(" ");
        }
        element.removeAttribute("data-absmartly-experiment");
        element.removeAttribute("data-absmartly-modified");
        element.removeAttribute("data-absmartly-original");
        if (this.debug) {
          console.log(`[StateManager] Reverted element for ${experimentName}`);
        }
        return true;
      } catch (error) {
        console.error(`[StateManager] Error reverting element:`, error);
        return false;
      }
    }
    /**
     * Remove all tracked changes for an experiment
     */
    removeExperiment(experimentName) {
      const changes = this.getAppliedChanges(experimentName);
      if (changes.length === 0) {
        return false;
      }
      let success = true;
      for (const change of changes) {
        if (!this.revertElement(change.element, experimentName)) {
          success = false;
        }
      }
      this.appliedChanges.delete(experimentName);
      this.stateMap.forEach((elementStates) => {
        elementStates.delete(experimentName);
      });
      if (this.debug) {
        console.log(`[StateManager] Removed experiment ${experimentName}, success: ${success}`);
      }
      return success;
    }
    /**
     * Clear all tracked state
     */
    clear() {
      this.stateMap.clear();
      this.appliedChanges.clear();
    }
    captureAttributes(element) {
      const attrs = {};
      for (const attr of Array.from(element.attributes)) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    }
    captureStyles(element) {
      const styles = {};
      const computedStyle = window.getComputedStyle(element);
      if (element.style.length > 0) {
        for (let i = 0; i < element.style.length; i++) {
          const prop = element.style[i];
          styles[prop] = element.style.getPropertyValue(prop);
        }
      }
      return styles;
    }
  };

  // src/plugin-extensions/MessageBridge.ts
  var MessageBridge = class {
    constructor(debug = false) {
      __publicField(this, "handlers", /* @__PURE__ */ new Map());
      __publicField(this, "debug");
      __publicField(this, "listenerAttached", false);
      this.debug = debug;
      this.setupListener();
    }
    /**
     * Send a message to the extension
     */
    send(type, payload) {
      const message = {
        source: "absmartly-page",
        type,
        payload
      };
      if (this.debug) {
        console.log("[MessageBridge] Sending message:", message);
      }
      window.postMessage(message, "*");
    }
    /**
     * Register a handler for incoming messages
     */
    on(type, handler) {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, []);
      }
      this.handlers.get(type).push(handler);
      if (this.debug) {
        console.log(`[MessageBridge] Registered handler for: ${type}`);
      }
    }
    /**
     * Unregister a handler
     */
    off(type, handler) {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
    /**
     * Unregister all handlers for a message type
     */
    removeAllHandlers(type) {
      this.handlers.delete(type);
    }
    /**
     * Setup the window message listener
     */
    setupListener() {
      if (this.listenerAttached) {
        return;
      }
      window.addEventListener("message", (event) => {
        if (!event.data || event.data.source !== "absmartly-extension") {
          return;
        }
        const message = event.data;
        if (this.debug) {
          console.log("[MessageBridge] Received message:", message);
        }
        this.handleMessage(message);
      });
      this.listenerAttached = true;
      if (this.debug) {
        console.log("[MessageBridge] Message listener attached");
      }
    }
    /**
     * Handle incoming messages
     */
    handleMessage(message) {
      const handlers = this.handlers.get(message.type);
      if (!handlers || handlers.length === 0) {
        if (this.debug) {
          console.log(`[MessageBridge] No handlers for message type: ${message.type}`);
        }
        return;
      }
      handlers.forEach((handler) => {
        try {
          handler(message.payload);
        } catch (error) {
          console.error(`[MessageBridge] Error in handler for ${message.type}:`, error);
        }
      });
    }
    /**
     * Notify extension that plugin is ready
     */
    notifyReady(version, capabilities) {
      this.send("PLUGIN_INITIALIZED", {
        version,
        capabilities
      });
    }
    /**
     * Request custom code from extension
     */
    requestCustomCode() {
      this.send("REQUEST_CUSTOM_CODE");
    }
    /**
     * Notify extension about experiment trigger
     */
    notifyExperimentTriggered(experimentName, variant) {
      this.send("EXPERIMENT_TRIGGERED", {
        experimentName,
        variant
      });
    }
    /**
     * Clean up
     */
    destroy() {
      this.handlers.clear();
    }
  };

  // src/plugin-extensions/CodeInjector.ts
  var CodeInjector = class {
    constructor(debug = false) {
      __publicField(this, "debug");
      __publicField(this, "injectedElements", /* @__PURE__ */ new Set());
      this.debug = debug;
    }
    /**
     * Inject custom code at specified locations
     */
    injectCode(code) {
      if (this.debug) {
        console.log("[CodeInjector] Injecting custom code:", code);
      }
      if (code.headStart) {
        this.injectAtLocation(code.headStart, "headStart");
      }
      if (code.headEnd) {
        this.injectAtLocation(code.headEnd, "headEnd");
      }
      if (code.bodyStart) {
        this.injectAtLocation(code.bodyStart, "bodyStart");
      }
      if (code.bodyEnd) {
        this.injectAtLocation(code.bodyEnd, "bodyEnd");
      }
    }
    /**
     * Inject HTML content at a specific location
     */
    injectAtLocation(html, location) {
      if (!html) {
        return;
      }
      if (this.debug) {
        console.log(`[CodeInjector] Injecting at ${location}:`, html.substring(0, 100));
      }
      const container = document.createElement("div");
      container.innerHTML = html;
      container.setAttribute("data-absmartly-injected", location);
      const children = Array.from(container.children);
      children.forEach((child) => {
        this.injectElement(child, location);
      });
      this.executeScriptsInHTML(html, location);
    }
    /**
     * Inject a single element at the specified location
     */
    injectElement(element, location) {
      element.setAttribute("data-absmartly-injected", location);
      const targetLocation = this.getTargetLocation(location);
      if (targetLocation) {
        targetLocation.appendChild(element);
        this.injectedElements.add(element);
        if (this.debug) {
          console.log(`[CodeInjector] Injected element at ${location}:`, element);
        }
      }
    }
    /**
     * Get the DOM location for injection
     */
    getTargetLocation(location) {
      switch (location) {
        case "headStart":
          return document.head.firstChild ? document.head : null;
        case "headEnd":
          return document.head;
        case "bodyStart":
          return document.body.firstChild ? document.body : null;
        case "bodyEnd":
          return document.body;
        default:
          return null;
      }
    }
    /**
     * Execute script tags found in HTML content
     * Scripts injected via innerHTML don't execute automatically
     */
    executeScriptsInHTML(html, location) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const scripts = temp.querySelectorAll("script");
      scripts.forEach((script) => {
        try {
          if (script.src) {
            const newScript = document.createElement("script");
            newScript.src = script.src;
            newScript.async = script.async;
            newScript.defer = script.defer;
            newScript.setAttribute("data-absmartly-injected", location);
            this.insertAtLocation(newScript, location);
            this.injectedElements.add(newScript);
          } else {
            const code = script.textContent || script.innerText || "";
            if (code) {
              const fn = new Function(code);
              fn();
              if (this.debug) {
                console.log(`[CodeInjector] Executed inline script from ${location}`);
              }
            }
          }
        } catch (error) {
          console.error(`[CodeInjector] Failed to execute script from ${location}:`, error);
        }
      });
    }
    /**
     * Insert element at the correct position based on injection point
     */
    insertAtLocation(element, location) {
      switch (location) {
        case "headStart":
          if (document.head.firstChild) {
            document.head.insertBefore(element, document.head.firstChild);
          } else {
            document.head.appendChild(element);
          }
          break;
        case "headEnd":
          document.head.appendChild(element);
          break;
        case "bodyStart":
          if (document.body.firstChild) {
            document.body.insertBefore(element, document.body.firstChild);
          } else {
            document.body.appendChild(element);
          }
          break;
        case "bodyEnd":
          document.body.appendChild(element);
          break;
      }
    }
    /**
     * Inject a style element with CSS
     */
    injectStyle(css, id) {
      const style = document.createElement("style");
      if (id) {
        style.id = id;
      }
      style.setAttribute("data-absmartly-injected", "style");
      style.textContent = css;
      document.head.appendChild(style);
      this.injectedElements.add(style);
      if (this.debug) {
        console.log("[CodeInjector] Injected style:", css.substring(0, 100));
      }
    }
    /**
     * Inject a script element
     */
    injectScript(src, id) {
      const script = document.createElement("script");
      if (id) {
        script.id = id;
      }
      script.src = src;
      script.setAttribute("data-absmartly-injected", "script");
      document.head.appendChild(script);
      this.injectedElements.add(script);
      if (this.debug) {
        console.log("[CodeInjector] Injected script:", src);
      }
    }
    /**
     * Remove all injected elements
     */
    removeAll() {
      this.injectedElements.forEach((element) => {
        try {
          element.parentNode?.removeChild(element);
        } catch (error) {
          console.error("[CodeInjector] Failed to remove injected element:", error);
        }
      });
      this.injectedElements.clear();
      if (this.debug) {
        console.log("[CodeInjector] Removed all injected elements");
      }
    }
    /**
     * Get all injected elements
     */
    getInjectedElements() {
      return Array.from(this.injectedElements);
    }
  };

  // src/plugin-extensions/ExtensionDOMPlugin.ts
  var ExtensionDOMPlugin = class {
    constructor(basePlugin, config) {
      __publicField(this, "basePlugin");
      // Will be DOMChangesPluginLite
      __publicField(this, "stateManager");
      __publicField(this, "messageBridge");
      __publicField(this, "codeInjector");
      __publicField(this, "config");
      __publicField(this, "initialized", false);
      this.basePlugin = basePlugin;
      this.config = {
        context: config.context,
        autoApply: config.autoApply ?? true,
        spa: config.spa ?? true,
        visibilityTracking: config.visibilityTracking ?? true,
        dataSource: config.dataSource ?? "variable",
        dataFieldName: config.dataFieldName ?? "__dom_changes",
        debug: config.debug ?? false
      };
      this.stateManager = new StateManager(this.config.debug);
      this.messageBridge = new MessageBridge(this.config.debug);
      this.codeInjector = new CodeInjector(this.config.debug);
      this.setupMessageHandlers();
    }
    /**
     * Initialize the plugin
     */
    async initialize() {
      if (this.initialized) {
        return;
      }
      if (this.basePlugin.initialize) {
        await this.basePlugin.initialize();
      }
      if (this.basePlugin.on) {
        this.basePlugin.on("change-applied", (data) => {
          this.handleChangeApplied(data);
        });
        this.basePlugin.on("experiment-triggered", (data) => {
          this.messageBridge.notifyExperimentTriggered(
            data.experimentName,
            data.variant
          );
        });
      }
      this.messageBridge.notifyReady("1.0.0", [
        "state-management",
        "change-reversion",
        "code-injection",
        "preview-changes"
      ]);
      if (this.config.context) {
        this.config.context.__domPlugin = {
          instance: this,
          initialized: true,
          version: "1.0.0",
          capabilities: ["state-management", "change-reversion"],
          timestamp: Date.now()
        };
        if (typeof window !== "undefined") {
          ;
          window.__absmartlyPlugin = this;
          window.__absmartlyDOMChangesPlugin = this;
        }
      }
      this.initialized = true;
      if (this.config.debug) {
        console.log("[ExtensionDOMPlugin] Initialized successfully");
        console.log("[ExtensionDOMPlugin] Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter((name) => typeof this[name] === "function"));
        console.log("[ExtensionDOMPlugin] removeChanges is function:", typeof this.removeChanges === "function");
      }
    }
    /**
     * Apply a single DOM change with state tracking
     */
    applyChange(change, experimentName = "__preview__") {
      if (!change.selector || !change.type) {
        return false;
      }
      if (change.enabled === false) {
        return false;
      }
      const elements = document.querySelectorAll(change.selector);
      if (elements.length === 0) {
        if (this.config.debug) {
          console.warn(`[ExtensionDOMPlugin] No elements found for: ${change.selector}`);
        }
        return false;
      }
      let success = true;
      elements.forEach((element) => {
        try {
          const originalState = this.stateManager.storeState(element, experimentName);
          this.applyChangeManually(element, change, experimentName);
          this.stateManager.trackChange({
            experimentName,
            selector: change.selector,
            type: change.type,
            element,
            originalState
          });
          if (this.config.debug) {
            console.log(`[ExtensionDOMPlugin] Applied ${change.type} change to element:`, {
              selector: change.selector,
              experimentName,
              element
            });
          }
        } catch (error) {
          console.error("[ExtensionDOMPlugin] Error applying change:", error);
          success = false;
        }
      });
      return success;
    }
    /**
     * Remove all changes for an experiment
     */
    removeChanges(experimentName) {
      if (this.config.debug) {
        console.log(`[ExtensionDOMPlugin] Removing changes for: ${experimentName}`);
      }
      return this.stateManager.removeExperiment(experimentName);
    }
    /**
     * Revert a specific change
     */
    revertChange(element, experimentName) {
      return this.stateManager.revertElement(element, experimentName);
    }
    /**
     * Get original state of an element
     */
    getOriginalState(element, experimentName) {
      return this.stateManager.getState(element, experimentName);
    }
    /**
     * Get all applied changes for an experiment
     */
    getAppliedChanges(experimentName) {
      return this.stateManager.getAppliedChanges(experimentName);
    }
    /**
     * Inject custom code
     */
    injectCode(code) {
      this.codeInjector.injectCode(code);
    }
    /**
     * Listen for base plugin events
     */
    on(event, handler) {
      if (this.basePlugin.on) {
        this.basePlugin.on(event, handler);
      }
    }
    /**
     * Get the base plugin instance
     */
    getBasePlugin() {
      return this.basePlugin;
    }
    /**
     * Setup message handlers for extension communication
     */
    setupMessageHandlers() {
      this.messageBridge.on("PREVIEW_CHANGES", (payload) => {
        const { changes, experimentName, updateMode } = payload || {};
        const expName = experimentName || "__preview__";
        if (this.config.debug) {
          console.log(`[ExtensionDOMPlugin] Applying preview for: ${expName}`);
        }
        this.removeChanges(expName);
        if (changes && Array.isArray(changes)) {
          changes.forEach((change) => {
            this.applyChange(change, expName);
          });
        }
      });
      this.messageBridge.on("REMOVE_PREVIEW", (payload) => {
        const { experimentName } = payload || {};
        const expName = experimentName || "__preview__";
        if (this.config.debug) {
          console.log(`[ExtensionDOMPlugin] Removing preview: ${expName}`);
        }
        this.removeChanges(expName);
      });
      this.messageBridge.on("INJECT_CUSTOM_CODE", (payload) => {
        if (payload && payload.code) {
          this.injectCode(payload.code);
        }
      });
    }
    /**
     * Handle change applied event from base plugin
     */
    handleChangeApplied(data) {
      const { experimentName, change, element } = data;
      if (element && experimentName) {
        const originalState = this.stateManager.storeState(element, experimentName);
        this.stateManager.trackChange({
          experimentName,
          selector: change.selector,
          type: change.type,
          element,
          originalState
        });
      }
    }
    /**
     * Fallback manual change application
     */
    applyChangeManually(element, change, experimentName) {
      element.setAttribute("data-absmartly-experiment", experimentName);
      element.setAttribute("data-absmartly-modified", "true");
      switch (change.type) {
        case "text":
          element.textContent = change.value;
          break;
        case "html":
          element.innerHTML = change.value;
          break;
        case "style":
        case "styles":
          const styles = change.styles || change.value;
          if (typeof styles === "object") {
            Object.entries(styles).forEach(([prop, value]) => {
              element.style[prop] = value;
            });
          } else if (typeof styles === "string") {
            element.setAttribute("style", styles);
          }
          break;
        case "class":
          if (change.className) {
            element.classList.add(change.className);
          }
          break;
        case "attribute":
          if (change.attribute && change.value !== void 0) {
            element.setAttribute(change.attribute, change.value);
          }
          break;
      }
    }
    /**
     * Clean up
     */
    destroy() {
      this.stateManager.clear();
      this.messageBridge.destroy();
      this.codeInjector.removeAll();
      if (this.basePlugin.destroy) {
        this.basePlugin.destroy();
      }
      if (this.config.context?.__domPlugin) {
        delete this.config.context.__domPlugin;
      }
      this.initialized = false;
    }
  };

  // src/plugin-extensions/browser-bundle.ts
  if (typeof window !== "undefined") {
    window.ABsmartlyExtensionPlugin = {
      ExtensionDOMPlugin,
      StateManager,
      MessageBridge,
      CodeInjector,
      version: "1.0.0"
    };
  }
  return __toCommonJS(browser_bundle_exports);
})();
//# sourceMappingURL=absmartly-extension-plugin.dev.js.map
