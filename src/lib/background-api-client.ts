import type { APIOperation } from "~background/core/api-operations"
import type {
  ABsmartlyConfig,
  Application,
  Environment,
  Experiment,
  ExperimentCustomSectionField,
  ExperimentTag,
  ExperimentTeam,
  ExperimentUser,
  Metric,
  MetricCategory,
  MetricUsageRecord,
  UnitType
} from "~src/types/absmartly"
import { APIError } from "~src/types/errors"
import { debugError, debugLog, debugWarn } from "~src/utils/debug"

interface ExperimentParams {
  page?: number
  items?: number
  [key: string]: unknown
}

interface CreateExperimentData {
  name: string
  application_id?: number
  unit_type_id?: number
  variants?: Array<{
    name: string
    is_control?: boolean
    config?: string
  }>
  [key: string]: unknown
}

interface UpdateExperimentData {
  name?: string
  display_name?: string
  audience?: string
  applications?: number[]
  [key: string]: unknown
}

/**
 * Coerce the raw API shape for a custom-section field into the
 * `ExperimentCustomSectionField` contract. The canonical identifier is the
 * numeric `id`; we don't synthesize a `.name` slug — callers index by id.
 * We still warn on missing `id`/`title`/`type` as a data-quality sanity check.
 */
function warnIfCustomFieldShapeBad(raw: any, index: number): void {
  const missing: string[] = []
  if (typeof raw?.id !== "number") missing.push("id")
  if (typeof raw?.title !== "string" || !raw.title) missing.push("title")
  if (typeof raw?.type !== "string" || !raw.type) missing.push("type")
  if (missing.length > 0) {
    debugWarn(
      `[BackgroundAPIClient] custom field [${index}] missing:`,
      missing.join(", "),
      "— raw:",
      JSON.stringify(raw)
    )
  }
}

export class BackgroundAPIClient {
  private async sendOperation(operation: APIOperation): Promise<unknown> {
    debugLog("BackgroundAPIClient.sendOperation:", operation)

    const response = await chrome.runtime.sendMessage({
      type: "API_OPERATION",
      operation
    })

    if (!response) {
      throw new APIError(
        "Background service worker did not respond. The extension may need to be reloaded.",
        false
      )
    }

    debugLog("BackgroundAPIClient operation response:", response)
    if (!response.success) {
      throw new APIError(
        response.error || "API operation failed",
        response.isAuthError || false
      )
    }
    return response.data
  }

  async makeRequest(
    method: string,
    path: string,
    data?: unknown
  ): Promise<unknown> {
    debugLog("BackgroundAPIClient.makeRequest:", { method, path, data })

    const response = await chrome.runtime.sendMessage({
      type: "API_REQUEST",
      method,
      path,
      data
    })

    if (!response) {
      throw new APIError(
        "Background service worker did not respond. The extension may need to be reloaded.",
        false
      )
    }

    debugLog("BackgroundAPIClient response:", response)
    if (!response.success) {
      throw new APIError(
        response.error || "API request failed",
        response.isAuthError || false
      )
    }
    return response.data
  }

  async openLogin(): Promise<{ authenticated?: boolean }> {
    const response = await chrome.runtime.sendMessage({
      type: "OPEN_LOGIN"
    })
    return response || {}
  }

  async getExperiments(
    params?: ExperimentParams
  ): Promise<{ experiments: Experiment[]; total?: number; hasMore?: boolean }> {
    try {
      debugLog("getExperiments called with params:", params)

      // Use generic request to get full paginated response
      const rawData = (await this.makeRequest(
        "GET",
        "/experiments",
        params
      )) as Record<string, unknown>

      const experimentsData = rawData.experiments || rawData.data || rawData
      const experiments = Array.isArray(experimentsData)
        ? (experimentsData as Experiment[])
        : []
      const total =
        typeof rawData.total === "number"
          ? rawData.total
          : typeof rawData.totalCount === "number"
            ? rawData.totalCount
            : typeof rawData.count === "number"
              ? rawData.count
              : undefined
      const hasMore =
        rawData.has_more === true ||
        rawData.hasMore === true ||
        (params?.page !== undefined && experiments.length === params.items)

      return {
        experiments,
        total,
        hasMore
      }
    } catch (error) {
      debugError("Failed to fetch experiments:", error)
      throw error
    }
  }

