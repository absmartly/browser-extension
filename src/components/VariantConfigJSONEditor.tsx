import React, { useEffect, useRef } from "react"

import { sendToContent } from "~src/lib/messaging"
import { getVariantConfigError } from "~src/lib/variant-config-validation"

import type { Variant } from "./VariantList"

interface VariantConfigJSONEditorProps {
  isOpen: boolean
  onClose: () => void
  variant: Variant
  onSave: (variant: Variant) => void
  domFieldName?: string
}

/**
 * JSON editor for full variant configuration
 * Shows all config fields (including __inject_html, __dom_changes, and custom variables)
 * This gives users complete visibility into what will be sent to the API
 */
export const VariantConfigJSONEditor: React.FC<
  VariantConfigJSONEditorProps
> = ({ isOpen, onClose, variant, onSave, domFieldName = "__dom_changes" }) => {
  const onSaveRef = useRef(onSave)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onSaveRef.current = onSave
    onCloseRef.current = onClose
  }, [onSave, onClose])

  useEffect(() => {
    if (!isOpen) return

    // Use the full variant config directly
    // This includes __inject_html, __dom_changes, and all custom variables
    const fullConfig = variant.config

    // Send message to content script to open the JSON editor
    const openEditor = async () => {
      try {
        await sendToContent({
          type: "OPEN_JSON_EDITOR",
          data: {
            variantName: variant.name,
            value: JSON.stringify(fullConfig, null, 2),
            domFieldName
          }
        })
      } catch (error) {
        console.error("Error opening JSON editor:", error)
      }
    }
    openEditor()

    const handleMessage = (message: any) => {
      if (message.type === "JSON_EDITOR_SAVE") {
        try {
          const parsedConfig = JSON.parse(message.value)

          const configError = getVariantConfigError(parsedConfig, domFieldName)
          if (configError) {
            console.error(configError)
            return
          }

          // Create updated variant - keep full config as-is
          const updatedVariant: Variant = {
            name: variant.name,
            config: parsedConfig
          }

          onSaveRef.current(updatedVariant)
          onCloseRef.current()
        } catch (e) {
          console.error("Failed to parse JSON:", e)
        }
      } else if (message.type === "JSON_EDITOR_CLOSE") {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      const closeEditor = async () => {
        try {
          await sendToContent({
            type: "CLOSE_JSON_EDITOR"
          })
        } catch (error) {
          console.error("Error closing JSON editor:", error)
        }
      }
      closeEditor()
    }
  }, [isOpen, variant, domFieldName])

  return null
}
