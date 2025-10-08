import React, { useEffect, useRef } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Button } from './ui/Button'
import type { CustomCodeSection } from '~src/types/absmartly'

interface CustomCodeEditorProps {
  isOpen: boolean
  onClose: () => void
  section: CustomCodeSection
  value: string
  onChange: (value: string) => void
  onSave: () => void
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
  // Use refs to maintain stable references to callbacks
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onCloseRef = useRef(onClose)
  
  // Update refs when props change
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
    console.log('[CustomCodeEditor] Effect running - isOpen:', isOpen, 'section:', section, 'value:', value?.substring(0, 50))

    // Detect if we're in an iframe (test mode)
    const isInIframe = window.self !== window.top

    if (isInIframe) {
      // Test/iframe mode: use postMessage to communicate with parent page
      debugLog('CustomCodeEditor: Using iframe postMessage mode')
      console.log('[CustomCodeEditor] Sending OPEN_CODE_EDITOR to parent window')
      window.parent.postMessage({
        source: 'absmartly-sidebar',
        type: 'OPEN_CODE_EDITOR',
        data: {
          section,
          value,
          sectionTitle: getSectionTitle(section),
          placeholder: getPlaceholder(section),
          readOnly
        }
      }, '*')
      console.log('[CustomCodeEditor] Message sent')
    } else {
      // Production mode: use chrome.tabs API
      debugLog('CustomCodeEditor: Using chrome.tabs API mode')
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'OPEN_CODE_EDITOR',
            data: {
              section,
              value,
              sectionTitle: getSectionTitle(section),
              placeholder: getPlaceholder(section),
              readOnly
            }
          })
        }
      })
    }

    // Listen for messages from the background script or parent window
    const handleMessage = (message: any) => {
      debugLog('CustomCodeEditor received message:', message)

      if (message.type === 'CODE_EDITOR_SAVE') {
        debugLog('Saving value:', message.value)
        // Update the value first
        onChangeRef.current(message.value)
        // Use setTimeout to ensure React processes the state update before calling onSave
        setTimeout(() => {
          onSaveRef.current()
        }, 0)
      } else if (message.type === 'CODE_EDITOR_CLOSE') {
        debugLog('Closing editor')
        onCloseRef.current()
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      // Only handle messages from the parent window (in iframe mode)
      if (event.data?.source === 'absmartly-content-script') {
        handleMessage(event.data)
      }
    }

    if (isInIframe) {
      window.addEventListener('message', handleWindowMessage)
    } else {
      chrome.runtime.onMessage.addListener(handleMessage)
    }

    return () => {
      if (isInIframe) {
        window.removeEventListener('message', handleWindowMessage)
        // Tell content script to close the editor
        window.parent.postMessage({
          source: 'absmartly-sidebar',
          type: 'CLOSE_CODE_EDITOR'
        }, '*')
      } else {
        chrome.runtime.onMessage.removeListener(handleMessage)
        // Tell content script to close the editor
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CLOSE_CODE_EDITOR'
            })
          }
        })
      }
    }
  }, [isOpen, section, value]) // Only re-run when these change

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

  // Return null as the actual editor will be rendered in the content script
  return null
}
