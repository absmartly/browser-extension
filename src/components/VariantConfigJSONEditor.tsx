import React, { useEffect, useRef } from 'react'
import type { Variant } from './VariantList'

interface VariantConfigJSONEditorProps {
  isOpen: boolean
  onClose: () => void
  variant: Variant
  onSave: (variant: Variant) => void
}

/**
 * JSON editor for full variant configuration
 * Shows all config fields (including __inject_html, __dom_changes, and custom variables)
 * This gives users complete visibility into what will be sent to the API
 */
export const VariantConfigJSONEditor: React.FC<VariantConfigJSONEditorProps> = ({
  isOpen,
  onClose,
  variant,
  onSave,
}) => {
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_JSON_EDITOR',
          data: {
            variantName: variant.name,
            value: JSON.stringify(fullConfig, null, 2)
          }
        })
      }
    })

    const handleMessage = (message: any) => {
      if (message.type === 'JSON_EDITOR_SAVE') {
        try {
          const parsedConfig = JSON.parse(message.value)

          // Validate: must be an object
          if (typeof parsedConfig !== 'object' || parsedConfig === null) {
            console.error('Variant config must be an object')
            return
          }

          // Validate DOM changes format if present
          if (parsedConfig.__dom_changes) {
            const domChanges = parsedConfig.__dom_changes
            if (!Array.isArray(domChanges)) {
              if (typeof domChanges !== 'object' || !domChanges.changes || !Array.isArray(domChanges.changes)) {
                console.error('__dom_changes must be either an array or an object with a changes array')
                return
              }
            }
          }

          // Create updated variant - keep full config as-is
          const updatedVariant: Variant = {
            name: variant.name,
            config: parsedConfig
          }

          onSaveRef.current(updatedVariant)
          onCloseRef.current()
        } catch (e) {
          console.error('Failed to parse JSON:', e)
        }
      } else if (message.type === 'JSON_EDITOR_CLOSE') {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CLOSE_JSON_EDITOR'
          })
        }
      })
    }
  }, [isOpen, variant])

  return null
}
