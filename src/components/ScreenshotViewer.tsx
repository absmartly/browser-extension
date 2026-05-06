import { XMarkIcon } from "@heroicons/react/24/outline"
import React, { useEffect, useState } from "react"

interface ScreenshotViewerProps {
  variantName: string
  beforeDataUrl: string
  afterDataUrl: string
  onClose: () => void
}

export function ScreenshotViewer({
  variantName,
  beforeDataUrl,
  afterDataUrl,
  onClose
}: ScreenshotViewerProps) {
  const [showAfter, setShowAfter] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      id="screenshot-viewer"
      data-testid="screenshot-viewer"
      className="fixed inset-0 bg-black bg-opacity-90 z-[2147483647] flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <span id="screenshot-viewer-title" className="font-medium">
          {variantName} —{" "}
          {showAfter ? "After (preview ON)" : "Before (preview OFF)"}
        </span>
        <div className="flex items-center gap-3">
          <button
            id="screenshot-viewer-toggle"
            data-testid="screenshot-viewer-toggle"
            type="button"
            className="px-3 py-1 border border-white rounded hover:bg-white hover:text-black text-sm"
            onClick={() => setShowAfter((v) => !v)}>
            {showAfter ? "Show Before" : "Show After"}
          </button>
          <button
            id="screenshot-viewer-close"
            data-testid="screenshot-viewer-close"
            type="button"
            className="p-1 hover:bg-white hover:text-black rounded"
            onClick={onClose}
            aria-label="Close">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        <img
          id="screenshot-viewer-img"
          data-testid="screenshot-viewer-img"
          src={showAfter ? afterDataUrl : beforeDataUrl}
          alt={`${variantName} ${showAfter ? "after" : "before"}`}
          className="max-w-full max-h-full object-contain shadow-lg"
        />
      </div>
    </div>
  )
}
