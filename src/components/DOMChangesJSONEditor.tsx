import React, { useEffect, useRef } from 'react';

interface DOMChangesJSONEditorProps {
  isOpen: boolean;
  onClose: () => void;
  changes: any[];
  onSave: (changes: any[]) => void;
  variantName: string;
}

export const DOMChangesJSONEditor: React.FC<DOMChangesJSONEditorProps> = ({
  isOpen,
  onClose,
  changes,
  onSave,
  variantName,
}) => {
  const onSaveRef = useRef(onSave)
  const onCloseRef = useRef(onClose)
  
  useEffect(() => {
    onSaveRef.current = onSave
    onCloseRef.current = onClose
  }, [onSave, onClose])

  useEffect(() => {
    if (!isOpen) return

    // Send message to content script to open the JSON editor
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_JSON_EDITOR',
          data: {
            variantName,
            value: JSON.stringify(changes, null, 2)
          }
        })
      }
    })

    const handleMessage = (message: any) => {
      if (message.type === 'JSON_EDITOR_SAVE') {
        try {
          const parsedChanges = JSON.parse(message.value)
          
          if (!Array.isArray(parsedChanges)) {
            console.error('Changes must be an array')
            return
          }
          
          onSaveRef.current(parsedChanges)
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
  }, [isOpen, changes, variantName])

  return null
};
