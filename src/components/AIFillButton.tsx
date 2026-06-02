import { SparklesIcon } from "@heroicons/react/24/outline"
import React, { useState } from "react"

import { fillExperimentFromAI } from "~src/lib/ai-experiment-filler"
import type { AIProviderType } from "~src/lib/ai-providers"
import type {
  AIFillDraft,
  AIFillResponse,
  CustomFieldDescriptor,
  VariantScreenshot
} from "~src/types/ai-fill"
import type { DOMChange } from "~src/types/dom-changes"
import { debugError } from "~src/utils/debug"
import { captureVisibleTab } from "~src/utils/screenshot-capture"

import { AIFillPromptDialog } from "./AIFillPromptDialog"

interface AIFillButtonProps {
  draft: AIFillDraft
  customFields: readonly CustomFieldDescriptor[]
  /** Optional: workspace applications surfaced to the LLM so it picks valid names. */
  applications?: readonly { id: number; name: string }[]
  /** Optional: workspace tags. */
  tags?: readonly { id: number; name: string }[]
  /** Optional: workspace metrics (id + name + description). */
  metrics?: readonly { id: number; name: string; description?: string }[]
  pageUrl: string
  pageTitle: string
  pageVisibleText: string
  variantDomChanges: readonly {
    variantIndex: number
    variantName: string
    changes: DOMChange[]
  }[]
  onPreviewToggle: (enabled: boolean) => void
  onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  aiProviderConfig: {
    aiProvider: AIProviderType
    apiKey?: string
    llmModel?: string
    customEndpoint?: string
  }
  onResult: (result: AIFillResponse, screenshots: VariantScreenshot[]) => void
}

export function AIFillButton({
  draft,
  customFields,
  applications,
  tags,
  metrics,
  pageUrl,
  pageTitle,
  pageVisibleText,
  variantDomChanges,
  onPreviewToggle,
  onPreviewWithChanges,
  aiProviderConfig,
  onResult
}: AIFillButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (userPrompt: string) => {
    setDialogOpen(false)
    setRunning(true)
    setError(null)

    try {
      const screenshots = await captureScreenshots(
        variantDomChanges,
        onPreviewToggle,
        onPreviewWithChanges
      )

      const result = await fillExperimentFromAI(
        {
          draft,
          customFields,
          applications,
          tags,
          metrics,
          pageUrl,
          pageTitle,
          pageVisibleText,
          variantDomChanges,
          variantScreenshots: screenshots,
          userPrompt: userPrompt || undefined
        },
        aiProviderConfig
      )

      onResult(result, screenshots)
    } catch (err) {
      debugError("[AI Fill] failed", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <button
        id="ai-fill-button"
        data-testid="ai-fill-button"
        type="button"
        disabled={running}
        onClick={() => setDialogOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
        <SparklesIcon className="h-4 w-4" />
        {running ? "Filling…" : "Fill with AI"}
      </button>
      {error && (
        <div
          id="ai-fill-error"
          data-testid="ai-fill-error"
          className="mt-2 text-xs text-red-600">
          {error}
        </div>
      )}
      <AIFillPromptDialog
        open={dialogOpen}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  )
}

async function captureScreenshots(
  variants: readonly {
    variantIndex: number
    variantName: string
    changes: DOMChange[]
  }[],
  onPreviewToggle: (enabled: boolean) => void,
  onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
): Promise<VariantScreenshot[]> {
  const out: VariantScreenshot[] = []
  for (const v of variants) {
    if (v.changes.length === 0) continue

    onPreviewToggle(false)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const before = await captureVisibleTab()

    onPreviewWithChanges(true, v.changes)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const after = await captureVisibleTab()

    onPreviewToggle(false)

    out.push({
      variantIndex: v.variantIndex,
      variantName: v.variantName,
      beforeDataUrl: before,
      afterDataUrl: after,
      width: window.innerWidth,
      height: window.innerHeight
    })
  }
  return out
}
