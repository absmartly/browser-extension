import type {
  Experiment,
  ABsmartlyConfig,
  Application,
  UnitType,
  Metric,
  ExperimentTag,
  ExperimentUser,
  ExperimentTeam,
  Environment,
  ExperimentCustomSectionField
} from '~src/types/absmartly'
import type { APIOperation } from '~background/core/api-operations'
import { APIError } from '~src/types/errors'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

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

export class BackgroundAPIClient {
  private async sendOperation(operation: APIOperation): Promise<unknown> {
    debugLog('BackgroundAPIClient.sendOperation:', operation)

    const response = await chrome.runtime.sendMessage({
      type: 'API_OPERATION',
      operation
    })

    if (!response) {
      throw new APIError(
        'Background service worker did not respond. The extension may need to be reloaded.',
        false
      )
    }

    debugLog('BackgroundAPIClient operation response:', response)
    if (!response.success) {
      throw new APIError(
        response.error || 'API operation failed',
        response.isAuthError || false
      )
    }
    return response.data
  }

  async makeRequest(method: string, path: string, data?: unknown): Promise<unknown> {
    debugLog('BackgroundAPIClient.makeRequest:', { method, path, data })

    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method,
      path,
      data
    })

    if (!response) {
      throw new APIError(
        'Background service worker did not respond. The extension may need to be reloaded.',
        false
      )
    }

    debugLog('BackgroundAPIClient response:', response)
    if (!response.success) {
      throw new APIError(
        response.error || 'API request failed',
        response.isAuthError || false
      )
    }
    return response.data
  }

  async openLogin(): Promise<{ authenticated?: boolean }> {
    const response = await chrome.runtime.sendMessage({
      type: 'OPEN_LOGIN'
    })
    return response || {}
  }

  async getExperiments(params?: ExperimentParams): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> {
    try {
      debugLog('getExperiments called with params:', params)

      // Use generic request to get full paginated response
      const rawData = await this.makeRequest('GET', '/experiments', params) as Record<string, unknown>

      const experimentsData = rawData.experiments || rawData.data || rawData
      const experiments = Array.isArray(experimentsData) ? experimentsData as Experiment[] : []
      const total = typeof rawData.total === 'number' ? rawData.total :
                   typeof rawData.totalCount === 'number' ? rawData.totalCount :
                   typeof rawData.count === 'number' ? rawData.count : undefined
      const hasMore = rawData.has_more === true || rawData.hasMore === true ||
                     (params?.page !== undefined && experiments.length === params.items)

      return {
        experiments,
        total,
        hasMore
      }
    } catch (error) {
      debugError('Failed to fetch experiments:', error)
      throw error
    }
  }

  async getExperiment(id: number): Promise<Experiment> {
    try {
      return await this.sendOperation({
        op: 'getExperiment',
        id
      }) as Experiment
    } catch (error) {
      debugError(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }

  async createExperiment(data: CreateExperimentData): Promise<Experiment> {
    try {
      debugLog('[createExperiment] Request data:', JSON.stringify(data, null, 2))
      const response = await this.sendOperation({
        op: 'createExperiment',
        data
      })
      debugLog('[createExperiment] Full response:', JSON.stringify(response, null, 2))
      return response as Experiment
    } catch (error) {
      debugError('Failed to create experiment:', error)
      throw error
    }
  }

  async updateExperiment(id: number, data: UpdateExperimentData): Promise<Experiment> {
    try {
      return await this.sendOperation({
        op: 'updateExperiment',
        id,
        data
      }) as Experiment
    } catch (error) {
      debugError(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }

  async startExperiment(id: number): Promise<Experiment> {
    try {
      return await this.sendOperation({
        op: 'startExperiment',
        id
      }) as Experiment
    } catch (error) {
      debugError(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }

  async stopExperiment(id: number): Promise<Experiment> {
    try {
      return await this.sendOperation({
        op: 'stopExperiment',
        id
      }) as Experiment
    } catch (error) {
      debugError(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }

  async getApplications(): Promise<Application[]> {
    try {
      const apps = await this.sendOperation({ op: 'listApplications' })
      if (!Array.isArray(apps)) {
        debugWarn('[BackgroundAPIClient] listApplications returned non-array:', typeof apps)
        return []
      }
      return apps as Application[]
    } catch (error) {
      debugError('Failed to fetch applications:', error)
      throw error
    }
  }

  async getUnitTypes(): Promise<UnitType[]> {
    try {
      const unitTypes = await this.sendOperation({ op: 'listUnitTypes' })
      if (!Array.isArray(unitTypes)) {
        debugWarn('[BackgroundAPIClient] listUnitTypes returned non-array:', typeof unitTypes)
        return []
      }
      return unitTypes as UnitType[]
    } catch (error) {
      debugError('Failed to fetch unit types:', error)
      throw error
    }
  }

  async getMetrics(): Promise<Metric[]> {
    try {
      const metrics = await this.sendOperation({ op: 'listMetrics' })
      if (!Array.isArray(metrics)) {
        debugWarn('[BackgroundAPIClient] listMetrics returned non-array:', typeof metrics)
        return []
      }
      return metrics as Metric[]
    } catch (error) {
      debugError('Failed to fetch metrics:', error)
      throw error
    }
  }

  async getExperimentTags(): Promise<ExperimentTag[]> {
    try {
      const tags = await this.sendOperation({ op: 'listExperimentTags' })
      if (!Array.isArray(tags)) {
        debugWarn('[BackgroundAPIClient] listExperimentTags returned non-array:', typeof tags)
        return []
      }
      return tags as ExperimentTag[]
    } catch (error) {
      debugError('Failed to fetch experiment tags:', error)
      throw error
    }
  }

  async getOwners(): Promise<ExperimentUser[]> {
    try {
      const users = await this.sendOperation({ op: 'listUsers' })
      if (!Array.isArray(users)) {
        debugWarn('[BackgroundAPIClient] listUsers returned non-array:', typeof users)
        return []
      }
      return users as ExperimentUser[]
    } catch (error) {
      debugError('Failed to fetch owners:', error)
      throw error
    }
  }

  async getTeams(): Promise<ExperimentTeam[]> {
    try {
      const teams = await this.sendOperation({ op: 'listTeams' })
      if (!Array.isArray(teams)) {
        debugWarn('[BackgroundAPIClient] listTeams returned non-array:', typeof teams)
        return []
      }
      return teams as ExperimentTeam[]
    } catch (error) {
      debugError('Failed to fetch teams:', error)
      throw error
    }
  }

  async getFavorites(): Promise<number[]> {
    try {
      // favorites list not yet in CLI core, use generic request
      const data = await this.makeRequest('GET', '/favorites') as Record<string, unknown>
      const experiments = data?.experiments
      return Array.isArray(experiments) ? experiments as number[] : []
    } catch (error) {
      debugError('Failed to fetch favorites:', error)
      throw error
    }
  }

  async setExperimentFavorite(id: number, favorite: boolean): Promise<void> {
    try {
      await this.sendOperation({
        op: 'favoriteExperiment',
        id,
        favorite
      })
    } catch (error) {
      debugError(`Failed to ${favorite ? 'add' : 'remove'} favorite for experiment ${id}:`, error)
      throw error
    }
  }

  async getEnvironments(): Promise<Environment[]> {
    try {
      const environments = await this.sendOperation({ op: 'listEnvironments' })
      if (!Array.isArray(environments)) {
        debugWarn('[BackgroundAPIClient] listEnvironments returned non-array:', typeof environments)
        return []
      }
      return environments as Environment[]
    } catch (error) {
      debugError('Failed to fetch environments:', error)
      throw error
    }
  }

  async getTemplates(type: 'test_template' | 'feature_template' | 'test_template,feature_template' = 'test_template'): Promise<Experiment[]> {
    try {
      const experiments = await this.sendOperation({
        op: 'listExperiments',
        params: { type }
      }) as Experiment[]
      return Array.isArray(experiments) ? experiments : []
    } catch (error) {
      debugError('Failed to fetch templates:', error)
      throw error
    }
  }

  async getCustomSectionFields(): Promise<ExperimentCustomSectionField[]> {
    try {
      const fields = await this.sendOperation({ op: 'listCustomSectionFields' })
      if (!Array.isArray(fields)) {
        debugWarn('[BackgroundAPIClient] listCustomSectionFields returned non-array:', typeof fields)
        return []
      }
      return fields as ExperimentCustomSectionField[]
    } catch (error) {
      debugError('Failed to fetch custom section fields:', error)
      throw error
    }
  }
}