  async getExperiment(id: number): Promise<Experiment> {
    try {
      return (await this.sendOperation({
        op: "getExperiment",
        id
      })) as Experiment
    } catch (error) {
      debugError(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }

  async createExperiment(data: CreateExperimentData): Promise<Experiment> {
    try {
      debugLog(
        "[createExperiment] Request data:",
        JSON.stringify(data, null, 2)
      )
      const response = await this.sendOperation({
        op: "createExperiment",
        data
      })
      debugLog(
        "[createExperiment] Full response:",
        JSON.stringify(response, null, 2)
      )
      return response as Experiment
    } catch (error) {
      debugError("Failed to create experiment:", error)
      throw error
    }
  }

  async updateExperiment(
    id: number,
    data: UpdateExperimentData
  ): Promise<Experiment> {
    try {
      return (await this.sendOperation({
        op: "updateExperiment",
        id,
        data
      })) as Experiment
    } catch (error) {
      debugError(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }

  async startExperiment(id: number): Promise<Experiment> {
    try {
      return (await this.sendOperation({
        op: "startExperiment",
        id
      })) as Experiment
    } catch (error) {
      debugError(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }

  async stopExperiment(id: number): Promise<Experiment> {
    try {
      return (await this.sendOperation({
        op: "stopExperiment",
        id
      })) as Experiment
    } catch (error) {
      debugError(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }

  async getApplications(): Promise<Application[]> {
    try {
      const apps = await this.sendOperation({ op: "listApplications" })
      if (!Array.isArray(apps)) {
        debugWarn(
          "[BackgroundAPIClient] listApplications returned non-array:",
          typeof apps
        )
        return []
      }
      return apps as Application[]
    } catch (error) {
      debugError("Failed to fetch applications:", error)
      throw error
    }
  }

  async getUnitTypes(): Promise<UnitType[]> {
    try {
      const unitTypes = await this.sendOperation({ op: "listUnitTypes" })
      if (!Array.isArray(unitTypes)) {
        debugWarn(
          "[BackgroundAPIClient] listUnitTypes returned non-array:",
          typeof unitTypes
        )
        return []
      }
      return unitTypes as UnitType[]
    } catch (error) {
      debugError("Failed to fetch unit types:", error)
      throw error
    }
  }

  async getMetrics(): Promise<Metric[]> {
    try {
      const metrics = await this.sendOperation({ op: "listMetrics" })
      if (!Array.isArray(metrics)) {
        debugWarn(
          "[BackgroundAPIClient] listMetrics returned non-array:",
          typeof metrics
        )
        return []
      }
      return metrics as Metric[]
    } catch (error) {
      debugError("Failed to fetch metrics:", error)
      throw error
    }
  }

  /**
   * Fetch the per-metric usage rollups powering the metric cards in the
   * fullscreen experiment modal. Routes through the CLI's
   * `listMetricUsages` (hits `GET /v1/metrics/usages`).
   *
   * The endpoint returns either an unwrapped array or one of a handful of
   * wrapping keys (`metricUsages` per the web app, `metric_usages`, or
   * `metrics` per the CLI). We accept all three so callers don't have to
   * normalize across API versions; if we can't find any of them we
   * downgrade to `[]` rather than throwing, since the merge in
   * ExperimentEditor is best-effort.
   */
  async getMetricUsages(): Promise<MetricUsageRecord[]> {
    try {
      const raw = await this.sendOperation({ op: "listMetricUsages" })
      const list = unwrapListResponse(raw, [
        "metricUsages",
        "metric_usages",
        "metrics"
      ])
      if (!Array.isArray(list)) {
        debugWarn(
          "[BackgroundAPIClient] listMetricUsages returned non-array shape:",
          typeof raw
        )
        return []
      }
      return list as MetricUsageRecord[]
    } catch (error) {
      debugError("Failed to fetch metric usages:", error)
      throw error
    }
  }

  /**
   * Fetch metric categories so the modal can colour-code the metric cards
   * (mirrors the web app's `useMetricCategoriesListQuery`). Routes through
   * the CLI's `listMetricCategories`, which hits
   * `GET /v1/metric_categories`.
   *
   * Accepts both the unwrapped array (CLI's normalized shape) and the
   * wrapped `metric_categories` payload for defensive parity with
   * `getMetricUsages`.
   */
  async getMetricCategories(): Promise<MetricCategory[]> {
    try {
      const raw = await this.sendOperation({ op: "listMetricCategories" })
      const list = unwrapListResponse(raw, ["metric_categories", "categories"])
      if (!Array.isArray(list)) {
        debugWarn(
          "[BackgroundAPIClient] listMetricCategories returned non-array shape:",
          typeof raw
        )
        return []
      }
      return list as MetricCategory[]
    } catch (error) {
      debugError("Failed to fetch metric categories:", error)
      throw error
    }
  }

  async getExperimentTags(): Promise<ExperimentTag[]> {
    try {
      const tags = await this.sendOperation({ op: "listExperimentTags" })
      if (!Array.isArray(tags)) {
        debugWarn(
          "[BackgroundAPIClient] listExperimentTags returned non-array:",
          typeof tags
        )
        return []
      }
      return tags as ExperimentTag[]
    } catch (error) {
      debugError("Failed to fetch experiment tags:", error)
      throw error
    }
  }

  async getOwners(): Promise<ExperimentUser[]> {
    try {
      const users = await this.sendOperation({ op: "listUsers" })
      if (!Array.isArray(users)) {
        debugWarn(
          "[BackgroundAPIClient] listUsers returned non-array:",
          typeof users
        )
        return []
      }
      return users as ExperimentUser[]
    } catch (error) {
      debugError("Failed to fetch owners:", error)
      throw error
    }
  }

  async getTeams(): Promise<ExperimentTeam[]> {
    try {
      const teams = await this.sendOperation({ op: "listTeams" })
      if (!Array.isArray(teams)) {
        debugWarn(
          "[BackgroundAPIClient] listTeams returned non-array:",
          typeof teams
        )
        return []
      }
      return teams as ExperimentTeam[]
    } catch (error) {
      debugError("Failed to fetch teams:", error)
      throw error
    }
  }

  async getFavorites(): Promise<number[]> {
    try {
      // favorites list not yet in CLI core, use generic request
      const data = (await this.makeRequest("GET", "/favorites")) as Record<
        string,
        unknown
      >
      const experiments = data?.experiments
      return Array.isArray(experiments) ? (experiments as number[]) : []
    } catch (error) {
      debugError("Failed to fetch favorites:", error)
      throw error
    }
  }

  async setExperimentFavorite(id: number, favorite: boolean): Promise<void> {
    try {
      await this.sendOperation({
        op: "favoriteExperiment",
        id,
        favorite
      })
    } catch (error) {
      debugError(
        `Failed to ${favorite ? "add" : "remove"} favorite for experiment ${id}:`,
        error
      )
      throw error
    }
  }

  async getEnvironments(): Promise<Environment[]> {
    try {
      const environments = await this.sendOperation({ op: "listEnvironments" })
      if (!Array.isArray(environments)) {
        debugWarn(
          "[BackgroundAPIClient] listEnvironments returned non-array:",
          typeof environments
        )
        return []
      }
      return environments as Environment[]
    } catch (error) {
      debugError("Failed to fetch environments:", error)
      throw error
    }
  }

  async getTemplates(
    type:
      | "test_template"
      | "feature_template"
      | "test_template,feature_template" = "test_template"
  ): Promise<Experiment[]> {
    try {
      const experiments = (await this.sendOperation({
        op: "listExperiments",
        params: { type }
      })) as Experiment[]
      return Array.isArray(experiments) ? experiments : []
    } catch (error) {
      debugError("Failed to fetch templates:", error)
      throw error
    }
  }

  async getCustomSectionFields(): Promise<ExperimentCustomSectionField[]> {
    try {
      const fields = await this.sendOperation({ op: "listCustomSectionFields" })
      if (!Array.isArray(fields)) {
        debugWarn(
          "[BackgroundAPIClient] listCustomSectionFields returned non-array:",
          typeof fields
        )
        return []
      }
      fields.forEach((raw: any, i: number) => warnIfCustomFieldShapeBad(raw, i))
      return fields as ExperimentCustomSectionField[]
    } catch (error) {
      debugError("Failed to fetch custom section fields:", error)
      throw error
    }
  }

  /**
   * Fetch suggested JSON layout keys (attribute paths) seen in recent events.
   * Mirrors the web app's `AbsJSONLayoutTextField` autocomplete — passes
   * `prefix` for typeahead filtering and lets the API decide the recency
   * window. Response shape is the standard query response
   * `{columnNames, rows}` that callers zip into objects.
   */
  async getEventJsonLayouts(body: {
    source: "unit_attribute" | "unit_goal_property"
    phase: "before_enrichment" | "after_enrichment"
    prefix?: string
    source_id?: number
    from?: number
    to?: number
    take?: number
    skip?: number
    sort?: string
  }): Promise<unknown> {
    try {
      return await this.sendOperation({ op: "getEventJsonLayouts", body })
    } catch (error) {
      debugError("Failed to fetch event JSON layouts:", error)
      throw error
    }
  }

  /**
   * Fetch observed values for a given JSON layout path. Mirrors the web app's
   * `AbsJSONValueSelect` autocomplete. Same `{columnNames, rows}` shape.
   */
  async getEventJsonValues(body: {
    event_type: "exposure" | "goal" | "attribute"
    path: string
    from?: number
    to?: number
    experiment_id?: number
    goal_id?: number
    take?: number
    skip?: number
    sort?: string
  }): Promise<unknown> {
    try {
      return await this.sendOperation({ op: "getEventJsonValues", body })
    } catch (error) {
      debugError("Failed to fetch event JSON values:", error)
      throw error
    }
  }

  async captureVisibleTab(): Promise<string> {
    const res = await chrome.runtime.sendMessage({
      type: "ABSMARTLY_CAPTURE_VISIBLE_TAB"
    })
    if (!res?.ok || !res.dataUrl) {
      throw new Error(res?.error || "Failed to capture visible tab")
    }
    return res.dataUrl
  }

  /**
   * Upload a file (e.g. an image dropped into a custom field's rich-text
   * editor) through the ABsmartly file_uploads API. The web app uses the
   * same `/v1/file_uploads/{usage}` endpoint so URLs round-trip when the
   * same experiment is opened in the main UI.
   *
   * `usage` defaults to `"attachments"` for inline rich-text images, matching
   * the web app's RichTextEditor convention.
   */
  async uploadFile(
    file: File,
    usage: string = "attachments"
  ): Promise<{
    file?: { url?: string; [key: string]: unknown }
    url?: string
    [key: string]: unknown
  }> {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    const result = await chrome.runtime.sendMessage({
      type: "ABSMARTLY_UPLOAD_FILE",
      usage,
      filename: file.name,
      mimeType: file.type,
      base64
    })
    if (!result?.ok) {
      throw new Error(result?.error || "Upload failed")
    }
    return result.data || {}
  }

  async resizeSidebar(mode: "fullscreen" | "restore"): Promise<void> {
    const res = await chrome.runtime.sendMessage({
      type: "ABSMARTLY_SIDEBAR_RESIZE",
      mode
    })
    if (!res?.ok) {
      throw new Error(res?.error || "Failed to resize sidebar")
    }
  }
}

/**
 * Encode an ArrayBuffer as a base64 string. Used by `uploadFile` to ship file
 * bytes across the chrome.runtime.sendMessage boundary (which doesn't support
 * `File`/`Blob`/`FormData`). Process in 8KB chunks so we don't blow the
 * argument-limit on large images.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

/**
 * Defensive unwrap for list-shaped API responses. The web app, CLI, and
 * direct REST surface each pick a slightly different envelope key for the
 * same payload (`metricUsages` vs `metric_usages` vs `metrics`), so callers
 * pass the candidate keys in priority order and we return the first match.
 * If the value is already an array we hand it back unchanged.
 */
function unwrapListResponse(raw: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") {
    for (const key of keys) {
      const value = (raw as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value
    }
  }
  return null
}
