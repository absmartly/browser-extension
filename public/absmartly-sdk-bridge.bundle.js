
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

  // src/sdk-bridge/index.ts
  var index_exports = {};
  __export(index_exports, {
    SDK_BRIDGE_VERSION: () => SDK_BRIDGE_VERSION,
    getContextPath: () => getContextPath,
    getVariantAssignments: () => getVariantAssignments
  });
  var SDK_BRIDGE_VERSION = "1.1.0";
  function getVariantAssignments(experimentNames) {
    return console.log("[SDK Bridge] getVariantAssignments called:", experimentNames), Promise.resolve({ assignments: {}, experimentsInContext: [] });
  }
  __name(getVariantAssignments, "getVariantAssignments");
  function getContextPath() {
    return console.log("[SDK Bridge] getContextPath called"), {
      found: !1,
      path: null,
      hasContext: !1,
      hasPeek: !1,
      hasTreatment: !1
    };
  }
  __name(getContextPath, "getContextPath");
  console.log("[SDK Bridge] Module loaded - version", SDK_BRIDGE_VERSION);
  return __toCommonJS(index_exports);
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
