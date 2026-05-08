import { XMarkIcon } from "@heroicons/react/24/outline"
import React, { useState } from "react"

import type { AIProviderType } from "~src/lib/ai-providers"
import type {
  Application,
  Experiment,
  ExperimentCustomSectionField,
  ExperimentTag,
  ExperimentTeam,
  ExperimentUser,
  UnitType
} from "~src/types/absmartly"
import type {
  AIFillResponse,
  CustomFieldDescriptor,
  VariantScreenshot
} from "~src/types/ai-fill"
import type { DOMChange } from "~src/types/dom-changes"

import { AIFillButton } from "./AIFillButton"
import { AudienceEditor } from "./AudienceEditor"
import { CustomFieldsEditor } from "./CustomFieldsEditor"
import { ExperimentCodeInjection } from "./ExperimentCodeInjection"
import { ExperimentMetadata } from "./ExperimentMetadata"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { VariantList } from "./VariantList"
import { VariantScreenshots } from "./VariantScreenshots"

type Mode = "create" | "edit"

export interface FullScreenDraft {
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
  customFieldValues: Record<string, unknown>
}

interface FullScreenExperimentModalProps {
  mode: Mode
  draft: FullScreenDraft
  variants: any[]
  customFields: readonly ExperimentCustomSectionField[]
  applications: readonly Application[]
  unitTypes: readonly UnitType[]
  owners: readonly ExperimentUser[]
  teams: readonly ExperimentTeam[]
  tags: readonly ExperimentTag[]
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
  onSave: () => void
  onClose: () => void
  onDraftChange: (next: FullScreenDraft) => void
  onVariantsChange: (variants: any[], hasChanges: boolean) => void
}

export function FullScreenExperimentModal(
  props: FullScreenExperimentModalProps
) {
  const [screenshots, setScreenshots] = useState<VariantScreenshot[]>([])

  const handleAIResult = (
    result: AIFillResponse,
    newScreenshots: VariantScreenshot[]
  ) => {
    setScreenshots(newScreenshots)
    props.onDraftChange(
      applyAIResultToDraft(
        props.draft,
        result,
        props.customFields,
        props.applications,
        props.tags
      )
    )
  }

  return (
    <div
      id="fullscreen-experiment-modal"
      data-testid="fullscreen-modal"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header
        id="fullscreen-modal-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb"
        }}>
        <h2
          id="fullscreen-modal-title"
          style={{ fontSize: 18, fontWeight: 600 }}>
          {props.mode === "edit" ? "Edit Experiment" : "Create Experiment"}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <AIFillButton
            draft={toAIFillDraft(props.draft, props.variants)}
            customFields={toCustomFieldDescriptors(props.customFields)}
            pageUrl={props.pageUrl}
            pageTitle={props.pageTitle}
            pageVisibleText={props.pageVisibleText}
            variantDomChanges={props.variantDomChanges}
            onPreviewToggle={props.onPreviewToggle}
            onPreviewWithChanges={props.onPreviewWithChanges}
            aiProviderConfig={props.aiProviderConfig}
            onResult={handleAIResult}
          />
          <button
            id="fullscreen-modal-close"
            data-testid="fullscreen-modal-close"
            type="button"
            aria-label="Close"
            style={{ padding: 4 }}
            onClick={props.onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </header>

      <div
        id="fullscreen-modal-body"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 24px",
          maxWidth: 960,
          width: "100%",
          margin: "0 auto"
        }}>
        <section className="space-y-3">
          <Input
            id="fs-display-name-input"
            label="Display Name"
            value={props.draft.display_name}
            onChange={(e) =>
              props.onDraftChange({
                ...props.draft,
                display_name: e.target.value
              })
            }
          />
          <Input
            id="fs-experiment-name-input"
            label="Experiment Name"
            value={props.draft.name}
            onChange={(e) =>
              props.onDraftChange({ ...props.draft, name: e.target.value })
            }
            required
          />
        </section>

        <section className="mt-4">
          <ExperimentMetadata
            data={{
              percentage_of_traffic: props.draft.percentage_of_traffic,
              unit_type_id: props.draft.unit_type_id,
              application_ids: props.draft.application_ids,
              owner_ids: props.draft.owner_ids,
              team_ids: props.draft.team_ids,
              tag_ids: props.draft.tag_ids
            }}
            onChange={(next) =>
              props.onDraftChange({ ...props.draft, ...next })
            }
            canEdit={true}
            applications={props.applications as any}
            unitTypes={props.unitTypes as any}
            owners={props.owners as any}
            teams={props.teams as any}
            tags={props.tags as any}
          />
        </section>

        <section className="mt-6">
          <AudienceEditor
            value={props.draft.audience}
            strict={props.draft.audience_strict}
            onChange={(v) =>
              props.onDraftChange({ ...props.draft, audience: v })
            }
            onStrictChange={(v) =>
              props.onDraftChange({ ...props.draft, audience_strict: v })
            }
          />
        </section>

        <section className="mt-6">
          <CustomFieldsEditor
            fields={props.customFields}
            values={props.draft.customFieldValues}
            onChange={(name, value) =>
              props.onDraftChange({
                ...props.draft,
                customFieldValues: {
                  ...props.draft.customFieldValues,
                  [name]: value
                }
              })
            }
          />
        </section>

        <section className="mt-6">
          <VariantList
            initialVariants={props.variants}
            experimentId={0}
            experimentName={props.draft.name}
            onVariantsChange={props.onVariantsChange}
            canEdit={true}
            canAddRemove={true}
            domFieldName="__dom_changes"
          />
        </section>

        {screenshots.length > 0 && (
          <section className="mt-6">
            <VariantScreenshots screenshots={screenshots} />
          </section>
        )}

        {props.variants.length > 0 && (
          <section className="mt-6">
            <ExperimentCodeInjection
              {...({
                experimentId: 0,
                variantIndex: 0,
                initialCode: undefined,
                domChangesUrlFilter: undefined,
                onChange: () => {},
                canEdit: true
              } as any)}
            />
          </section>
        )}
      </div>

      <footer
        id="fullscreen-modal-footer"
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end"
        }}>
        <Button
          id="fullscreen-modal-save"
          data-testid="fullscreen-modal-save"
          type="button"
          variant="primary"
          onClick={props.onSave}>
          {props.mode === "edit"
            ? "Update Experiment"
            : "Create Experiment Draft"}
        </Button>
        <Button type="button" variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
      </footer>
    </div>
  )
}

