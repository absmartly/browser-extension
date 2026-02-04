import { ensureSDKPluginInjected } from "../sdk-bridge"
import { createPreviewHeader, removePreviewHeader } from "../preview-header"

export function handlePreviewMessage(
  message: any,
  isVisualEditorActive: boolean,
  isVisualEditorStarting: boolean,
  sendResponse: (response: any) => void
) {
  const payload = message.payload || message
  const action = payload.action
  const changes = payload.changes
  const experimentName = payload.experimentName
  const variantName = payload.variantName
  const experimentId = payload.experimentId

  console.log(
    "[ABSmartly Content Script] Received preview message:",
    action
  )
  console.log(
    `[ABSmartly Content Script] VE state: isActive=${isVisualEditorActive}, isStarting=${isVisualEditorStarting}`
  )

  if (
    (isVisualEditorActive || isVisualEditorStarting) &&
    action === "update"
  ) {
    console.log(
      "[ABSmartly Content Script] Visual editor is active/starting, ignoring preview update"
    )
    sendResponse({
      success: true,
      message: "Visual editor active, preview update ignored"
    })
    return true
  }

  sendResponse({ success: true })

  ;(async () => {
    try {
      await ensureSDKPluginInjected()

      if (action === "apply") {
        console.log(
          `[ABSmartly Content Script] Handling preview apply. VE state: isActive=${isVisualEditorActive}, isStarting=${isVisualEditorStarting}`
        )
        createPreviewHeader(experimentName, variantName, isVisualEditorActive, isVisualEditorStarting)

        window.postMessage(
          {
            source: "absmartly-extension",
            type: "PREVIEW_CHANGES",
            payload: {
              changes: changes || [],
              experimentName: experimentName,
              variantName: variantName,
              experimentId: experimentId
            }
          },
          "*"
        )
      } else if (action === "update") {
        window.postMessage(
          {
            source: "absmartly-extension",
            type: "PREVIEW_CHANGES",
            payload: {
              changes: changes || [],
              experimentName: experimentName,
              variantName: variantName,
              experimentId: experimentId,
              updateMode: "replace"
            }
          },
          "*"
        )
      } else if (action === "remove") {
        if (!isVisualEditorActive) {
          removePreviewHeader()
        }

        window.postMessage(
          {
            source: "absmartly-extension",
            type: "REMOVE_PREVIEW",
            payload: {
              experimentName: experimentName
            }
          },
          "*"
        )
      }
    } catch (error) {
      console.error(
        "[ABSmartly Content Script] Error handling preview:",
        error
      )
    }
  })()

  return false
}
