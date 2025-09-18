/**
 * ABsmartly Visual Editor - Unified Entry Point
 *
 * This module provides a unified API for the ABsmartly Visual Editor that can be used
 * in both content script and background injection scenarios.
 */

// Main visual editor class
export { VisualEditor, initVisualEditor } from './core/visual-editor'
import { VisualEditor, initVisualEditor } from './core/visual-editor'
import type { VisualEditorOptions } from './types/visual-editor'
import type { DOMChange, VisualEditorMessage } from './types/visual-editor'

// Core modules
export { default as StateManager } from './core/state-manager'
export { default as EventHandlers } from './core/event-handlers'
export { default as ContextMenu } from './core/context-menu'
export { default as ChangeTracker } from './core/change-tracker'
export { default as EditModes } from './core/edit-modes'
export { default as Cleanup } from './core/cleanup'

// UI modules
export { default as UIComponents } from './ui/components'
export { Toolbar } from './ui/toolbar'
export { Notifications } from './ui/notifications'
export { Styles } from './ui/styles'

// Utilities
export { generateRobustSelector } from './utils/selector-generator'

// Types
export type {
  VisualEditorConfig,
  VisualEditorOptions,
  VisualEditorState,
  VisualEditorAPI,
  DOMChange,
  ContextMenuItem,
  SelectorOptions,
  EditMode,
  NotificationType,
  EventHandlerCallbacks,
  ChangeTrackingOptions,
  DragDropState,
  ResizeState,
  ElementMetadata,
  VisualEditorMessage,
  VisualEditorError
} from './types/visual-editor'

export {
  DEFAULT_VISUAL_EDITOR_CONFIG,
  DEFAULT_SELECTOR_OPTIONS,
  DEFAULT_CHANGE_TRACKING_OPTIONS
} from './types/visual-editor'

// Version information
export const VISUAL_EDITOR_VERSION = '3.0.0-unified'

/**
 * Factory function for creating a visual editor instance
 * Supports both simple and advanced initialization patterns
 */
export function createVisualEditor(options: VisualEditorOptions) {
  return new VisualEditor(options)
}

/**
 * Initialize visual editor with legacy API for backwards compatibility
 * This matches the existing injection pattern
 */
export function initializeVisualEditor(
  variantName: string,
  experimentName: string,
  logoUrl: string,
  initialChanges: any[] = []
): { success: boolean; already?: boolean } {
  return initVisualEditor(variantName, experimentName, logoUrl, initialChanges)
}

/**
 * Check if visual editor is currently active
 */
export function isVisualEditorActive(): boolean {
  return !!(window as any).__absmartlyVisualEditorActive
}

/**
 * Get the current visual editor instance if available
 */
export function getCurrentVisualEditor(): VisualEditor | null {
  return (window as any).__absmartlyVisualEditor || null
}

/**
 * Stop the current visual editor if active
 */
export function stopVisualEditor(): void {
  const editor = getCurrentVisualEditor()
  if (editor) {
    editor.stop()
  }
}

/**
 * Utility function to safely execute visual editor operations
 */
export function withVisualEditor<T>(
  callback: (editor: VisualEditor) => T,
  fallback?: () => T
): T | undefined {
  const editor = getCurrentVisualEditor()
  if (editor) {
    return callback(editor)
  } else if (fallback) {
    return fallback()
  }
  return undefined
}

// Type guard functions
export function isDOMChange(obj: any): obj is DOMChange {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.selector === 'string' &&
    typeof obj.type === 'string'
  )
}

export function isVisualEditorMessage(obj: any): obj is VisualEditorMessage {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    obj.type.startsWith('ABSMARTLY_VISUAL_EDITOR_')
  )
}

// Browser environment detection
export const isBrowserSupported = (): boolean => {
  return !!(
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    document.querySelector &&
    window.getSelection &&
    window.addEventListener
  )
}

// Extension environment detection
export const isExtensionContext = (): boolean => {
  return !!(
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.sendMessage
  )
}

// Content script environment detection
export const isContentScript = (): boolean => {
  return isExtensionContext() && typeof window !== 'undefined'
}

// Background script environment detection
export const isBackgroundScript = (): boolean => {
  return isExtensionContext() && typeof window === 'undefined'
}

/**
 * Auto-initialization for content script environments
 * This allows the visual editor to be automatically available when imported
 */
if (isContentScript() && !isVisualEditorActive()) {
  // Make the visual editor available globally for legacy compatibility
  ;(window as any).ABSmartlyVisualEditor = {
    VisualEditor,
    initVisualEditor,
    createVisualEditor,
    isActive: isVisualEditorActive,
    getCurrent: getCurrentVisualEditor,
    stop: stopVisualEditor,
    version: VISUAL_EDITOR_VERSION
  }
}