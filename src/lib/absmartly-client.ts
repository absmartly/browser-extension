import axios, { type AxiosInstance } from 'axios'
import type { Experiment, ABsmartlyConfig } from '~src/types/absmartly'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

export class ABsmartlyClient {
  private client: AxiosInstance
  private config: ABsmartlyConfig
  constructor(config: ABsmartlyConfig) {
    this.config = config
    
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    // Check auth method preference
    const useApiKey = config.authMethod === 'apikey' && config.apiKey
    
    // Only add Authorization header if using API key method and key is provided
    if (useApiKey) {
      // Determine auth header based on API key format
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      headers['Authorization'] = authHeader
    }
    
    this.client = axios.create({
      baseURL: config.apiEndpoint.endsWith('/v1') ? config.apiEndpoint : `${config.apiEndpoint}/v1`,
      headers,
      withCredentials: config.authMethod === 'jwt' // Use cookies for JWT auth
    })
  }
  async getExperiments(params?: any): Promise<Experiment[]> {
    try {
      const response = await this.client.get('/experiments', { params })
      return response.data.experiments || []
    } catch (error) {
      debugError('Failed to fetch experiments:', error)
      throw error
    }
  }

  async getExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.client.get(`/experiments/${id}`)
      return response.data
    } catch (error) {
      debugError(`Failed to fetch experiment ${id}:`, error)
      throw error
    }
  }

  async createExperiment(data: any): Promise<Experiment> {
    try {
      const response = await this.client.post('/experiments', data)
      return response.data
    } catch (error) {
      debugError('Failed to create experiment:', error)
      throw error
    }
  }

  async updateExperiment(id: number, data: any): Promise<Experiment> {
    try {
      const response = await this.client.put(`/experiments/${id}`, data)
      return response.data
    } catch (error) {
      debugError(`Failed to update experiment ${id}:`, error)
      throw error
    }
  }

  async startExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.client.put(`/experiments/${id}/start`)
      return response.data
    } catch (error) {
      debugError(`Failed to start experiment ${id}:`, error)
      throw error
    }
  }

  async stopExperiment(id: number): Promise<Experiment> {
    try {
      const response = await this.client.put(`/experiments/${id}/stop`)
      return response.data
    } catch (error) {
      debugError(`Failed to stop experiment ${id}:`, error)
      throw error
    }
  }

  async getApplications(): Promise<any[]> {
    try {
      const response = await this.client.get('/applications')
      return response.data.applications || []
    } catch (error) {
      debugError('Failed to fetch applications:', error)
      throw error
    }
  }

  async getUnitTypes(): Promise<any[]> {
    try {
      const response = await this.client.get('/unit_types')
      return response.data.unit_types || []
    } catch (error) {
      debugError('Failed to fetch unit types:', error)
      throw error
    }
  }

  async getMetrics(): Promise<any[]> {
    try {
      const response = await this.client.get('/metrics')
      return response.data.metrics || []
    } catch (error) {
      debugError('Failed to fetch metrics:', error)
      throw error
    }
  }

  async getExperimentTags(): Promise<any[]> {
    try {
      const response = await this.client.get('/experiment_tags')
      return response.data.experiment_tags || []
    } catch (error) {
      debugError('Failed to fetch experiment tags:', error)
      throw error
    }
  }

  async getFavorites(): Promise<number[]> {
    try {
      const response = await this.client.get('/favorites')
      return response.data?.experiments || []
    } catch (error) {
      debugError('Failed to fetch favorites:', error)
      throw error
    }
  }
  async setExperimentFavorite(id: number, favorite: boolean): Promise<void> {
    try {
      await this.client.put(`/favorites/experiment?id=${id}&favorite=${favorite}`)
    } catch (error) {
      debugError(`Failed to ${favorite ? 'add' : 'remove'} favorite for experiment ${id}:`, error)
      throw error
    }
  }

  async getEnvironments(): Promise<any[]> {
    try {
      const response = await this.client.get('/environments')
      return response.data?.environments || []
    } catch (error) {
      debugError('Failed to fetch environments:', error)
      throw error
    }
  }
}
