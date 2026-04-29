/**
 * Bridge from the visual editor (running in the page) to the SDK plugin's
 * PreviewManager (also running in the page). Uses the same window.postMessage
 * protocol the sidebar uses, so VE applies hit the production codepath.
 *
 * Why postMessage and not a direct call into window.__absmartlyDOMChangesPlugin:
 * the production code path is rooted at the sdk-bridge orchestrator, which
 * captures original element state in PreviewManager.previewStateMap before
 * delegating to the SDK. Going through the orchestrator keeps that capture
 * intact.
 */

import type { DOMChange } from "../types/visual-editor"

// Dedicated experiment name for VE-applied previews. Isolates VE state from
// any active production-experiment preview so previewStateMap stays coherent
// (one (element, experimentName) → originalState mapping).
export const VISUAL_EDITOR_EXPERIMENT_NAME = "__visual_editor__"

/**
 * Apply the full current change list under the given experiment name.
 *
 * Always uses updateMode: "replace" — the orchestrator first calls
 * PreviewManager.removePreviewChanges(experimentName) then applies the new
 * set. That matches the VE's edit-history semantics: every commit is a fresh
 * snapshot of the world, not a delta.
 */
export function applyChangesViaSDK(
  changes: DOMChange[],
  experimentName: string,
  variantName?: string
): void {
  if (typeof window === "undefined") return
  window.postMessage(
    {
      source: "absmartly-extension",
      type: "PREVIEW_CHANGES",
      payload: {
        changes,
        experimentName,
        variantName,
        updateMode: "replace"
      }
    },
    window.location.origin
  )
}

/**
 * Tear down all preview state for the given experiment name.
 * PreviewManager restores from previewStateMap and strips marker attributes.
 */
export function clearChangesViaSDK(experimentName: string): void {
  if (typeof window === "undefined") return
  window.postMessage(
    {
      source: "absmartly-extension",
      type: "REMOVE_PREVIEW",
      payload: {
        experimentName
      }
    },
    window.location.origin
  )
}

/**
 * True if the active-experiment preview header is currently in the DOM.
 * The header is created by content/preview-header.ts whenever the sidebar
 * applies a preview, and is the canonical signal that production preview is
 * live for this page.
 */
export function isProductionPreviewActive(): boolean {
  if (typeof document === "undefined") return false
  return document.getElementById("absmartly-preview-header") !== null
}
