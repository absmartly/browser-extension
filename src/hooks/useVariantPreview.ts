import { useState, useCallback, useEffect } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { sendToContent } from '~src/lib/messaging'
import type { DOMChange } from '~src/types/dom-changes'
import { getDOMChangesFromConfig, getChangesArray, type VariantConfig } from './useVariantConfig'

interface UseVariantPreviewOptions {
  variants: Array<{ name: string; config: VariantConfig }>
  experimentName: string
  domFieldName: string
  activeVEVariant: string | null
}

export function useVariantPreview({
  variants,
  experimentName,
  domFieldName,
  activeVEVariant
}: UseVariantPreviewOptions) {
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<number | null>(null)

  const handlePreviewToggle = useCallback(async (enabled: boolean, variantIndex: number) => {
    try {
      debugLog('[useVariantPreview] handlePreviewToggle called:', { enabled, variantIndex })

      setPreviewEnabled(enabled)
      setActivePreviewVariant(enabled ? variantIndex : null)
      debugLog('[useVariantPreview] State updated:', { previewEnabled: enabled, activePreviewVariant: enabled ? variantIndex : null })

      if (enabled && variants[variantIndex]) {
        const domChangesData = getDOMChangesFromConfig(variants[variantIndex].config, domFieldName)
        const changes = getChangesArray(domChangesData)
        const variantName = variants[variantIndex].name

        const enabledChanges = changes.filter(c => !c.disabled)
        debugLog('[useVariantPreview] Sending ABSMARTLY_PREVIEW (apply):', {
          experimentName,
          variantName,
          changesCount: enabledChanges.length,
          changes: enabledChanges
        })

        try {
          await sendToContent({
            type: 'ABSMARTLY_PREVIEW',
            action: 'apply',
            changes: enabledChanges,
            experimentName: experimentName,
            variantName: variantName
          })
          debugLog('[useVariantPreview] Preview apply successful')
        } catch (error) {
          debugError('[useVariantPreview] Error sending ABSMARTLY_PREVIEW (apply):', error)
        }
      } else {
        debugLog('[useVariantPreview] Sending ABSMARTLY_PREVIEW (remove):', { experimentName })

        try {
          await sendToContent({
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experimentName
          })
          debugLog('[useVariantPreview] Preview remove successful')
        } catch (error) {
          debugError('[useVariantPreview] Error sending ABSMARTLY_PREVIEW (remove):', error)
        }
      }

      debugLog('[useVariantPreview] handlePreviewToggle completed successfully')
    } catch (error) {
      debugError('[useVariantPreview] Unexpected error in handlePreviewToggle:', error)
    }
  }, [variants, experimentName, domFieldName, activeVEVariant])

  const handlePreviewWithChanges = useCallback(async (enabled: boolean, variantIndex: number, changes: DOMChange[]) => {
    try {
      debugLog('[useVariantPreview] handlePreviewWithChanges called:', { enabled, variantIndex, changesCount: changes.length })

      setPreviewEnabled(enabled)
      setActivePreviewVariant(enabled ? variantIndex : null)
      debugLog('[useVariantPreview] State updated:', { previewEnabled: enabled, activePreviewVariant: enabled ? variantIndex : null })

      if (enabled && variants[variantIndex]) {
        const variantName = variants[variantIndex].name
        const enabledChanges = changes.filter(c => !c.disabled)

        debugLog('[useVariantPreview] Sending ABSMARTLY_PREVIEW (apply) with provided changes:', {
          experimentName,
          variantName,
          changesCount: enabledChanges.length
        })

        try {
          await sendToContent({
            type: 'ABSMARTLY_PREVIEW',
            action: 'apply',
            changes: enabledChanges,
            experimentName: experimentName,
            variantName: variantName
          })
          debugLog('[useVariantPreview] Preview apply successful')
        } catch (error) {
          debugError('[useVariantPreview] Error sending ABSMARTLY_PREVIEW (apply):', error)
        }
      }

      debugLog('[useVariantPreview] handlePreviewWithChanges completed')
    } catch (error) {
      debugError('[useVariantPreview] Unexpected error in handlePreviewWithChanges:', error)
    }
  }, [variants, experimentName])

  const handlePreviewRefresh = useCallback(async (variantIndex: number) => {
    try {
      debugLog('[useVariantPreview] handlePreviewRefresh called:', { variantIndex, previewEnabled, activePreviewVariant })

      if (previewEnabled && activePreviewVariant === variantIndex && variants[variantIndex]) {
        const domChangesData = getDOMChangesFromConfig(variants[variantIndex].config, domFieldName)
        const changes = getChangesArray(domChangesData)
        const variantName = variants[variantIndex].name

        const enabledChanges = changes.filter(c => !c.disabled)
        debugLog('[useVariantPreview] Refreshing preview with latest changes:', {
          experimentName,
          variantName,
          changesCount: enabledChanges.length
        })

        try {
          await sendToContent({
            type: 'ABSMARTLY_PREVIEW',
            action: 'update',
            changes: enabledChanges,
            experimentName: experimentName,
            variantName: variantName
          })
          debugLog('[useVariantPreview] Preview refresh successful')
        } catch (error) {
          debugError('[useVariantPreview] Error sending ABSMARTLY_PREVIEW (update):', error)
        }
      } else {
        debugLog('[useVariantPreview] Preview refresh skipped - preview not enabled for this variant')
      }
    } catch (error) {
      debugError('[useVariantPreview] Unexpected error in handlePreviewRefresh:', error)
    }
  }, [variants, experimentName, domFieldName, previewEnabled, activePreviewVariant])

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      try {
        if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'PREVIEW_STATE_CHANGED' && 'enabled' in message && message.enabled === false) {
          debugLog('[useVariantPreview] Received PREVIEW_STATE_CHANGED, current previewEnabled:', previewEnabled, 'activePreviewVariant:', activePreviewVariant)
          if (previewEnabled && activePreviewVariant !== null) {
            debugLog('[useVariantPreview] Calling handlePreviewToggle to disable preview')
            handlePreviewToggle(false, activePreviewVariant)
          } else {
            debugLog('[useVariantPreview] Preview already disabled, ignoring PREVIEW_STATE_CHANGED')
          }
        }
      } catch (error) {
        debugError('[useVariantPreview] Error handling message:', error)
      }
      return false
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [previewEnabled, activePreviewVariant, handlePreviewToggle])

  useEffect(() => {
    return () => {
      try {
        sendToContent({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: experimentName
        }).catch(error => {
          debugLog('[useVariantPreview] No active tab for cleanup (normal on unmount):', error?.message)
        })
      } catch (error) {
        debugLog('[useVariantPreview] Exception during cleanup:', error?.message)
      }
    }
  }, [experimentName])

  return {
    previewEnabled,
    activePreviewVariant,
    handlePreviewToggle,
    handlePreviewWithChanges,
    handlePreviewRefresh
  }
}
