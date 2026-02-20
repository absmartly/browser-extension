import React, { useRef, useEffect } from 'react'
import { SparklesIcon, EyeIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { renderMarkdown } from '~src/utils/markdown'
import type { ChatMessage, DOMChange } from '~src/types/dom-changes'

import { debugLog, debugWarn } from '~src/utils/debug'
interface ChatMessageListProps {
  messages: ChatMessage[]
  onViewChanges: (changes: DOMChange[], response: string, timestamp: number) => void
  onRestoreChanges: (changes: DOMChange[]) => void
  previewEnabledOnce: boolean
  onPreviewWithChanges?: (enabled: boolean, changes: DOMChange[]) => void
  onRestoreChangesCallback?: (changes: DOMChange[]) => void
  onPreviewRefresh?: () => void
}

export function ChatMessageList({
  messages,
  onViewChanges,
  onRestoreChanges,
  previewEnabledOnce,
  onPreviewWithChanges,
  onRestoreChangesCallback,
  onPreviewRefresh
}: ChatMessageListProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <SparklesIcon className="h-16 w-16 text-purple-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          AI-Powered DOM Changes
        </h3>
        <p className="text-gray-600 max-w-md mb-4">
          Describe what you want to change on the page, and the AI will analyze the HTML
          and generate the appropriate DOM changes for you.
        </p>
        <p className="text-sm text-purple-600 font-medium mb-2">
          💡 You can paste or drag images to help the AI understand your request!
        </p>
        <div className="mt-6 space-y-2 text-left w-full max-w-md">
          <p className="text-sm text-gray-700 font-medium">Example prompts:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Change the CTA button to red with white text</li>
            <li>• Add rounded corners to all product images</li>
            <li>• Hide the promotional banner</li>
            <li>• Make the headline text larger and bold</li>
            <li>• Replace the logo with this image (paste/drag image)</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-4">
      {messages.map((message, index) => (
        <div
          key={message.id || index}
          data-message-index={index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {message.images && message.images.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.images.map((img, imgIndex) => (
                  <div key={imgIndex} className="relative inline-block">
                    <img
                      src={img}
                      alt={`Attached ${imgIndex + 1}`}
                      className="max-w-full rounded border border-white/20"
                      style={{ maxHeight: '200px' }}
                    />
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm">
                      Thumbnail
                    </div>
                  </div>
                ))}
              </div>
            )}
            {message.content && (
              message.role === 'assistant' && message.aiResponse ? (
                <div
                  className="text-sm prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.aiResponse) }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )
            )}
            {message.role === 'assistant' && message.domChangesSnapshot && message.domChangesSnapshot.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => onViewChanges(
                    message.domChangesSnapshot!,
                    message.aiResponse || '',
                    message.timestamp
                  )}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <EyeIcon className="h-4 w-4" />
                  View Changes ({message.domChangesSnapshot.length})
                </button>
                <button
                  onClick={() => {
                    if (message.domChangesSnapshot) {
                      onRestoreChanges(message.domChangesSnapshot)

                      if (!previewEnabledOnce) {
                        debugLog('[ChatMessageList] Enabling preview after restoring changes from history')
                        if (onPreviewWithChanges) {
                          onPreviewWithChanges(true, message.domChangesSnapshot)
                        }
                        if (onRestoreChangesCallback) {
                          onRestoreChangesCallback(message.domChangesSnapshot)
                        }
                      } else {
                        debugLog('[ChatMessageList] Refreshing preview after restoring changes from history')
                        if (onRestoreChangesCallback) {
                          onRestoreChangesCallback(message.domChangesSnapshot)
                        }
                        setTimeout(() => {
                          if (onPreviewRefresh) {
                            onPreviewRefresh()
                          }
                        }, 100)
                      }
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded hover:bg-purple-100 transition-colors"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                  Restore
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  )
}
