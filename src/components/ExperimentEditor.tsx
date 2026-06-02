import {
  ArrowsPointingOutIcon,
  LockClosedIcon,
  LockOpenIcon
} from "@heroicons/react/24/outline"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useExperimentSave } from "~src/hooks/useExperimentSave"
import { useExperimentVariants } from "~src/hooks/useExperimentVariants"
import {
  getChangesConfig,
  getDOMChangesFromConfig,
  setDOMChangesInConfig
} from "~src/hooks/useVariantConfig"
import type { AIDOMGenerationResult } from "~src/lib/ai-dom-generator"
import type { AIProviderType } from "~src/lib/ai-providers"
import { BackgroundAPIClient } from "~src/lib/background-api-client"
import { sendToContent } from "~src/lib/messaging"
import type {
  DOMChangesData,
  Experiment,
  ExperimentCustomSectionField,
  ExperimentInjectionCode,
  URLFilter
} from "~src/types/absmartly"
import type { DOMChange } from "~src/types/dom-changes"
import { debugWarn } from "~src/utils/debug"
import { getConfig, localAreaStorage } from "~src/utils/storage"

import { ExperimentCodeInjection } from "./ExperimentCodeInjection"
import { ExperimentMetadata } from "./ExperimentMetadata"
import type { ExperimentMetadataData } from "./ExperimentMetadata"
import { openFullScreenModal } from "./fullscreen/openFullScreenModal"
import {
  FullScreenExperimentModal,
  type FullScreenDraft
} from "./FullScreenExperimentModal"
import { Header } from "./Header"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { VariantList } from "./VariantList"
import type { Variant } from "./VariantList"

