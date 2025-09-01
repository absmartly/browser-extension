import React, { useEffect, useRef } from 'react'
import { Button } from './ui/Button'
import type { CustomCodeSection } from '~src/types/absmartly'

interface CustomCodeEditorProps {
  isOpen: boolean
  onClose: () => void
  section: CustomCodeSection
  value: string
  onChange: (value: string) => void
  onSave: () => void
}

export function CustomCodeEditor({
  isOpen,
  onClose,
  section,
  value,
  onChange,
  onSave
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
    if (!isOpen) return

    console.log('Opening code editor for section:', section, 'with value:', value)
    
    // Send message to content script to open the editor in the main page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_CODE_EDITOR',
          data: {
            section,
            value,
            sectionTitle: getSectionTitle(section),
            placeholder: getPlaceholder(section)
          }
        })
      }
    })

    // Listen for messages from the background script (forwarded from content script)
    const handleMessage = (message: any) => {
      console.log('CustomCodeEditor received message:', message)
      
      if (message.type === 'CODE_EDITOR_SAVE') {
        console.log('Saving value:', message.value)
        // Use the ref values to ensure we have the latest callbacks
        onChangeRef.current(message.value)
        onSaveRef.current()
      } else if (message.type === 'CODE_EDITOR_CLOSE') {
        console.log('Closing editor')
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
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