function toAIFillDraft(draft: FullScreenDraft, variants: { name: string }[]) {
  return {
    name: draft.name,
    display_name: draft.display_name,
    percentage_of_traffic: draft.percentage_of_traffic,
    percentages: draft.percentages,
    audience: draft.audience,
    audience_strict: draft.audience_strict,
    application_ids: draft.application_ids,
    tag_ids: draft.tag_ids,
    variantNames: variants.map((v) => v.name),
    customFieldValues: draft.customFieldValues
  }
}

function toCustomFieldDescriptors(
  fields: readonly ExperimentCustomSectionField[]
): CustomFieldDescriptor[] {
  return fields
    .filter((f) => !f.archived)
    .map((f) => ({
      fieldName: f.name,
      title: f.title || f.name,
      type: f.type,
      options: f.options,
      helpText: f.help_text,
      required: f.required
    }))
}

function applyAIResultToDraft(
  draft: FullScreenDraft,
  result: AIFillResponse,
  customFields: readonly ExperimentCustomSectionField[],
  applications: readonly Application[],
  tags: readonly ExperimentTag[]
): FullScreenDraft {
  const next: FullScreenDraft = { ...draft }

  if (result.display_name) next.display_name = result.display_name
  if (result.name) next.name = result.name
  if (typeof result.percentage_of_traffic === "number")
    next.percentage_of_traffic = result.percentage_of_traffic
  if (result.percentages) next.percentages = result.percentages
  if (result.audience) next.audience = result.audience
  if (typeof result.audience_strict === "boolean")
    next.audience_strict = result.audience_strict

  if (result.applications && Array.isArray(result.applications)) {
    // Map application names → application_id. Names that don't match any
    // workspace application are dropped — we never invent ids.
    const ids: number[] = []
    const seen = new Set<number>()
    for (const name of result.applications) {
      const match = applications.find((a) => a.name === name)
      const id = match?.application_id ?? match?.id
      if (typeof id === "number" && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length > 0) next.application_ids = ids
  }

  if (result.tags && Array.isArray(result.tags)) {
    const ids: number[] = []
    const seen = new Set<number>()
    for (const name of result.tags) {
      const match = tags.find((t) => t.name === name)
      const id = match?.experiment_tag_id
      if (typeof id === "number" && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length > 0) next.tag_ids = ids
  }

  // TODO(FT-1905 follow-up): apply result.variants[].name / .description back
  // to the variants list. Variants are managed by VariantList in the modal as
  // external state so this needs a separate plumbing change — tracked
  // separately from the customFieldValues / applications / tags fix.

  if (result.custom_fields) {
    const allowed = new Set(customFields.map((f) => f.name))
    const merged = { ...next.customFieldValues }
    for (const cf of result.custom_fields) {
      if (allowed.has(cf.field_name)) merged[cf.field_name] = cf.value
    }
    next.customFieldValues = merged
  }

  // Hypothesis / prediction / description map to custom fields if present
  for (const key of ["hypothesis", "prediction", "description"] as const) {
    const value = result[key]
    if (typeof value === "string" && customFields.some((f) => f.name === key)) {
      next.customFieldValues = {
        ...next.customFieldValues,
        [key]: value
      }
    }
  }

  return next
}
