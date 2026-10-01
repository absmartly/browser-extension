import React, { useEffect, useRef } from "react"

import { Button } from "./ui/Button"

interface CookieConsentModalProps {
  isOpen: boolean
  onGrant: () => void
  onDeny: () => void
}

export function CookieConsentModal({
  isOpen,
  onGrant,
  onDeny
}: CookieConsentModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // It can open on top of another dialog (e.g. unsaved changes), so move
  // keyboard focus into it and give it back when it closes.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus()
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return
    const buttons = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")
    )
    if (buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={dialogRef}
      id="cookie-consent-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-heading"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3
            id="cookie-consent-heading"
            className="text-lg font-semibold text-gray-900 text-center mb-2">
            ABsmartly Access Required
          </h3>
          <p className="text-sm text-gray-600 text-center">
            To communicate with ABsmartly, this extension needs permission to
            access ABsmartly domains.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-xs text-blue-800">
            <strong>What this allows:</strong>
          </p>
          <ul className="text-xs text-blue-800 mt-1 ml-4 list-disc space-y-1">
            <li>
              Make API requests to ABsmartly (bypassing CORS restrictions)
            </li>
            <li>
              Read authentication cookies from ABsmartly.com (for JWT auth)
            </li>
            <li>Fetch experiment data and user information</li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
          <p className="text-xs text-gray-700">
            <strong>Privacy:</strong> This permission only applies to{" "}
            <code className="bg-gray-200 px-1 rounded">*.absmartly.com</code>{" "}
            domains. The extension cannot access data from other websites.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            id="cookie-consent-grant"
            onClick={onGrant}
            variant="primary"
            className="flex-1">
            Grant Access
          </Button>
          <Button
            id="cookie-consent-cancel"
            onClick={onDeny}
            variant="secondary"
            className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
