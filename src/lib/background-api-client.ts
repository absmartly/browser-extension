import type { Experiment, ABsmartlyConfig } from '~src/types/absmartly'

/**
 * API client that communicates through the background service worker
 * to avoid CORS issues
 */
export class BackgroundAPIClient {
  async makeRequest(method: string, path: string, data?: any): Promise<any> {
    console.log('BackgroundAPIClient.makeRequest:', { method, path, data })
    
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method,
      path,
      data
    })
    
    console.log('BackgroundAPIClient response:', response)
    
    if (!response.success) {
      // Create an error with additional context
      const error = new Error(response.error || 'API request failed')
      ;(error as any).isAuthError = response.isAuthError
      throw error
    }
    
    return response.data
  }

  async openLogin(): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'OPEN_LOGIN'
    })
  }

  async getExperiments(params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> {
    try {
      const data = await this.makeRequest('GET', '/experiments', params)
      console.log('API response structure:', data)
      
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
      console.error('Failed to fetch experiments:', error)
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
      console.error(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }

  async createExperiment(data: any): Promise<Experiment> {
    try {
      return await this.makeRequest('POST', '/experiments', data)
    } catch (error) {
      console.error('Failed to create experiment:', error)
      throw error
    }
  }

  async updateExperiment(id: number, data: any): Promise<Experiment> {
    try {
      return await this.makeRequest('PUT', `/experiments/${id}`, data)
    } catch (error) {
      console.error(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }

  async startExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/start`)
      // Extract experiment if response is nested
      return response.experiment || response
    } catch (error) {
      console.error(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }

  async stopExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.makeRequest('PUT', `/experiments/${id}/stop`)
      // Extract experiment if response is nested
      return response.experiment || response
    } catch (error) {
      console.error(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }

  async getApplications(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/applications')
      return data.applications || []
    } catch (error) {
      console.error('Failed to fetch applications:', error)
      throw error
    }
  }

  async getUnitTypes(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/unit_types')
      return data.unit_types || []
    } catch (error) {
      console.error('Failed to fetch unit types:', error)
      throw error
    }
  }

  async getMetrics(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/metrics')
      return data.metrics || []
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      throw error
    }
  }

  async getExperimentTags(): Promise<any[]> {
    try {
      const data = await this.makeRequest('GET', '/experiment_tags')
      return data.experiment_tags || []
    } catch (error) {
      console.error('Failed to fetch experiment tags:', error)
      throw error
    }
  }
}