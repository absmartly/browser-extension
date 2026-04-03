// Mock for @absmartly/cli/api-client
// Used in tests to avoid ESM/symlink resolution issues with the CLI package

class MockAPIClient {
  constructor(httpClient) {
    this.httpClient = httpClient
  }
  async listExperiments() { return [] }
  async getExperiment() { return {} }
  async createExperiment(data) { return data }
  async updateExperiment(id, data) { return data }
  async startExperiment() { return {} }
  async stopExperiment() { return {} }
  async listApplications() { return [] }
  async listUnitTypes() { return [] }
  async listMetrics() { return [] }
  async listExperimentTags() { return [] }
  async listUsers() { return [] }
  async listTeams() { return [] }
  async listEnvironments() { return [] }
  async listCustomSectionFields() { return [] }
  async getCurrentUser() { return {} }
  async favoriteExperiment() { return undefined }
}

function createAPIClient(httpClient) {
  return new MockAPIClient(httpClient)
}

function ExperimentId(id) {
  return id
}

class APIError extends Error {
  constructor(message, statusCode, response) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.response = response
  }
}

module.exports = {
  APIClient: MockAPIClient,
  createAPIClient,
  ExperimentId,
  APIError,
  // Types are erased at runtime, but export empty objects for any runtime references
  ListOptions: undefined,
  ListMetricsOptions: undefined,
}
