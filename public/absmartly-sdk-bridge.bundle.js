
/**
 * ABsmartly SDK Bridge - Bundled Script
 * Bridges extension with ABsmartly SDK on page
 * Version: 1.1.0
 * Built from TypeScript modules
 */

var ABSmartlySDKBridge = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: !0, configurable: !0, writable: !0, value }) : obj[key] = value;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: !0 });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  }, __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
  var __publicField = (obj, key, value) => (__defNormalProp(obj, typeof key != "symbol" ? key + "" : key, value), value);

  // src/sdk-bridge/index.ts
  var sdk_bridge_exports = {};
  __export(sdk_bridge_exports, {
    SDK_BRIDGE_VERSION: () => SDK_BRIDGE_VERSION
  });

  // src/sdk-bridge/utils/logger.ts
  var _Logger = class _Logger {
    /**
     * Log an info message
     */
    static log(...args) {
      this.DEBUG && console.log("[ABsmartly Extension]", ...args);
    }
    /**
     * Log an error message
     */
    static error(...args) {
      this.DEBUG && console.error("[ABsmartly Extension]", ...args);
    }
    /**
     * Log a warning message
     */
    static warn(...args) {
      this.DEBUG && console.warn("[ABsmartly Extension]", ...args);
    }
    /**
     * Enable or disable debug logging
     */
    static setDebug(enabled) {
      this.DEBUG = enabled;
    }
    /**
     * Check if debug mode is enabled
     */
    static isDebugEnabled() {
      return this.DEBUG;
    }
  };
  __name(_Logger, "Logger"), __publicField(_Logger, "DEBUG", !0);
  var Logger = _Logger;

  // src/sdk-bridge/sdk/sdk-detector.ts
  var _SDKDetector = class _SDKDetector {
    constructor() {
      __publicField(this, "cachedContext", null);
      __publicField(this, "contextPropertyPath", null);
    }
    /**
     * Detect ABsmartly SDK on the window object
     */
    detectSDK() {
      if (this.cachedContext)
        return {
          sdk: null,
          context: this.cachedContext,
          contextPath: this.contextPropertyPath
        };
      let sdk = null, sdkLocations = [
        window.sdk,
        window.absmartly,
        window.ABsmartly,
        window.__absmartly
      ];
      for (let location of sdkLocations)
        if (location && typeof location.createContext == "function") {
          sdk = location, Logger.log("[ABsmartly Extension] SDK instance found");
          break;
        }
      let possibleLocations = [
        window.ABsmartlyContext,
        window.absmartly,
        window.ABsmartly,
        window.__absmartly,
        window.sdk,
        window.abSmartly,
        window.context,
        window.absmartlyContext,
        window.__context
      ], context = null;
      for (let location of possibleLocations)
        if (location && typeof location.treatment == "function") {
          context = location;
          break;
        }
      if (!context) {
        for (let location of possibleLocations)
          if (location && location.context && typeof location.context.treatment == "function") {
            context = location.context;
            break;
          }
      }
      if (!context) {
        for (let location of possibleLocations)
          if (location && location.contexts && Array.isArray(location.contexts) && location.contexts.length > 0) {
            for (let ctx of location.contexts)
              if (ctx && typeof ctx.treatment == "function") {
                context = ctx;
                break;
              }
            if (context)
              break;
          }
      }
      return context && !this.cachedContext ? (this.cachedContext = context, window.ABsmartlyContext === context ? this.contextPropertyPath = "ABsmartlyContext" : window.absmartly === context ? this.contextPropertyPath = "absmartly" : window.sdk && window.sdk.context === context ? this.contextPropertyPath = "sdk.context" : this.contextPropertyPath = "unknown", Logger.log("[ABsmartly Extension] \u2705 Context found and cached at:", this.contextPropertyPath), Logger.log("[ABsmartly Extension] \u{1F4CA} Context details:", {
        hasTreatment: !!context.treatment,
        hasPeek: !!context.peek,
        hasData: !!context.data,
        hasEventLogger: !!context.eventLogger,
        has_eventLogger: context._eventLogger !== void 0,
        contextType: typeof context
      })) : context || Logger.warn("[ABsmartly Extension] \u26A0\uFE0F No context found after detection"), { sdk, context, contextPath: this.contextPropertyPath };
    }
    /**
     * Get cached context
     */
    getCachedContext() {
      return this.cachedContext;
    }
    /**
     * Get context property path
     */
    getContextPath() {
      return this.contextPropertyPath;
    }
    /**
     * Clear cached context
     */
    clearCache() {
      this.cachedContext = null, this.contextPropertyPath = null;
    }
  };
  __name(_SDKDetector, "SDKDetector");
  var SDKDetector = _SDKDetector;

  // src/sdk-bridge/sdk/plugin-detector.ts
  var _PluginDetector = class _PluginDetector {
    /**
     * Checks if the DOM Changes Plugin is already loaded on the page
     */
    detectPlugin(context) {
      return context && context.__domPlugin && context.__domPlugin.initialized ? (Logger.log("[ABsmartly Extension] Plugin detected via context.__domPlugin registration:", {
        version: context.__domPlugin.version,
        capabilities: context.__domPlugin.capabilities,
        timestamp: context.__domPlugin.timestamp
      }), context.__domPlugin.instance) : window.__absmartlyPlugin ? (Logger.log("[ABsmartly Extension] Site plugin instance found at window.__absmartlyPlugin"), window.__absmartlyPlugin) : window.__absmartlyDOMChangesPlugin ? (Logger.log("[ABsmartly Extension] Site plugin instance found at window.__absmartlyDOMChangesPlugin"), window.__absmartlyDOMChangesPlugin) : document.querySelectorAll(
        "[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]"
      ).length > 0 ? (Logger.log(
        "[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM - plugin is active but instance not accessible"
      ), "active-but-inaccessible") : null;
    }
    /**
     * Check if plugin is accessible (not just active but inaccessible)
     */
    isPluginAccessible(detectionResult) {
      return detectionResult !== null && detectionResult !== "active-but-inaccessible";
    }
    /**
     * Check if plugin is active (either accessible or detected via DOM artifacts)
     */
    isPluginActive(detectionResult) {
      return detectionResult !== null;
    }
  };
  __name(_PluginDetector, "PluginDetector");
  var PluginDetector = _PluginDetector;

  // src/sdk-bridge/sdk/sdk-interceptor.ts
  var _SDKInterceptor = class _SDKInterceptor {
    constructor(callbacks = {}) {
      __publicField(this, "callbacks");
      this.callbacks = callbacks;
    }
    /**
     * Intercept eventLogger calls and forward to callback
     */
    interceptEventLogger(context) {
      if (Logger.log("[ABsmartly Extension] \u{1F3AF} interceptEventLogger called", {
        hasContext: !!context,
        alreadyIntercepted: context?.__eventLoggerIntercepted,
        hasEventLogger: !!context?.eventLogger,
        has_eventLogger: context?._eventLogger !== void 0,
        contextKeys: context ? Object.keys(context).filter((k) => k.includes("event") || k.includes("logger")) : [],
        allContextMethods: context ? Object.keys(context).filter((k) => typeof context[k] == "function") : [],
        hasTreatment: context && typeof context.treatment == "function",
        hasReady: context && typeof context.ready == "function",
        hasPeek: context && typeof context.peek == "function"
      }), !context || context.__eventLoggerIntercepted) {
        Logger.log("[ABsmartly Extension] \u26A0\uFE0F Skipping interception - no context or already intercepted");
        return;
      }
      let originalEventLogger = context.eventLogger ? context.eventLogger() : null;
      Logger.log("[ABsmartly Extension] \u{1F4DD} Original eventLogger:", {
        hasMethod: !!context.eventLogger,
        originalEventLogger: !!originalEventLogger,
        typeOfOriginal: typeof originalEventLogger
      });
      let wrappedEventLogger = /* @__PURE__ */ __name((ctx, eventName, data) => {
        if (Logger.log("[ABsmartly Extension] \u{1F514} SDK Event:", { eventName, data }), this.callbacks.onSDKEvent)
          try {
            this.callbacks.onSDKEvent(eventName, data ? JSON.parse(JSON.stringify(data)) : null);
          } catch (error) {
            Logger.error("[ABsmartly Extension] Error in SDK event callback:", error);
          }
        originalEventLogger && originalEventLogger(ctx, eventName, data);
      }, "wrappedEventLogger");
      context._eventLogger !== void 0 ? (Logger.log("[ABsmartly Extension] \u2705 Replacing context._eventLogger"), context._eventLogger = wrappedEventLogger) : Logger.warn("[ABsmartly Extension] \u26A0\uFE0F context._eventLogger is undefined, cannot intercept"), context.__eventLoggerIntercepted = !0, Logger.log("[ABsmartly Extension] \u2705 EventLogger intercepted successfully");
    }
    /**
     * Intercept SDK's createContext method to auto-intercept all new contexts
     */
    interceptSDKCreateContext(sdk) {
      if (!sdk || !sdk.createContext || sdk.__createContextIntercepted)
        return;
      let originalCreateContext = sdk.createContext.bind(sdk), self = this;
      sdk.createContext = async function(config) {
        Logger.log("[ABsmartly Extension] Intercepting createContext call");
        let context = await originalCreateContext(config);
        return self.interceptEventLogger(context), context;
      }, sdk.__createContextIntercepted = !0, Logger.log("[ABsmartly Extension] SDK createContext intercepted successfully");
    }
    /**
     * Intercept SDK constructor to intercept all SDK instances
     */
    interceptSDKConstructor(sdkModule) {
      if (!sdkModule || !sdkModule.SDK || sdkModule.SDK.__constructorIntercepted)
        return;
      let OriginalSDK = sdkModule.SDK, self = this;
      sdkModule.SDK = function(config) {
        Logger.log("[ABsmartly Extension] Intercepting new SDK() call");
        let sdkInstance = new OriginalSDK(config);
        return sdkInstance && typeof sdkInstance.createContext == "function" && self.interceptSDKCreateContext(sdkInstance), sdkInstance;
      }, Object.setPrototypeOf(sdkModule.SDK, OriginalSDK), Object.assign(sdkModule.SDK, OriginalSDK), sdkModule.SDK.__constructorIntercepted = !0, Logger.log("[ABsmartly Extension] SDK constructor intercepted successfully");
    }
  };
  __name(_SDKInterceptor, "SDKInterceptor");
  var SDKInterceptor = _SDKInterceptor;

  // src/sdk-bridge/utils/html-sanitizer.ts
  function sanitizeHTML(html) {
    if (!html)
      return "";
    let temp = document.createElement("div");
    temp.innerHTML = html;
    let dangerousTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "link",
      "style",
      "meta",
      "base"
    ], dangerousAttrs = [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit"
    ];
    return dangerousTags.forEach((tag) => {
      temp.querySelectorAll(tag).forEach((el) => el.remove());
    }), temp.querySelectorAll("*").forEach((el) => {
      dangerousAttrs.forEach((attr) => {
        el.hasAttribute(attr) && el.removeAttribute(attr);
      }), Array.from(el.attributes).forEach((attr) => {
        attr.name.toLowerCase().startsWith("on") && el.removeAttribute(attr.name);
      }), ["href", "src"].forEach((attr) => {
        if (el.hasAttribute(attr)) {
          let value = el.getAttribute(attr);
          value && /^(javascript|data):/i.test(value) && el.removeAttribute(attr);
        }
      });
    }), temp.innerHTML;
  }
  __name(sanitizeHTML, "sanitizeHTML");

  // src/sdk-bridge/experiment/code-injector.ts
  var _CodeInjector = class _CodeInjector {
    /**
     * Inject custom code from experiment variants' __inject_html variables
     */
    injectExperimentCode(context) {
      if (!context || !context.data_) {
        Logger.log("[ABsmartly Extension] No context data available for experiment code injection");
        return;
      }
      let data = context.data_;
      if (!data.experiments || !Array.isArray(data.experiments)) {
        Logger.log("[ABsmartly Extension] No experiments found in context");
        return;
      }
      Logger.log(`[ABsmartly Extension] Checking ${data.experiments.length} experiments for injection code`), data.experiments.forEach((experiment, idx) => {
        try {
          let assignment = context.assignments_ ? context.assignments_[experiment.id] : null;
          if (assignment == null)
            return;
          let variant = experiment.variants ? experiment.variants[assignment] : null;
          if (!variant || !variant.config)
            return;
          let variantConfig;
          try {
            variantConfig = typeof variant.config == "string" ? JSON.parse(variant.config) : variant.config;
          } catch (e) {
            Logger.warn(
              `[ABsmartly Extension] Failed to parse variant config for experiment ${experiment.name}:`,
              e
            );
            return;
          }
          let injectHtml = variantConfig.__inject_html;
          if (!injectHtml)
            return;
          Logger.log(
            `[ABsmartly Extension] Found __inject_html in experiment "${experiment.name}", variant ${assignment}`
          );
          let injectionCode;
          try {
            injectionCode = typeof injectHtml == "string" ? JSON.parse(injectHtml) : injectHtml;
          } catch (e) {
            Logger.warn(
              `[ABsmartly Extension] Failed to parse __inject_html for experiment ${experiment.name}:`,
              e
            );
            return;
          }
          if (injectionCode.urlFilter && !this.matchesUrlFilter(injectionCode.urlFilter)) {
            Logger.log(
              `[ABsmartly Extension] Skipping injection for experiment "${experiment.name}" - URL filter not matched`
            );
            return;
          }
          ["headStart", "headEnd", "bodyStart", "bodyEnd"].forEach((location) => {
            injectionCode[location] && (Logger.log(
              `[ABsmartly Extension] Injecting code for experiment "${experiment.name}" at ${location}`
            ), this.executeScriptsInHTML(injectionCode[location], location));
          }), Logger.log(
            `[ABsmartly Extension] Successfully processed injection code for experiment "${experiment.name}"`
          );
        } catch (error) {
          Logger.error(`[ABsmartly Extension] Error processing experiment ${idx}:`, error);
        }
      });
    }
    /**
     * Executes script tags found in HTML content
     * Scripts injected via innerHTML don't execute, so we need to recreate them
     */
    executeScriptsInHTML(html, location) {
      Logger.log(`[ABsmartly Extension] Processing scripts for ${location}`);
      let temp = document.createElement("div");
      temp.innerHTML = sanitizeHTML(html), temp.querySelectorAll("script").forEach((script, index) => {
        Logger.log(`[ABsmartly Extension] Executing script ${index + 1} from ${location}`);
        try {
          if (script.src) {
            let newScript = document.createElement("script");
            newScript.src = script.src, newScript.async = script.async, newScript.defer = script.defer, newScript.setAttribute("data-absmartly-injected", location), this.insertAtLocation(newScript, location);
          } else
            Logger.warn(
              `[ABsmartly Extension] Inline script execution disabled for security from ${location}`
            );
        } catch (error) {
          Logger.error(`[ABsmartly Extension] Failed to execute script from ${location}:`, error);
        }
      });
    }
    /**
     * Inserts an element at the correct location based on the injection point
     */
    insertAtLocation(element, location) {
      switch (location) {
        case "headStart":
          document.head.firstChild ? document.head.insertBefore(element, document.head.firstChild) : document.head.appendChild(element);
          break;
        case "headEnd":
          document.head.appendChild(element);
          break;
        case "bodyStart":
          document.body.firstChild ? document.body.insertBefore(element, document.body.firstChild) : document.body.appendChild(element);
          break;
        case "bodyEnd":
          document.body.appendChild(element);
          break;
        default:
          Logger.warn(`[ABsmartly Extension] Unknown injection location: ${location}`);
      }
    }
    /**
     * Helper function to check if current URL matches the filter
     * Returns true if URL matches or if no filter is specified
     */
    matchesUrlFilter(urlFilter) {
      if (!urlFilter)
        return !0;
      let currentUrl = window.location.href, currentPath = window.location.pathname, currentDomain = window.location.hostname, currentQuery = window.location.search, currentHash = window.location.hash, matchTarget;
      switch (typeof urlFilter == "object" && !Array.isArray(urlFilter) && urlFilter.matchType || "path") {
        case "full-url":
          matchTarget = currentUrl;
          break;
        case "domain":
          matchTarget = currentDomain;
          break;
        case "query":
          matchTarget = currentQuery;
          break;
        case "hash":
          matchTarget = currentHash;
          break;
        case "path":
        default:
          matchTarget = currentPath;
      }
      let includePatterns = [], excludePatterns = [], isRegex = !1;
      if (typeof urlFilter == "string" ? includePatterns = [urlFilter] : Array.isArray(urlFilter) ? includePatterns = urlFilter : (includePatterns = urlFilter.include || [], excludePatterns = urlFilter.exclude || [], isRegex = urlFilter.mode === "regex"), excludePatterns.length > 0)
        for (let pattern of excludePatterns)
          if (isRegex)
            try {
              if (new RegExp(pattern).test(matchTarget))
                return Logger.log(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`), !1;
            } catch (e) {
              Logger.warn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e);
            }
          else {
            let regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
            if (new RegExp(`^${regexPattern}$`).test(matchTarget))
              return Logger.log(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`), !1;
          }
      if (includePatterns.length === 0)
        return !0;
      for (let pattern of includePatterns)
        if (isRegex)
          try {
            if (new RegExp(pattern).test(matchTarget))
              return Logger.log(`[ABsmartly Extension] URL matched by pattern: ${pattern}`), !0;
          } catch (e) {
            Logger.warn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e);
          }
        else {
          let regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
          if (new RegExp(`^${regexPattern}$`).test(matchTarget))
            return Logger.log(`[ABsmartly Extension] URL matched by pattern: ${pattern}`), !0;
        }
      return Logger.log("[ABsmartly Extension] URL did not match any include patterns"), !1;
    }
  };
  __name(_CodeInjector, "CodeInjector");
  var CodeInjector = _CodeInjector;

  // src/sdk-bridge/experiment/override-manager.ts
  var _OverrideManager = class _OverrideManager {
    constructor(cookieName = "absmartly_overrides") {
      __publicField(this, "cookieName");
      this.cookieName = cookieName;
    }
    /**
     * Parse cookie overrides from cookie value string
     *
     * Format examples:
     * - Simple: "exp1:0,exp2:1" - just variant numbers
     * - With env: "exp1:0.1,exp2:1.2" - variant.env
     * - Full: "exp1:0.1.123,exp2:1.2.456" - variant.env.id
     * - With devEnv: "devEnv=https://example.com|exp1:0,exp2:1"
     */
    parseCookieOverrides(cookieValue) {
      if (!cookieValue)
        return { overrides: {}, devEnv: null };
      try {
        let devEnv = null, experimentsStr = cookieValue;
        if (cookieValue.startsWith("devEnv=")) {
          let parts = cookieValue.split("|");
          devEnv = decodeURIComponent(parts[0].substring(7)), experimentsStr = parts[1] || "";
        }
        let overrides = {};
        if (experimentsStr) {
          let experiments = experimentsStr.split(",");
          for (let exp of experiments) {
            let [name, values] = exp.split(":");
            if (!name || !values)
              continue;
            let decodedName = decodeURIComponent(name), parts = values.split(".");
            parts.length === 1 ? overrides[decodedName] = parseInt(parts[0], 10) : parts.length === 2 ? overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            } : overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            };
          }
        }
        return { overrides, devEnv };
      } catch (error) {
        return Logger.warn("[ABsmartly Extension] Failed to parse override cookie:", error), { overrides: {}, devEnv: null };
      }
    }
    /**
     * Check for override cookie and log its presence
     *
     * Note: The OverridesPlugin handles actual application of overrides.
     * This function just checks if the cookie exists and logs metadata.
     */
    checkOverridesCookie() {
      try {
        let cookieValue = document.cookie.split("; ").find((row) => row.startsWith(`${this.cookieName}=`))?.split("=")[1];
        if (cookieValue) {
          if (Logger.log(
            "[ABsmartly Extension] Found absmartly_overrides cookie (will be handled by OverridesPlugin)"
          ), cookieValue.startsWith("devEnv=")) {
            let devEnvMatch = cookieValue.match(/^devEnv=([^|]+)/);
            devEnvMatch && Logger.log(
              "[ABsmartly Extension] Development environment in cookie:",
              decodeURIComponent(devEnvMatch[1])
            );
          }
        } else
          Logger.log("[ABsmartly Extension] No experiment overrides cookie found");
      } catch (error) {
        Logger.error("[ABsmartly Extension] Error checking overrides cookie:", error);
      }
    }
    /**
     * Get the current override cookie value
     */
    getCookieValue() {
      try {
        return document.cookie.split("; ").find((row) => row.startsWith(`${this.cookieName}=`))?.split("=")[1] || null;
      } catch (error) {
        return Logger.error("[ABsmartly Extension] Error getting cookie value:", error), null;
      }
    }
    /**
     * Get parsed overrides from cookie
     */
    getOverrides() {
      let cookieValue = this.getCookieValue();
      return cookieValue ? this.parseCookieOverrides(cookieValue) : { overrides: {}, devEnv: null };
    }
  };
  __name(_OverrideManager, "OverrideManager");
  var OverrideManager = _OverrideManager;

  // src/sdk-bridge/core/orchestrator.ts
  var _Orchestrator = class _Orchestrator {
    constructor(config = {}) {
      __publicField(this, "config");
      __publicField(this, "state");
      __publicField(this, "sdkDetector");
      __publicField(this, "pluginDetector");
      __publicField(this, "sdkInterceptor");
      __publicField(this, "codeInjector");
      __publicField(this, "overrideManager");
      __publicField(this, "messageListenerSet", !1);
      this.config = {
        maxAttempts: config.maxAttempts || 50,
        // 5 seconds at 100ms intervals
        attemptInterval: config.attemptInterval || 100,
        debug: config.debug !== !1
      }, this.state = {
        isInitializing: !1,
        isInitialized: !1,
        cachedContext: null,
        contextPropertyPath: null
      }, this.sdkDetector = new SDKDetector(), this.pluginDetector = new PluginDetector(), this.sdkInterceptor = new SDKInterceptor({
        onSDKEvent: (eventName, data) => {
          this.handleSDKEvent(eventName, data);
        }
      }), this.codeInjector = new CodeInjector(), this.overrideManager = new OverrideManager();
    }
    /**
     * Start the initialization process
     */
    start() {
      document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => this.waitForSDKAndInitialize()) : setTimeout(() => this.waitForSDKAndInitialize(), 100);
    }
    /**
     * Wait for SDK and initialize
     */
    waitForSDKAndInitialize() {
      Logger.log("[ABsmartly Extension] \u{1F680} waitForSDKAndInitialize started");
      let attempts = 0, checkAndInit = /* @__PURE__ */ __name(() => {
        attempts++, Logger.log(`[ABsmartly Extension] \u{1F50D} Check attempt ${attempts}/${this.config.maxAttempts}`), this.state.cachedContext ? Logger.log("[ABsmartly Extension] \u2705 Using cached context") : (Logger.log("[ABsmartly Extension] \u{1F50E} No cached context, detecting SDK..."), this.detectAndCacheContext()), this.state.cachedContext && this.state.cachedContext.data && typeof this.state.cachedContext.data == "function" && this.state.cachedContext.ready && typeof this.state.cachedContext.ready == "function" && this.state.cachedContext.ready().then(() => {
          try {
            let data = this.state.cachedContext.data();
            Logger.log("[ABsmartly Extension] Context data on init:", data), Logger.log("[ABsmartly Extension] Experiments available:", data?.experiments ? Object.keys(data.experiments) : "none");
          } catch (error) {
            Logger.log("[ABsmartly Extension] Error accessing context data:", error.message);
          }
        }).catch((error) => {
          Logger.log("[ABsmartly Extension] Context ready() failed:", error.message);
        });
        let existingPlugin = this.pluginDetector.detectPlugin(this.state.cachedContext);
        if (existingPlugin) {
          if (existingPlugin === "active-but-inaccessible") {
            Logger.log("[ABsmartly Extension] Plugin is active but we cannot access it to inject custom code");
            return;
          }
          Logger.log("[ABsmartly Extension] Plugin already loaded, requesting custom code injection only"), this.overrideManager.checkOverridesCookie(), this.sendMessageToExtension({
            source: "absmartly-page",
            type: "REQUEST_CUSTOM_CODE"
          });
          return;
        }
        let context = this.state.cachedContext;
        context ? (Logger.log("[ABsmartly Extension] SDK context found, requesting plugin initialization"), context.ready && typeof context.ready == "function" && context.pending && context.pending() && (Logger.log("[ABsmartly Extension] Context is pending, waiting for it to be ready..."), context.ready().then(() => {
          Logger.log("[ABsmartly Extension] Context is now ready after waiting");
          let data = context.data ? context.data() : null;
          Logger.log("[ABsmartly Extension] Context data after ready:", data), Logger.log("[ABsmartly Extension] Experiments after ready:", data?.experiments ? Object.keys(data.experiments) : "none");
        }).catch((err) => {
          Logger.error("[ABsmartly Extension] Error waiting for context:", err);
        })), this.overrideManager.checkOverridesCookie(), this.sendMessageToExtension({
          source: "absmartly-page",
          type: "SDK_CONTEXT_READY"
        })) : attempts < this.config.maxAttempts ? setTimeout(checkAndInit, this.config.attemptInterval) : Logger.log("[ABsmartly Extension] No ABsmartly SDK found after 5 seconds");
      }, "checkAndInit");
      checkAndInit();
    }
    /**
     * Detect SDK and cache context
     */
    detectAndCacheContext() {
      let detection = this.sdkDetector.detectSDK();
      detection.context && !this.state.cachedContext ? (this.state.cachedContext = detection.context, this.state.contextPropertyPath = detection.contextPath || "unknown", Logger.log("[ABsmartly Extension] \u2705 Context found and cached at:", this.state.contextPropertyPath), Logger.log("[ABsmartly Extension] \u{1F4CA} Context details:", {
        hasTreatment: !!detection.context.treatment,
        hasPeek: !!detection.context.peek,
        hasData: !!detection.context.data,
        hasEventLogger: !!detection.context.eventLogger,
        has_eventLogger: detection.context._eventLogger !== void 0,
        contextType: typeof detection.context
      }), this.sdkInterceptor.interceptEventLogger(detection.context)) : detection.context || Logger.warn("[ABsmartly Extension] \u26A0\uFE0F No context found after detection");
    }
    /**
     * Setup message listener for extension communication
     */
    setupMessageListener() {
      this.messageListenerSet || (this.messageListenerSet = !0, Logger.log("[ABsmartly Extension] Setting up message listener for extension messages"), window.addEventListener("message", (event) => {
        !event.data || event.data.source !== "absmartly-extension" || (Logger.log("[ABsmartly Page] Received message from extension:", event.data), this.handleExtensionMessage(event.data));
      }));
    }
    /**
     * Handle messages from extension
     */
    handleExtensionMessage(message) {
      let { type, payload } = message;
      switch (type) {
        case "APPLY_OVERRIDES":
          this.handleApplyOverrides(payload);
          break;
        case "PREVIEW_CHANGES":
          this.handlePreviewChanges(payload);
          break;
        case "REMOVE_PREVIEW":
          this.handleRemovePreview(payload);
          break;
        case "INITIALIZE_PLUGIN":
          this.handleInitializePlugin(payload);
          break;
        case "INJECT_CUSTOM_CODE":
          Logger.log("[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used");
          break;
        default:
          Logger.warn("[ABsmartly Extension] Unknown message type:", type);
      }
    }
    /**
     * Handle apply overrides message
     */
    handleApplyOverrides(payload) {
      Logger.log("[ABsmartly Page] Applying overrides dynamically");
      let { overrides } = payload || {};
      overrides && (this.overrideManager.checkOverridesCookie(), Logger.log("[ABsmartly Page] Override metadata updated. Page will reload to apply changes."));
    }
    /**
     * Handle preview changes message (delegates to external handler if available)
     */
    handlePreviewChanges(payload) {
      Logger.log("[ABsmartly Page] Handling PREVIEW_CHANGES message");
      let { changes, experimentName } = payload || {}, expName = experimentName || "__preview__";
      Logger.log("[ABsmartly Page] Preview changes received for experiment:", expName), Logger.log("[ABsmartly Page] Changes to apply:", changes), Logger.log("[ABsmartly Page] Preview functionality requires external preview manager");
    }
    /**
     * Handle remove preview message (delegates to external handler if available)
     */
    handleRemovePreview(payload) {
      Logger.log("[ABsmartly Page] Handling REMOVE_PREVIEW message");
      let { experimentName } = payload || {}, expName = experimentName || "__preview__";
      Logger.log("[ABsmartly Page] Removing preview changes for experiment:", expName), Logger.log("[ABsmartly Page] Preview removal requires external preview manager");
    }
    /**
     * Handle initialize plugin message
     */
    handleInitializePlugin(payload) {
      if (this.state.isInitialized || this.state.isInitializing) {
        Logger.log("[ABsmartly Extension] Already initialized or initializing, skipping");
        return;
      }
      this.state.isInitializing = !0;
      let { config } = payload || {};
      Logger.log("[ABsmartly Extension] Received config from extension:", config);
      let existingPlugin = this.pluginDetector.detectPlugin(this.state.cachedContext);
      if (existingPlugin && existingPlugin !== "active-but-inaccessible") {
        this.state.isInitialized = !0, this.state.isInitializing = !1;
        return;
      }
      let context = this.state.cachedContext;
      if (!context) {
        Logger.error("[ABsmartly Extension] No context available for plugin initialization"), this.state.isInitializing = !1;
        return;
      }
      if (context.__domPlugin && context.__domPlugin.initialized) {
        Logger.log("[ABsmartly Extension] Plugin already initialized via context.__domPlugin"), this.state.isInitializing = !1;
        return;
      }
      try {
        Logger.log("[ABsmartly Extension] Checking for experiment-specific injection code"), this.codeInjector.injectExperimentCode(context);
      } catch (error) {
        Logger.error("[ABsmartly Extension] Failed to inject experiment code:", error);
      }
      this.sendMessageToExtension({
        source: "absmartly-page",
        type: "PLUGIN_INITIALIZED",
        payload: {
          version: "1.0.0",
          capabilities: ["code-injection"]
        }
      }), this.state.isInitialized = !0, this.state.isInitializing = !1;
    }
    /**
     * Handle SDK event
     */
    handleSDKEvent(eventName, data) {
      Logger.log("[ABsmartly Extension] \u{1F514} SDK Event:", { eventName, data }), this.sendMessageToExtension({
        source: "absmartly-page",
        type: "SDK_EVENT",
        payload: {
          eventName,
          data,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    /**
     * Send message to extension
     */
    sendMessageToExtension(message) {
      window.postMessage(message, "*");
    }
    /**
     * Get cached context
     */
    getContext() {
      return this.state.cachedContext;
    }
    /**
     * Get initialization state
     */
    getState() {
      return { ...this.state };
    }
    /**
     * Expose variant assignments getter for extension
     */
    exposeVariantAssignments() {
      window.__absmartlyGetVariantAssignments = async (experimentNames) => {
        Logger.log("[ABsmartly Extension] Getting variant assignments for:", experimentNames);
        let context = this.state.cachedContext || this.sdkDetector.detectSDK().context;
        if (!context)
          return Logger.warn("[ABsmartly Extension] No context available for getting variants"), { assignments: {}, experimentsInContext: [] };
        if (context.ready && typeof context.ready == "function")
          try {
            await context.ready();
          } catch (error) {
            Logger.warn("[ABsmartly Extension] Error waiting for context ready:", error);
          }
        let experimentsInContext = [];
        if (context.data && typeof context.data == "function") {
          let contextData = context.data();
          contextData?.experiments && (experimentsInContext = Object.keys(contextData.experiments));
        }
        let assignments = {};
        for (let expName of experimentNames)
          try {
            if (typeof context.peek == "function") {
              let variant = context.peek(expName);
              variant != null && variant !== -1 && (assignments[expName] = variant);
            }
          } catch (error) {
            Logger.warn(`[ABsmartly Extension] Failed to peek experiment ${expName}:`, error);
          }
        return { assignments, experimentsInContext };
      };
    }
    /**
     * Expose context path getter for extension
     */
    exposeContextPath() {
      window.__absmartlyGetContextPath = () => (this.state.cachedContext || this.detectAndCacheContext(), {
        found: !!this.state.cachedContext,
        path: this.state.contextPropertyPath || null,
        hasContext: !!this.state.cachedContext,
        hasPeek: this.state.cachedContext && typeof this.state.cachedContext.peek == "function",
        hasTreatment: this.state.cachedContext && typeof this.state.cachedContext.treatment == "function"
      });
    }
  };
  __name(_Orchestrator, "Orchestrator");
  var Orchestrator = _Orchestrator;

  // src/sdk-bridge/index.ts
  var SDK_BRIDGE_VERSION = "1.1.0", orchestrator = new Orchestrator();
  orchestrator.setupMessageListener();
  orchestrator.exposeVariantAssignments();
  orchestrator.exposeContextPath();
  orchestrator.start();
  console.log("[SDK Bridge] Module loaded - version", SDK_BRIDGE_VERSION);
  return __toCommonJS(sdk_bridge_exports);
})();
//# sourceMappingURL=absmartly-sdk-bridge.bundle.js.map


// Expose global API for backward compatibility
if (typeof ABSmartlySDKBridge !== 'undefined') {
  // Expose initialization functions
  window.__absmartlyGetVariantAssignments = ABSmartlySDKBridge.getVariantAssignments
  window.__absmartlyGetContextPath = ABSmartlySDKBridge.getContextPath

  // Mark as injected
  window.__absmartlyExtensionInjected = true

  console.log('[ABsmartly] SDK Bridge loaded successfully - version 1.1.0')
} else {
  console.error('[ABsmartly] Failed to load SDK Bridge - ABSmartlySDKBridge not found')
}