interface ExperimentEditorProps {
  experiment?: Experiment | null
  onSave: (experiment: Partial<Experiment>) => Promise<void>
  onCancel: () => void
  loading?: boolean
  applications?: any[]
  unitTypes?: any[]
  metrics?: any[]
  tags?: any[]
  owners?: any[]
  teams?: any[]
  onNavigateToAI?: (
    variantName: string,
    onGenerate: (
      prompt: string,
      images?: string[]
    ) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => void
}

export function ExperimentEditor({
  experiment,
  onSave,
  onCancel,
  loading,
  applications = [],
  unitTypes = [],
  metrics = [],
  tags = [],
  owners = [],
  teams = [],
  onNavigateToAI
}: ExperimentEditorProps) {
  const [domFieldName, setDomFieldName] = useState<string>("__dom_changes")
  const [formData, setFormData] = useState<{
    name: string
    display_name: string
    state: Experiment["state"]
    percentage_of_traffic: number
    nr_variants: number
    percentages: string
    audience_strict: boolean
    audience: string
    unit_type_id: number | null
    application_ids: number[]
    owner_ids: number[]
    team_ids: number[]
    tag_ids: number[]
    primary_metric_id: number | null
    secondary_metric_ids: number[]
    customFieldValues: Record<string, unknown>
  }>(() => {
    // For an existing experiment custom_section_field_values arrives keyed by
    // numeric field id. We hydrate `customFieldValues` (also id-keyed, as
    // strings) in an effect below once the experiment payload is available.
    // Until then the modal sees `{}`, which means "no overrides".
    const initial = {
      name: experiment?.name || "",
      display_name: experiment?.display_name || "",
      state: experiment?.state || ("created" as Experiment["state"]),
      percentage_of_traffic: experiment?.percentage_of_traffic || 100,
      nr_variants: experiment?.nr_variants || 2,
      percentages: experiment?.percentages || "50/50",
      audience_strict: experiment?.audience_strict ?? false,
      audience: experiment?.audience || '{"filter":[{"and":[]}]}',
      unit_type_id:
        experiment?.unit_type?.unit_type_id || experiment?.unit_type_id || null,
      application_ids:
        experiment?.applications?.map((a) =>
          Number(a.application_id || a.id)
        ) || [],
      owner_ids:
        experiment?.owners?.map((o) => Number(o.user_id || (o as any).id)) ||
        [],
      team_ids:
        experiment?.teams?.map((t) => Number(t.team_id || (t as any).id)) || [],
      tag_ids:
        experiment?.experiment_tags?.map((t) => Number(t.experiment_tag_id)) ||
        [],
      primary_metric_id:
        experiment?.primary_metric?.metric_id ??
        (experiment as any)?.primary_metric_id ??
        null,
      secondary_metric_ids:
        (
          (experiment as any)?.secondary_metrics as
            | Array<{
                metric_id?: number
                metric?: { id?: number }
                id?: number
              }>
            | undefined
        )
          ?.map((m) => Number(m.metric_id ?? m.metric?.id ?? m.id ?? 0))
          .filter((n) => Number.isFinite(n) && n > 0) || [],
      customFieldValues: {} as Record<string, unknown>
    }
    return initial
  })

  // Use hooks
  const {
    initialVariants,
    currentVariants,
    setCurrentVariants,
    handleVariantsChange
  } = useExperimentVariants({
    experiment,
    domFieldName
  })
  const { save: saveExperiment } = useExperimentSave({
    experiment,
    domFieldName
  })

  const [namesSynced, setNamesSynced] = useState(!experiment) // Start synced for new experiments, unsynced for existing
  const aiChangesAppliedRef = useRef(false)

  // Load config on mount to get the DOM changes field name
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getConfig()
        const fieldName = config?.domChangesFieldName || "__dom_changes"
        setDomFieldName(fieldName)
      } catch {
        setDomFieldName("__dom_changes")
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    const applyAIDomChanges = async () => {
      if (aiChangesAppliedRef.current) return

      let aiDomChangesState: {
        variantName: string
        changes: DOMChange[]
      } | null = null
      try {
        aiDomChangesState = await localAreaStorage.get<{
          variantName: string
          changes: DOMChange[]
        }>("aiDomChangesState")
      } catch (error) {
        debugWarn(
          "[ExperimentEditor] Failed to read aiDomChangesState from storage:",
          error
        )
      }
      const windowState =
        typeof window !== "undefined"
          ? (window as any).__absmartlyLatestDomChanges
          : null
      const effectiveState = aiDomChangesState || windowState
      if (
        !effectiveState ||
        !effectiveState.changes ||
        effectiveState.changes.length === 0
      )
        return

      const namedIndex = currentVariants.findIndex(
        (v) => v.name === effectiveState.variantName
      )
      const targetIndex =
        namedIndex !== -1 ? namedIndex : currentVariants.length > 1 ? 1 : 0
      if (!currentVariants[targetIndex]) return
      console.log(
        "[AI Generate] ExperimentEditor applying AI changes:",
        effectiveState.variantName,
        effectiveState.changes.length
      )

      const domChangesData = getDOMChangesFromConfig(
        currentVariants[targetIndex].config,
        domFieldName
      )
      const currentConfig = getChangesConfig(domChangesData)
      const updatedDOMChanges: DOMChangesData = {
        ...currentConfig,
        changes: effectiveState.changes
      }

      const updatedVariants = [...currentVariants]
      updatedVariants[targetIndex] = {
        ...updatedVariants[targetIndex],
        config: setDOMChangesInConfig(
          updatedVariants[targetIndex].config,
          updatedDOMChanges,
          domFieldName
        )
      }

      handleVariantsChange(updatedVariants, true)

      const storageKey = experiment?.id
        ? `experiment-${experiment.id}-variants`
        : "experiment-new-variants"
      try {
        await localAreaStorage.set(storageKey, updatedVariants)
      } catch (error) {
        debugWarn(
          "[ExperimentEditor] Failed to persist AI changes to storage:",
          error
        )
      }
      aiChangesAppliedRef.current = true
      try {
        await localAreaStorage.remove("aiDomChangesState")
      } catch (error) {
        debugWarn(
          "[ExperimentEditor] Failed to clear aiDomChangesState:",
          error
        )
      }
      if (windowState) {
        delete (window as any).__absmartlyLatestDomChanges
      }
    }

    applyAIDomChanges()
  }, [currentVariants, domFieldName, experiment?.id, handleVariantsChange])

  // Full-screen modal: load custom fields and page context
  const [customFields, setCustomFields] = useState<
    ExperimentCustomSectionField[]
  >([])
  const [pageContext, setPageContext] = useState({
    url: "",
    title: "",
    visibleText: ""
  })
  const [aiProviderConfig, setAIProviderConfig] = useState<{
    aiProvider: AIProviderType
    apiKey?: string
    llmModel?: string
    customEndpoint?: string
  }>({ aiProvider: "claude-subscription" })

  // Once both the workspace custom-field defs and the experiment payload are
  // available, lift the experiment's id-keyed custom-section values into the
  // id-keyed (as strings) `formData.customFieldValues`. This lets the
  // round-trip into the full-screen modal show the existing values, and lets
  // the save path know which workspace fields the user expects on the payload.
  const customFieldsHydratedRef = useRef(false)
  useEffect(() => {
    if (customFieldsHydratedRef.current) return
    if (!experiment || customFields.length === 0) return
    const raw = experiment.custom_section_field_values
    if (!raw) {
      customFieldsHydratedRef.current = true
      return
    }
    const fieldsArray = Array.isArray(raw) ? raw : Object.values(raw)

    const next: Record<string, unknown> = {}
    for (const entry of fieldsArray) {
      if (typeof entry !== "object" || entry === null) continue
      const e = entry as {
        experiment_custom_section_field_id?: number
        custom_section_field?: { id?: number }
        id?: number
        value: unknown
      }
      const id =
        e.experiment_custom_section_field_id ??
        e.custom_section_field?.id ??
        e.id
      if (typeof id !== "number") continue
      next[String(id)] = e.value
    }
    if (Object.keys(next).length > 0) {
      setFormData((prev) => ({ ...prev, customFieldValues: next }))
    }
    customFieldsHydratedRef.current = true
  }, [experiment, customFields])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const client = new BackgroundAPIClient()
        const fields = await client.getCustomSectionFields()
        if (!cancelled) setCustomFields(fields)
      } catch (err) {
        debugWarn("[FullScreen] failed to load custom fields", err)
      }
      try {
        const ctx = (await sendToContent({ type: "GET_PAGE_CONTEXT" })) as
          | {
              url?: string
              title?: string
              visibleText?: string
            }
          | undefined
        if (!cancelled)
          setPageContext({
            url: ctx?.url || "",
            title: ctx?.title || "",
            visibleText: ctx?.visibleText || ""
          })
      } catch (err) {
        debugWarn("[FullScreen] failed to fetch page context", err)
      }
      try {
        const config = await getConfig()
        if (!cancelled) {
          const provider =
            (config?.aiProvider as AIProviderType) || "claude-subscription"
          setAIProviderConfig({
            aiProvider: provider,
            apiKey: config?.aiApiKey || undefined,
            // Mirror DOM-gen (background/main.ts): per-provider model takes
            // precedence over the top-level llmModel, since each provider can
            // have its own selected model in settings.
            llmModel:
              config?.providerModels?.[provider] ||
              config?.llmModel ||
              undefined,
            customEndpoint: config?.providerEndpoints?.[provider] || undefined
          })
        }
      } catch (err) {
        debugWarn("[FullScreen] failed to load AI provider config", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpenFullScreen = useCallback(async () => {
    // Re-fetch the AI provider config on every open so changes made in
    // Settings (provider, model, endpoint, api key) take effect immediately
    // without remounting the editor. The on-mount fetch above seeds the state
    // for the first paint; this overwrites with fresh values on each open.
    let freshAIConfig = aiProviderConfig
    try {
      const config = await getConfig()
      const provider =
        (config?.aiProvider as AIProviderType) || "claude-subscription"
      freshAIConfig = {
        aiProvider: provider,
        apiKey: config?.aiApiKey || undefined,
        llmModel:
          config?.providerModels?.[provider] || config?.llmModel || undefined,
        customEndpoint: config?.providerEndpoints?.[provider] || undefined
      }
      setAIProviderConfig(freshAIConfig)
    } catch (err) {
      debugWarn("[FullScreen] failed to refresh AI provider config", err)
    }

    const initialDraft: FullScreenDraft = {
      ...formData,
      customFieldValues: formData.customFieldValues
    }

    // Expand the sidebar iframe to fill the viewport before mounting the
    // modal — the modal lives inside the iframe, so without this it would be
    // clipped to the sidebar's 384px width.
    const apiClient = new BackgroundAPIClient()
    try {
      await apiClient.resizeSidebar("fullscreen")
    } catch (err) {
      debugWarn("[FullScreen] resize sidebar failed", err)
    }

    try {
      const result = await openFullScreenModal<{
        draft: FullScreenDraft
        variants?: typeof currentVariants
      }>({
        render: ({ close }) => (
          <FullScreenExperimentModal
            mode={experiment?.id ? "edit" : "create"}
            draft={initialDraft}
            variants={currentVariants as any[]}
            customFields={customFields}
            applications={applications as any}
            unitTypes={unitTypes as any}
            owners={owners as any}
            teams={teams as any}
            tags={tags as any}
            metrics={metrics as any}
            pageUrl={pageContext.url}
            pageTitle={pageContext.title}
            pageVisibleText={pageContext.visibleText}
            variantDomChanges={currentVariants
              .map((v, i) => ({
                variantIndex: i,
                variantName: v.name,
                changes: getChangesConfig(
                  getDOMChangesFromConfig(v.config, domFieldName)
                ).changes
              }))
              .filter((v) => v.changes.length > 0)}
            onPreviewToggle={(enabled) => {
              sendToContent({ type: "PREVIEW_TOGGLE", enabled }).catch(() => {})
            }}
            onPreviewWithChanges={(enabled, changes) => {
              sendToContent({
                type: "PREVIEW_WITH_CHANGES",
                enabled,
                changes
              }).catch(() => {})
            }}
            aiProviderConfig={freshAIConfig}
            onSave={() =>
              close({ draft: initialDraft, variants: currentVariants })
            }
            onClose={() => close()}
            onDraftChange={(next) => {
              Object.assign(initialDraft, next)
            }}
            onVariantsChange={(variants) => {
              handleVariantsChange(variants, true)
            }}
          />
        )
      })

      if (result?.draft) {
        setFormData((prev) => ({
          ...prev,
          ...result.draft
        }))
      }
    } catch (err) {
      // Don't surface modal-mount errors to the host page — the editor
      // continues to work even if the modal failed.
      debugWarn("[FullScreen] modal failed", err)
    } finally {
      // Always restore — even on close-via-Escape or unexpected error.
      try {
        await apiClient.resizeSidebar("restore")
      } catch (err) {
        debugWarn("[FullScreen] restore sidebar failed", err)
      }
    }
  }, [
    formData,
    currentVariants,
    customFields,
    applications,
    unitTypes,
    owners,
    teams,
    tags,
    pageContext,
    aiProviderConfig,
    experiment?.id,
    domFieldName,
    handleVariantsChange
  ])

  // Stable onChange handler for ExperimentMetadata using functional state update
  const handleMetadataChange = useCallback(
    (metadata: ExperimentMetadataData) => {
      setFormData((prev) => ({ ...prev, ...metadata }))
    },
    []
  )

  // Memoize metadata data object to prevent unnecessary re-renders
  const metadataData = useMemo(
    () => ({
      percentage_of_traffic: formData.percentage_of_traffic,
      unit_type_id: formData.unit_type_id,
      application_ids: formData.application_ids,
      owner_ids: formData.owner_ids,
      team_ids: formData.team_ids,
      tag_ids: formData.tag_ids
    }),
    [
      formData.percentage_of_traffic,
      formData.unit_type_id,
      formData.application_ids,
      formData.owner_ids,
      formData.team_ids,
      formData.tag_ids
    ]
  )

  // Helper functions for name conversion
  const snakeToTitle = (snake: string): string => {
    return snake
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const titleToSnake = (title: string): string => {
    return title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
  }

  const handleDisplayNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      display_name: value,
      ...(namesSynced ? { name: titleToSnake(value) } : {})
    }))
  }

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      ...(namesSynced ? { display_name: snakeToTitle(value) } : {})
    }))
  }

  // Helper functions for code injection
  const extractInjectionCode = (
    variant: Variant
  ): ExperimentInjectionCode | undefined => {
    if (!variant || !variant.config) return undefined
    const injectHtml = variant.config.__inject_html
    if (!injectHtml) return undefined
    return typeof injectHtml === "string" ? JSON.parse(injectHtml) : injectHtml
  }

  const extractDomChangesUrlFilter = (
    variant: Variant
  ): URLFilter | undefined => {
    if (!variant || !variant.config) return undefined
    const domChanges = variant.config[domFieldName] as DOMChangesData
    if (!domChanges || Array.isArray(domChanges)) return undefined
    return domChanges.urlFilter
  }

  const handleInjectionCodeChange = (code: ExperimentInjectionCode) => {
    const updatedVariants = [...currentVariants]
    if (updatedVariants[0]) {
      updatedVariants[0] = {
        ...updatedVariants[0],
        config: {
          ...updatedVariants[0].config,
          __inject_html: code
        }
      }
      setCurrentVariants(updatedVariants)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.unit_type_id) {
      alert("Please select a unit type")
      return
    }

    await saveExperiment(formData, currentVariants, undefined, onSave)
  }

  const handleCancel = async () => {
    // Cleanup function to stop VE and Preview
    try {
      // Stop Visual Editor
      await sendToContent({
        type: "STOP_VISUAL_EDITOR"
      })

      // Remove Preview (use experiment name if available)
      if (experiment?.name || formData.name) {
        await sendToContent({
          type: "ABSMARTLY_PREVIEW",
          action: "remove",
          experimentName: experiment?.name || formData.name
        })
      }
    } catch (error) {
      console.error("Error cleaning up visual editor and preview:", error)
    }

    onCancel()
  }

  return (
    <div className="p-4">
      <Header
        title={
          <h2
            id="create-experiment-header"
            className="text-lg font-semibold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">
            {experiment?.id ? "Edit Experiment" : "Create New Experiment"}
          </h2>
        }
        onBack={handleCancel}
      />

      <div className="flex justify-end mb-2">
        <Button
          id="open-fullscreen-button"
          data-testid="open-fullscreen-button"
          type="button"
          variant="secondary"
          onClick={handleOpenFullScreen}>
          <ArrowsPointingOutIcon className="h-4 w-4 mr-1 inline" />
          Open in full screen
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-3">
          {/* Name fields with sync lock */}
          <div className="flex items-start">
            <div className="flex-1 space-y-3" style={{ paddingRight: "24px" }}>
              <div>
                <label
                  id="display-name-label"
                  className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <Input
                  id="display-name-input"
                  data-testid="display-name-input"
                  value={formData.display_name}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="My Experiment"
                />
              </div>

              <div>
                <label
                  id="experiment-name-label"
                  className="block text-sm font-medium text-gray-700 mb-1">
                  Experiment Name
                </label>
                <Input
                  id="experiment-name-input"
                  data-testid="experiment-name-input"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="my_experiment_name"
                  required
                />
              </div>
            </div>

            {/* Lock icon with bracket */}
            <div
              className="relative"
              style={{
                width: "24px",
                paddingTop: "28px",
                marginLeft: "-24px"
              }}>
              {/* Bracket lines */}
              {namesSynced && (
                <svg
                  className="absolute"
                  width="24"
                  height="108"
                  style={{
                    left: "0",
                    top: "28px"
                  }}>
                  {/* Top horizontal */}
                  <path
                    d="M 0 20 L 12 20"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Bottom horizontal */}
                  <path
                    d="M 0 88 L 12 88"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Vertical connector */}
                  <path
                    d="M 12 20 L 12 88"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              )}

              {/* Lock button positioned on the vertical line */}
              <button
                type="button"
                onClick={() => setNamesSynced(!namesSynced)}
                className="absolute z-10 p-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                style={{
                  left: "12px",
                  top: "82px",
                  transform: "translate(-50%, -50%)"
                }}
                title={
                  namesSynced
                    ? "Names are synced. Click to unlock"
                    : "Names are not synced. Click to lock"
                }>
                {namesSynced ? (
                  <LockClosedIcon className="h-4 w-4 text-blue-600" />
                ) : (
                  <LockOpenIcon className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <ExperimentMetadata
            data={metadataData}
            onChange={handleMetadataChange}
            canEdit={true}
            applications={applications}
            unitTypes={unitTypes}
            owners={owners}
            teams={teams}
            tags={tags}
          />
        </div>

        {/* Variants */}
        <VariantList
          initialVariants={currentVariants}
          experimentId={experiment?.id || 0}
          experimentName={formData.name}
          onVariantsChange={(variants, hasChanges) => {
            handleVariantsChange(variants, hasChanges)
            // Update percentages
            const count = variants.length
            const percentage = Math.floor(100 / count)
            const remainder = 100 - percentage * count
            const percentages = Array(count).fill(percentage)
            percentages[0] += remainder
            setFormData((prev) => ({
              ...prev,
              nr_variants: count,
              percentages: percentages.join("/")
            }))
          }}
          canEdit={true}
          canAddRemove={true}
          domFieldName={domFieldName}
          onNavigateToAI={onNavigateToAI}
        />

        {/* Code Injection Section - Only for control variant */}
        {currentVariants.length > 0 && currentVariants[0] && (
          <ExperimentCodeInjection
            experimentId={experiment?.id || 0}
            variantIndex={0}
            initialCode={extractInjectionCode(currentVariants[0])}
            domChangesUrlFilter={extractDomChangesUrlFilter(currentVariants[0])}
            onChange={handleInjectionCodeChange}
            canEdit={true}
          />
        )}

        {/* Submit Buttons */}
        <div className="pt-4 border-t">
          {!experiment?.id && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 This will create a draft experiment. You'll need to finalize
                the setup in the ABsmartly console before it can be started.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              id="create-experiment-button"
              type="submit"
              variant="primary"
              disabled={loading}>
              {experiment?.id ? "Update Experiment" : "Create Experiment Draft"}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="secondary"
              disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
