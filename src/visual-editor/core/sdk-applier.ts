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
 * postMessage uses targetOrigin to gate which window can receive the
 * payload — passing `window.location.origin` is the secure default. But
 * for `file://` pages and pages whose origin serializes as the opaque
 * `"null"` string, that origin string never matches the receiver's own
 * origin and the message is silently dropped. visual-editor.ts already
 * falls back to "*" for those two cases; mirror it here so preview
 * apply / clear still reach the orchestrator on local-file experiments.
 */
function targetOriginFor(): string {
  const origin = window.location.origin
  if (origin === "null" || window.location.protocol === "file:") return "*"
  return origin
}

/**
 * Apply the full current change list under the given experiment name.
 *
 * Always uses updateMode: "replace" — the orchestrator first calls
 * PreviewManager.removePreviewChanges(experimentName) then applies the new
 * set. That matches the VE's edit-history semantics: every commit is a fresh
 * snapshot of the world, not a delta.
 *
 * postMessage can throw synchronously on the rare DataCloneError path
 * (uncloneable change payload, e.g. one carrying an Element ref). Catch
 * and log so a single bad change doesn't tear down the surrounding flow
 * (start/stop/undo/redo) — the orchestrator-side path already has its
 * own try/catch around applyPreviewChange, so async errors are handled
 * there.
 */
export function applyChangesViaSDK(
  changes: DOMChange[],
  experimentName: string,
  variantName?: string
): void {
  if (typeof window === "undefined") return
  try {
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
      targetOriginFor()
    )
  } catch (err) {
    console.error(
      "[VE/sdk-applier] applyChangesViaSDK failed",
      { experimentName, variantName, count: changes.length },
      err
    )
  }
}

/**
 * Tear down all preview state for the given experiment name.
 * PreviewManager restores from previewStateMap and strips marker attributes.
 */
export function clearChangesViaSDK(experimentName: string): void {
  if (typeof window === "undefined") return
  try {
    window.postMessage(
      {
        source: "absmartly-extension",
        type: "REMOVE_PREVIEW",
        payload: {
          experimentName
        }
      },
      targetOriginFor()
    )
  } catch (err) {
    console.error(
      "[VE/sdk-applier] clearChangesViaSDK failed",
      { experimentName },
      err
    )
  }
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
