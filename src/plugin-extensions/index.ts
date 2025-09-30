/**
 * Plugin Extensions
 * Browser extension-specific features for DOM Changes Plugin
 */

export { ExtensionDOMPlugin } from './ExtensionDOMPlugin'
export { StateManager } from './StateManager'
export { MessageBridge } from './MessageBridge'
export { CodeInjector } from './CodeInjector'

export type { PluginConfig, DOMChange } from './ExtensionDOMPlugin'
export type { ElementState, AppliedChange } from './StateManager'
export type { ExtensionMessage, MessageHandler } from './MessageBridge'
export type { InjectionCode, InjectionLocation } from './CodeInjector'
