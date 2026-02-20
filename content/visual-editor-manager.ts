import type { DOMChange } from "~src/types/dom-changes"
import { debugError, debugLog } from "~src/utils/debug"
import { VisualEditor } from "~src/visual-editor"
import { ensureSDKPluginInjected } from "./sdk-bridge"
import { removePreviewHeader } from "./preview-header"

export async function startVisualEditor(
  config: {
    variantName: string
    experimentName?: string
    changes?: DOMChange[]
    useShadowDOM?: boolean
  },
  setActive: (active: boolean) => void,
  setStarting: (starting: boolean) => void
): Promise<{ success: boolean; error?: string; editor?: VisualEditor }> {
  console.log(
    "[ABsmartly] startVisualEditor called with config:",
    JSON.stringify(config)
  )
  debugLog(
    "[Visual Editor Content Script] Starting visual editor with config:",
    config
  )
  debugLog("[Visual Editor Content Script] Variant:", config.variantName)
  debugLog(
    "[Visual Editor Content Script] Experiment name:",
    config.experimentName
  )

  await ensureSDKPluginInjected()

  try {
    setActive(true)
    setStarting(false)

    removePreviewHeader()

    const logoUrl = chrome.runtime.getURL("assets/absmartly-logo-white.svg")

    const urlParams = new URLSearchParams(window.location.search)
    const isTestMode =
      urlParams.get("use_shadow_dom_for_visual_editor_context_menu") === "0"
    debugLog("[Visual Editor Content Script] Test mode:", isTestMode)

    const useShadowDOM = isTestMode ? false : config.useShadowDOM !== false
    debugLog("[Visual Editor Content Script] Use Shadow DOM:", useShadowDOM)

    const editor = new VisualEditor({
      variantName: config.variantName,
      experimentName: config.experimentName,
      logoUrl: logoUrl,
      initialChanges: config.changes || [],
      useShadowDOM: useShadowDOM,
      onChangesUpdate: (changes: DOMChange[]) => {
        console.log("[Visual Editor Content Script] CALLBACK START")
        debugLog(
          "[Visual Editor Content Script] Changes updated:",
          changes?.length
        )
        console.log(
          "[Visual Editor Content Script] AFTER debugLog - about to send message"
        )
        console.log(
          "[Visual Editor Content Script] NOW SENDING VISUAL_EDITOR_CHANGES message with",
          changes.length,
          "changes"
        )

        chrome.runtime.sendMessage({
          type: "VISUAL_EDITOR_CHANGES",
          variantName: config.variantName,
          changes: changes
        })
      }
    })

    const result = editor.start()
    debugLog(
      "[Visual Editor Content Script] Visual editor start result:",
      result
    )

    if (!result.success) {
      throw new Error("Visual editor failed to start")
    }

    debugLog(
      "[Visual Editor Content Script] Visual editor started successfully"
    )
    return { success: true, editor }
  } catch (error) {
    debugError(
      "[Visual Editor Content Script] Error starting visual editor:",
      error
    )
    console.error("[Visual Editor Content Script] Full error:", error)
    setActive(false)
    return { success: false, error: error.message }
  }
}
