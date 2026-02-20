import { ElementPicker } from "~src/content/element-picker"
import { debugLog } from "~src/utils/debug"

let elementPicker: ElementPicker | null = null
let currentElementPickerFieldId: string | null = null

export function handleStartElementPicker(
  fieldId: string,
  sendResponse: (response: any) => void
) {
  console.log('[content.ts] RECEIVED START_ELEMENT_PICKER, storing fieldId:', fieldId)
  currentElementPickerFieldId = fieldId
  debugLog("[Visual Editor Content Script] Starting element picker")

  if (!elementPicker) {
    elementPicker = new ElementPicker()
  }

  elementPicker.start((selector: string) => {
    const responseMsg = {
      type: "ELEMENT_SELECTED",
      selector: selector,
      fieldId: currentElementPickerFieldId
    }
    console.log('[content.ts] SENDING ELEMENT_SELECTED with fieldId from storage:', responseMsg)
    chrome.runtime.sendMessage(responseMsg)
    currentElementPickerFieldId = null
    elementPicker = null
  })

  sendResponse({ success: true })
  return true
}

export function handleCancelElementPicker(sendResponse: (response: any) => void) {
  debugLog("[Visual Editor Content Script] Canceling element picker")

  if (elementPicker) {
    elementPicker.stop()
    elementPicker = null
  }

  sendResponse({ success: true })
  return true
}
