import type { Experiment, ABsmartlyConfig } from '~src/types/absmartly'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

/**
 * API client that communicates through the background service worker
 * to avoid CORS issues
 */
export class BackgroundAPIClient {
  async makeRequest(method: string, path: string, data?: any): Promise<any> {
    debugLog('BackgroundAPIClient.makeRequest:', { method, path, data })
    
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method,
      path,
      data
    })
    debugLog('BackgroundAPIClient response:', response)
    if (!response.success) {
      // Create an error with additional context
      const error = new Error(response.error || 'API request failed')
      ;(error as any).isAuthError = response.isAuthError
      throw error
    }
    return response.data
  }
  
  async openLogin(): Promise<{ authenticated?: boolean }> {
    const response = await chrome.runtime.sendMessage({
      type: 'OPEN_LOGIN'
    })
    return response || {}
  }
  
  async getExperiments(params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> {
    try {
      // Add stack trace to see where this call is coming from
      const stack = new Error().stack
      debugLog('=== getExperiments called from: ===')
      debugLog(stack?.split('\n').slice(2, 6).join('\n'))
      debugLog('=== params:', params)

      const data = await this.makeRequest('GET', '/experiments', params)
      debugLog('API response structure:', data)
      
      // Handle different possible response structures
      const experiments = data.experiments || data.data || data || []
      const total = data.total || data.totalCount || data.count
      const hasMore = data.has_more || data.hasMore || (params?.page && experiments.length === params.items)
      return {
        experiments: Array.isArray(experiments) ? experiments : [],
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
      const response = await this.makeRequest('GET', `/experiments/${id}`)
      // GET /experiments/:id returns {experiment: {...}, ...}
      // Extract just the experiment object
      return response.experiment || response
    } catch (error) {
      debugError(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }
  
  async createExperiment(data: any): Promise<Experiment> {
    try {
      console.log('[createExperiment] Request data:', JSON.stringify(data, null, 2))
      const response = await this.makeRequest('POST', '/experiments', data)
      console.log('[createExperiment] Full response:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      console.error('[createExperiment] Error:', error)
      debugError('Failed to create experiment:', error)
      throw error
    }
  }
  
  async updateExperiment(id: number, data: any): Promise<Experiment> {
    try {
      return await this.makeRequest('PUT', `/experiments/${id}`, data)
    } catch (error) {
      debugError(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }
  
  async startExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/start`)
      // Extract experiment if response is nested
      return response.experiment || response
    } catch (error) {
      debugError(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }
  
  async stopExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/stop`)
      return response.experiment || response
    } catch (error) {
      debugError(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }
  
  async getApplications(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/applications')
      return data.applications || []
    } catch (error) {
      debugError('Failed to fetch applications:', error)
      throw error
    }
  }
  
  async getUnitTypes(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/unit_types')
      // debugLog('Unit types API raw response:', JSON.stringify(data))
      
      // Check if data is an array directly
      if (Array.isArray(data)) {
        debugLog('Unit types is direct array, length:', data.length)
        return data
      }
      
      // Check for nested structures
      const unitTypes = data.unit_types || data.data || data.items || []
      debugLog('Extracted unit types, length:', unitTypes.length, 'first item:', unitTypes[0])
      return unitTypes
    } catch (error) {
      debugError('Failed to fetch unit types:', error)
      throw error
    }
  }
  
  async getMetrics(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/metrics')
      return data.metrics || []
    } catch (error) {
      debugError('Failed to fetch metrics:', error)
      throw error
    }
  }
  
  async getExperimentTags(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/experiment_tags')
      return data.experiment_tags || []
    } catch (error) {
      debugError('Failed to fetch experiment tags:', error)
      throw error
    }
  }

  async getOwners(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/users')
      return data.users || []
    } catch (error) {
      debugError('Failed to fetch owners:', error)
      throw error
    }
  }
  
  async getTeams(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/teams')
      return data.teams || []
    } catch (error) {
      debugError('Failed to fetch teams:', error)
      throw error
    }
  }
  
  async getFavorites(): Promise<number[]> {
    try {
      const data = await this.makeRequest('GET', '/favorites')
      return data?.experiments || []
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

  async getEnvironments(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/environments')
      return data?.environments || []
    } catch (error) {
      debugError('Failed to fetch environments:', error)
      throw error
    }
  }

  async getTemplates(type: 'test_template' | 'feature_template' | 'test_template,feature_template' = 'test_template'): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/experiments', { type })
      return data.experiments || []
    } catch (error) {
      debugError('Failed to fetch templates:', error)
      throw error
    }
  }

  async getCustomSectionFields(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/experiment_custom_section_fields', { items: 100 })
      return data.experiment_custom_section_fields || []
    } catch (error) {
      debugError('Failed to fetch custom section fields:', error)
      throw error
    }
  }
}