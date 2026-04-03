import { routeAPIOperation } from '../api-operations'
import type { APIOperation } from '../api-operations'

const mockClient = {
  listExperiments: jest.fn().mockResolvedValue([]),
  getExperiment: jest.fn().mockResolvedValue({}),
  createExperiment: jest.fn().mockResolvedValue({}),
  updateExperiment: jest.fn().mockResolvedValue({}),
  startExperiment: jest.fn().mockResolvedValue({}),
  stopExperiment: jest.fn().mockResolvedValue({}),
  listApplications: jest.fn().mockResolvedValue([]),
  listUnitTypes: jest.fn().mockResolvedValue([]),
  listMetrics: jest.fn().mockResolvedValue([]),
  listExperimentTags: jest.fn().mockResolvedValue([]),
  listUsers: jest.fn().mockResolvedValue([]),
  listTeams: jest.fn().mockResolvedValue([]),
  listEnvironments: jest.fn().mockResolvedValue([]),
  listCustomSectionFields: jest.fn().mockResolvedValue([]),
  getCurrentUser: jest.fn().mockResolvedValue({ id: 1 }),
  favoriteExperiment: jest.fn().mockResolvedValue(undefined),
}

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn(),
}))

describe('routeAPIOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should route listExperiments with params', async () => {
    const params = { state: 'running', items: 50 }
    await routeAPIOperation(mockClient as any, { op: 'listExperiments', params })

    expect(mockClient.listExperiments).toHaveBeenCalledWith(params)
  })

  it('should route getExperiment with id', async () => {
    await routeAPIOperation(mockClient as any, { op: 'getExperiment', id: 42 })

    expect(mockClient.getExperiment).toHaveBeenCalledWith(42)
  })

  it('should route createExperiment with data', async () => {
    const data = { name: 'Test' }
    await routeAPIOperation(mockClient as any, { op: 'createExperiment', data })

    expect(mockClient.createExperiment).toHaveBeenCalledWith(data)
  })

  it('should route updateExperiment with id and data', async () => {
    const data = { name: 'Updated' }
    await routeAPIOperation(mockClient as any, { op: 'updateExperiment', id: 1, data })

    expect(mockClient.updateExperiment).toHaveBeenCalledWith(1, data)
  })

  it('should route startExperiment with id', async () => {
    await routeAPIOperation(mockClient as any, { op: 'startExperiment', id: 5 })

    expect(mockClient.startExperiment).toHaveBeenCalledWith(5)
  })

  it('should route stopExperiment with reason', async () => {
    await routeAPIOperation(mockClient as any, { op: 'stopExperiment', id: 5, reason: 'winner found' })

    expect(mockClient.stopExperiment).toHaveBeenCalledWith(5, 'winner found')
  })

  it('should default stopExperiment reason to "stopped"', async () => {
    await routeAPIOperation(mockClient as any, { op: 'stopExperiment', id: 5 })

    expect(mockClient.stopExperiment).toHaveBeenCalledWith(5, 'stopped')
  })

  it('should route listApplications', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listApplications' })

    expect(mockClient.listApplications).toHaveBeenCalled()
  })

  it('should route listUnitTypes', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listUnitTypes' })

    expect(mockClient.listUnitTypes).toHaveBeenCalled()
  })

  it('should route listMetrics', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listMetrics' })

    expect(mockClient.listMetrics).toHaveBeenCalled()
  })

  it('should route listExperimentTags', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listExperimentTags' })

    expect(mockClient.listExperimentTags).toHaveBeenCalled()
  })

  it('should route listUsers', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listUsers' })

    expect(mockClient.listUsers).toHaveBeenCalled()
  })

  it('should route listTeams', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listTeams' })

    expect(mockClient.listTeams).toHaveBeenCalled()
  })

  it('should route listEnvironments', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listEnvironments' })

    expect(mockClient.listEnvironments).toHaveBeenCalled()
  })

  it('should route listCustomSectionFields', async () => {
    await routeAPIOperation(mockClient as any, { op: 'listCustomSectionFields' })

    expect(mockClient.listCustomSectionFields).toHaveBeenCalled()
  })

  it('should route getCurrentUser', async () => {
    await routeAPIOperation(mockClient as any, { op: 'getCurrentUser' })

    expect(mockClient.getCurrentUser).toHaveBeenCalled()
  })

  it('should route favoriteExperiment', async () => {
    await routeAPIOperation(mockClient as any, { op: 'favoriteExperiment', id: 10, favorite: true })

    expect(mockClient.favoriteExperiment).toHaveBeenCalledWith(10, true)
  })

  it('should throw on unknown operation', async () => {
    await expect(
      routeAPIOperation(mockClient as any, { op: 'unknownOp' } as any)
    ).rejects.toThrow('Unknown API operation: unknownOp')
  })
})
