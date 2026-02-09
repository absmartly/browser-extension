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
import { APIError } from '~src/types/errors'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import {
  ExperimentSchema,
  ExperimentsResponseSchema,
  ApplicationsResponseSchema,
  UnitTypesResponseSchema,
  MetricsResponseSchema,
  ExperimentTagsResponseSchema
} from './api-schemas'

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
  async makeRequest(method: string, path: string, data?: unknown): Promise<unknown> {
    debugLog('BackgroundAPIClient.makeRequest:', { method, path, data })

    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method,
      path,
      data
    })
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

      const rawData = await this.makeRequest('GET', '/experiments', params)
      debugLog('API response structure:', rawData)

      const validation = ExperimentsResponseSchema.safeParse(rawData)
      if (!validation.success) {
        debugWarn('API response validation failed:', validation.error)
      }

      const data = rawData as Record<string, unknown>
      const experimentsData = data.experiments || data.data || data
      const experiments = Array.isArray(experimentsData) ? experimentsData as Experiment[] : []
      const total = typeof data.total === 'number' ? data.total :
                   typeof data.totalCount === 'number' ? data.totalCount :
                   typeof data.count === 'number' ? data.count : undefined
      const hasMore = data.has_more === true || data.hasMore === true ||
                     (params?.page && experiments.length === params.items)

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
      const rawResponse = await this.makeRequest('GET', `/experiments/${id}`)
      const experimentData = (rawResponse as any).experiment || rawResponse

      const validation = ExperimentSchema.safeParse(experimentData)
      if (!validation.success) {
        debugWarn(`Experiment ${id} validation failed:`, validation.error)
      }

      return experimentData as Experiment
    } catch (error) {
      debugError(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }

  async createExperiment(data: CreateExperimentData): Promise<Experiment> {
    try {
      debugLog('[createExperiment] Request data:', JSON.stringify(data, null, 2))
      const response = await this.makeRequest('POST', '/experiments', data)
      debugLog('[createExperiment] Full response:', JSON.stringify(response, null, 2))
      return response as Experiment
    } catch (error) {
      console.error('[createExperiment] Error:', error)
      debugError('Failed to create experiment:', error)
      throw error
    }
  }

  async updateExperiment(id: number, data: UpdateExperimentData): Promise<Experiment> {
    try {
      return await this.makeRequest('PUT', `/experiments/${id}`, data) as Experiment
    } catch (error) {
      debugError(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }

  async startExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/start`) as Record<string, unknown>
      return (response.experiment || response) as Experiment
    } catch (error) {
      debugError(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }

  async stopExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/stop`) as Record<string, unknown>
      return (response.experiment || response) as Experiment
    } catch (error) {
      debugError(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }

  async getApplications(): Promise<Application[]> {
    try {
      const data = await this.makeRequest('GET', '/applications') as Record<string, unknown>
      const apps = data.applications || []
      return Array.isArray(apps) ? apps as Application[] : []
    } catch (error) {
      debugError('Failed to fetch applications:', error)
      throw error
    }
  }

  async getUnitTypes(): Promise<UnitType[]> {
    try {
      const data = await this.makeRequest('GET', '/unit_types')

      if (Array.isArray(data)) {
        debugLog('Unit types is direct array, length:', data.length)
        return data as UnitType[]
      }

      const dataObj = data as Record<string, unknown>
      const unitTypesData = dataObj.unit_types || dataObj.data || dataObj.items || []
      const unitTypes = Array.isArray(unitTypesData) ? unitTypesData as UnitType[] : []
      debugLog('Extracted unit types, length:', unitTypes.length, 'first item:', unitTypes[0])
      return unitTypes
    } catch (error) {
      debugError('Failed to fetch unit types:', error)
      throw error
    }
  }

  async getMetrics(): Promise<Metric[]> {
    try {
      const data = await this.makeRequest('GET', '/metrics') as Record<string, unknown>
      const metrics = data.metrics || []
      return Array.isArray(metrics) ? metrics as Metric[] : []
    } catch (error) {
      debugError('Failed to fetch metrics:', error)
      throw error
    }
  }

  async getExperimentTags(): Promise<ExperimentTag[]> {
    try {
      const data = await this.makeRequest('GET', '/experiment_tags') as Record<string, unknown>
      const tags = data.experiment_tags || []
      return Array.isArray(tags) ? tags as ExperimentTag[] : []
    } catch (error) {
      debugError('Failed to fetch experiment tags:', error)
      throw error
    }
  }

  async getOwners(): Promise<ExperimentUser[]> {
    try {
      const data = await this.makeRequest('GET', '/users') as Record<string, unknown>
      const users = data.users || []
      return Array.isArray(users) ? users as ExperimentUser[] : []
    } catch (error) {
      debugError('Failed to fetch owners:', error)
      throw error
    }
  }

  async getTeams(): Promise<ExperimentTeam[]> {
    try {
      const data = await this.makeRequest('GET', '/teams') as Record<string, unknown>
      const teams = data.teams || []
      return Array.isArray(teams) ? teams as ExperimentTeam[] : []
    } catch (error) {
      debugError('Failed to fetch teams:', error)
      throw error
    }
  }

  async getFavorites(): Promise<number[]> {
    try {
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
      await this.makeRequest('PUT', `/favorites/experiment?id=${id}&favorite=${favorite}`)
    } catch (error) {
      debugError(`Failed to ${favorite ? 'add' : 'remove'} favorite for experiment ${id}:`, error)
      throw error
    }
  }

  async getEnvironments(): Promise<Environment[]> {
    try {
      const data = await this.makeRequest('GET', '/environments') as Record<string, unknown>
      const environments = data?.environments || []
      return Array.isArray(environments) ? environments as Environment[] : []
    } catch (error) {
      debugError('Failed to fetch environments:', error)
      throw error
    }
  }

  async getTemplates(type: 'test_template' | 'feature_template' | 'test_template,feature_template' = 'test_template'): Promise<Experiment[]> {
    try {
      const data = await this.makeRequest('GET', '/experiments', { type }) as Record<string, unknown>
      const experiments = data.experiments || []
      return Array.isArray(experiments) ? experiments as Experiment[] : []
    } catch (error) {
      debugError('Failed to fetch templates:', error)
      throw error
    }
  }

  async getCustomSectionFields(): Promise<ExperimentCustomSectionField[]> {
    try {
      const data = await this.makeRequest('GET', '/experiment_custom_section_fields', { items: 100 }) as Record<string, unknown>
      const fields = data.experiment_custom_section_fields || []
      return Array.isArray(fields) ? fields as ExperimentCustomSectionField[] : []
    } catch (error) {
      debugError('Failed to fetch custom section fields:', error)
      throw error
    }
  }
}
