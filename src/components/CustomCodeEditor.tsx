import React, { useEffect, useRef } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { sendToContent } from '~src/lib/messaging'
import { Button } from './ui/Button'
import type { CustomCodeSection } from '~src/types/absmartly'

interface CustomCodeEditorProps {
  isOpen: boolean
  onClose: () => void
  section: CustomCodeSection
  value: string
  onChange: (value: string) => void
  onSave: (value: string) => void
  readOnly?: boolean
}

export function CustomCodeEditor({
  isOpen,
  onClose,
  section,
  value,
  onChange,
  onSave,
  readOnly = false
}: CustomCodeEditorProps) {
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onChangeRef.current = onChange
    onSaveRef.current = onSave
    onCloseRef.current = onClose
  }, [onChange, onSave, onClose])

  useEffect(() => {
    if (!isOpen) {
      debugLog('CustomCodeEditor: isOpen is false, not opening')
      return
    }

    debugLog('CustomCodeEditor: Opening code editor for section:', section, 'with value length:', value?.length || 0)

    const openEditor = async () => {
      try {
        await sendToContent({
          type: 'OPEN_CODE_EDITOR',
          data: {
            section,
            value,
            sectionTitle: getSectionTitle(section),
            placeholder: getPlaceholder(section),
            readOnly
          }
        })
      } catch (error) {
        console.error('Error opening code editor:', error)
      }
    }
    openEditor()

    const handleMessage = (message: any) => {
      debugLog('CustomCodeEditor received message:', message)

      if (message.type === 'CODE_EDITOR_SAVE') {
        debugLog('Saving value:', message.value)
        onChangeRef.current(message.value)
        onSaveRef.current(message.value)
      } else if (message.type === 'CODE_EDITOR_CLOSE') {
        debugLog('Closing editor')
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      const closeEditor = async () => {
        try {
          await sendToContent({
            type: 'CLOSE_CODE_EDITOR'
          })
        } catch (error) {
          console.error('Error closing code editor:', error)
        }
      }
      closeEditor()
    }
  }, [isOpen, section, value])

  const getSectionTitle = (section: CustomCodeSection) => {
    switch (section) {
      case 'headStart':
        return 'Start of <head> tag'
      case 'headEnd':
        return 'End of <head> tag'
      case 'bodyStart':
        return 'Start of <body> tag'
      case 'bodyEnd':
        return 'End of <body> tag'
      case 'styleTag':
        return 'CSS Styles'
      default:
        return 'Custom Code'
    }
  }

  const getPlaceholder = (section: CustomCodeSection) => {
    switch (section) {
      case 'headStart':
      case 'headEnd':
        return '<!-- Add your HTML/JavaScript code here -->\n<script>\n  // Your code\n</script>'
      case 'bodyStart':
      case 'bodyEnd':
        return '<!-- Add your HTML/JavaScript code here -->\n<script>\n  // Your code\n</script>'
      case 'styleTag':
        return '/* Add your CSS styles here */\n.my-class {\n  /* styles */\n}'
      default:
        return '// Enter your code here'
    }
  }

  return null
}
