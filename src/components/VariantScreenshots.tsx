import React, { useState } from "react"

import type { VariantScreenshot } from "~src/types/ai-fill"

import { ScreenshotViewer } from "./ScreenshotViewer"

interface VariantScreenshotsProps {
  screenshots: readonly VariantScreenshot[]
}

export function VariantScreenshots({ screenshots }: VariantScreenshotsProps) {
  const [active, setActive] = useState<VariantScreenshot | null>(null)

  if (screenshots.length === 0) return null

  return (
    <div id="variant-screenshots" className="space-y-2">
      <h3 className="text-sm font-semibold">Variant screenshots</h3>
      <div className="flex gap-3 flex-wrap">
        {screenshots.map((s) => (
          <button
            key={s.variantIndex}
            id={`variant-thumb-${s.variantIndex}`}
            data-testid={`variant-thumb-${s.variantIndex}`}
            type="button"
            className="border border-gray-300 rounded overflow-hidden hover:ring-2 hover:ring-blue-500"
            onClick={() => setActive(s)}
            title={`Open ${s.variantName} in full screen`}>
            <img
              src={s.afterDataUrl}
              alt={`${s.variantName} preview ON`}
              className="block w-32 h-20 object-cover"
            />
            <span className="block text-xs px-2 py-1 bg-gray-50 text-gray-700">
              {s.variantName}
            </span>
          </button>
        ))}
      </div>
      {active && (
        <ScreenshotViewer
          variantName={active.variantName}
          beforeDataUrl={active.beforeDataUrl}
          afterDataUrl={active.afterDataUrl}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
