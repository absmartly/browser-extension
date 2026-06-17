import React, { useEffect, useRef } from "react"

import { sendToContent } from "~src/lib/messaging"
import { AI_EXPERIMENT_FILL_SYSTEM_PROMPT } from "~src/prompts/ai-experiment-fill-system-prompt"
import { getMetadata, setMetadata } from "~src/utils/indexeddb-storage"

interface AIFillPromptEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (prompt: string) => void
}

const AI_FILL_PROMPT_KEY = "ai-fill-prompt-override"

export const AIFillPromptEditor: React.FC<AIFillPromptEditorProps> = ({
  isOpen,
  onClose,
  onSave
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
        const override = await getMetadata(AI_FILL_PROMPT_KEY)
        const currentPrompt = override || AI_EXPERIMENT_FILL_SYSTEM_PROMPT

        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        const currentTab = tabs[0]

        if (!currentTab?.id) {
          alert(
            "Please navigate to a web page first to use the AI Fill prompt editor.\n\nThe editor opens in full-screen on the current page."
          )
          onCloseRef.current()
          return
        }

        const tabUrl = currentTab.url || ""
        if (
          tabUrl.startsWith("chrome://") ||
          tabUrl.startsWith("chrome-extension://")
        ) {
          alert(
            "Cannot open editor on Chrome system pages.\n\nPlease navigate to a regular web page first."
          )
          onCloseRef.current()
          return
        }

        await sendToContent({
          type: "OPEN_MARKDOWN_EDITOR",
          data: {
            title: "AI Fill System Prompt Override",
            value: currentPrompt,
            defaultValue: AI_EXPERIMENT_FILL_SYSTEM_PROMPT
          }
        })
      } catch (error) {
        console.error("Error opening markdown editor:", error)

        if (error.message?.includes("Could not establish connection")) {
          alert(
            "Please navigate to a web page first to use the AI Fill prompt editor.\n\nThe editor opens in full-screen on the current page, so you need to be viewing a website."
          )
        } else {
          alert("Failed to open editor: " + error.message)
        }

        onCloseRef.current()
      }
    }
    openEditor()

    const handleMessage = (message: any) => {
      if (message.type === "MARKDOWN_EDITOR_SAVE") {
        const newPrompt = message.value

        setMetadata(AI_FILL_PROMPT_KEY, newPrompt)
          .then(() => {
            onSaveRef.current(newPrompt)
            onCloseRef.current()
          })
          .catch((error) => {
            console.error("Failed to save AI Fill prompt:", error)
          })
      } else if (message.type === "MARKDOWN_EDITOR_CLOSE") {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [isOpen])

  return null
}

export async function getAIFillPromptOverride(): Promise<string | null> {
  try {
    const override = await getMetadata(AI_FILL_PROMPT_KEY)
    return override || null
  } catch (error) {
    console.error("Failed to get AI Fill prompt override:", error)
    return null
  }
}

export async function clearAIFillPromptOverride(): Promise<void> {
  try {
    await setMetadata(AI_FILL_PROMPT_KEY, null)
  } catch (error) {
    console.error("Failed to clear AI Fill prompt override:", error)
  }
}
