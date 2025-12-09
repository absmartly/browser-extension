import React, { useEffect, useRef } from 'react'
import { sendToContent } from '~src/lib/messaging'
import { AI_DOM_GENERATION_SYSTEM_PROMPT } from '~src/prompts/ai-dom-generation-system-prompt'
import { getMetadata, setMetadata } from '~src/utils/indexeddb-storage'

interface SystemPromptEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (prompt: string) => void
}

const SYSTEM_PROMPT_KEY = 'ai-system-prompt-override'

export const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  isOpen,
  onClose,
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

    const openEditor = async () => {
      try {
        const override = await getMetadata(SYSTEM_PROMPT_KEY)
        const currentPrompt = override || AI_DOM_GENERATION_SYSTEM_PROMPT

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const currentTab = tabs[0]

        if (!currentTab?.id) {
          alert('Please navigate to a web page first to use the system prompt editor.\n\nThe editor opens in full-screen on the current page.')
          onCloseRef.current()
          return
        }

        const tabUrl = currentTab.url || ''
        if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
          alert('Cannot open editor on Chrome system pages.\n\nPlease navigate to a regular web page first.')
          onCloseRef.current()
          return
        }

        await sendToContent({
          type: 'OPEN_MARKDOWN_EDITOR',
          data: {
            title: 'System Prompt Override',
            value: currentPrompt
          }
        })
      } catch (error) {
        console.error('Error opening markdown editor:', error)

        if (error.message?.includes('Could not establish connection')) {
          alert('Please navigate to a web page first to use the system prompt editor.\n\nThe editor opens in full-screen on the current page, so you need to be viewing a website.')
        } else {
          alert('Failed to open editor: ' + error.message)
        }

        onCloseRef.current()
      }
    }
    openEditor()

    const handleMessage = (message: any) => {
      if (message.type === 'MARKDOWN_EDITOR_SAVE') {
        const newPrompt = message.value

        setMetadata(SYSTEM_PROMPT_KEY, newPrompt)
          .then(() => {
            onSaveRef.current(newPrompt)
            onCloseRef.current()
          })
          .catch((error) => {
            console.error('Failed to save system prompt:', error)
          })
      } else if (message.type === 'MARKDOWN_EDITOR_CLOSE') {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      const closeEditor = async () => {
        try {
          await sendToContent({
            type: 'CLOSE_MARKDOWN_EDITOR'
          })
        } catch (error) {
          console.error('Error closing markdown editor:', error)
        }
      }
      closeEditor()
    }
  }, [isOpen])

  return null
}

export async function getSystemPromptOverride(): Promise<string | null> {
  try {
    const override = await getMetadata(SYSTEM_PROMPT_KEY)
    return override || null
  } catch (error) {
    console.error('Failed to get system prompt override:', error)
    return null
  }
}

export async function clearSystemPromptOverride(): Promise<void> {
  try {
    await setMetadata(SYSTEM_PROMPT_KEY, null)
  } catch (error) {
    console.error('Failed to clear system prompt override:', error)
  }
}
