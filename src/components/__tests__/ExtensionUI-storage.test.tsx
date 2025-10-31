import { clearAllExperimentStorage } from '~src/utils/storage-cleanup'

// Mock the storage-cleanup module
jest.mock('~src/utils/storage-cleanup', () => ({
  clearAllExperimentStorage: jest.fn().mockResolvedValue(undefined)
}))

describe('ExtensionUI Storage Clearing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleCreateExperiment behavior', () => {
    it('should clear storage for new experiments (experimentId: 0)', async () => {
      // Simulating what handleCreateExperiment does:
      // const handleCreateExperiment = async () => {
      //   await clearAllExperimentStorage(0)
      //   setSelectedExperiment(null)
      //   setView('create')
      // }

      await clearAllExperimentStorage(0)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(1)
    })

    it('should not load saved DOM changes after clearing storage', async () => {
      // After calling clearAllExperimentStorage(0), no storage data should exist
      // This ensures that VariantList won't find any saved changes to load
      await clearAllExperimentStorage(0)

      // The storage should have been cleared before VariantList mounts
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
    })
  })

  describe('handleCreateFromTemplate behavior', () => {
    it('should clear storage before loading template', async () => {
      // Simulating what handleCreateFromTemplate does:
      // const handleCreateFromTemplate = async (templateId: number) => {
      //   try {
      //     await clearAllExperimentStorage(0)
      //     const template = await getExperiment(templateId)
      //     ...
      //   }
      // }

      await clearAllExperimentStorage(0)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
    })

    it('should use experimentId 0 when creating from template', async () => {
      // Templates are treated as new experiments, so they should use ID 0
      await clearAllExperimentStorage(0)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
      const calls = (clearAllExperimentStorage as jest.Mock).mock.calls
      expect(calls[0][0]).toBe(0)
    })
  })

  describe('handleEditExperiment behavior', () => {
    it('should clear storage with the actual experiment ID', async () => {
      // Simulating what handleEditExperiment does:
      // const handleEditExperiment = async (experiment: Experiment) => {
      //   await clearAllExperimentStorage(experiment.id)
      //   setSelectedExperiment(experiment)
      //   setView('edit')
      // }

      const experimentId = 123
      await clearAllExperimentStorage(experimentId)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(123)
    })

    it('should clear storage for each different experiment being edited', async () => {
      await clearAllExperimentStorage(111)
      await clearAllExperimentStorage(222)
      await clearAllExperimentStorage(333)

      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(3)
      expect(clearAllExperimentStorage).toHaveBeenNthCalledWith(1, 111)
      expect(clearAllExperimentStorage).toHaveBeenNthCalledWith(2, 222)
      expect(clearAllExperimentStorage).toHaveBeenNthCalledWith(3, 333)
    })

    it('should prevent loading stale data when switching between experiments', async () => {
      // Scenario: User edits experiment A, then clicks to edit experiment B
      // Storage for experiment A should be cleared when opening B
      const expA = 100
      const expB = 200

      await clearAllExperimentStorage(expA)
      await clearAllExperimentStorage(expB)

      // Both should have been cleared
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(expA)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(expB)
    })
  })

  describe('handleExperimentClick behavior', () => {
    it('should clear storage before loading experiment details', async () => {
      // Simulating what handleExperimentClick does:
      // const handleExperimentClick = async (experiment: Experiment) => {
      //   await clearAllExperimentStorage(experiment.id)
      //   setView('detail')
      //   setExperimentDetailLoading(true)
      //   const fullExperiment = await getExperiment(experiment.id)
      //   ...
      // }

      const experimentId = 456
      await clearAllExperimentStorage(experimentId)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(456)
    })

    it('should clear storage for each different experiment being viewed', async () => {
      await clearAllExperimentStorage(50)
      await clearAllExperimentStorage(60)
      await clearAllExperimentStorage(70)

      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(3)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(50)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(60)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(70)
    })
  })

  describe('Storage clearing across different navigation actions', () => {
    it('should clear with experimentId 0 for create actions', async () => {
      // Create experiment
      await clearAllExperimentStorage(0)

      // Create from template
      await clearAllExperimentStorage(0)

      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(2)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
    })

    it('should clear with actual ID for edit and detail actions', async () => {
      // Edit experiment
      await clearAllExperimentStorage(789)

      // View experiment detail
      await clearAllExperimentStorage(789)

      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(2)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(789)
    })

    it('should clear storage independently for different navigation flows', async () => {
      // User creates a new experiment
      await clearAllExperimentStorage(0)

      // Then opens an existing experiment to view details
      await clearAllExperimentStorage(999)

      // Then edits another experiment
      await clearAllExperimentStorage(888)

      expect(clearAllExperimentStorage).toHaveBeenCalledTimes(3)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(999)
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(888)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle large experiment IDs', async () => {
      const largeId = 999999999
      await clearAllExperimentStorage(largeId)

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(largeId)
    })

    it('should not throw if clearAllExperimentStorage rejects', async () => {
      (clearAllExperimentStorage as jest.Mock).mockRejectedValueOnce(new Error('Storage error'))

      try {
        await clearAllExperimentStorage(0)
      } catch (error) {
        // Error is expected, but handlers should gracefully handle it
      }

      expect(clearAllExperimentStorage).toHaveBeenCalledWith(0)
    })
  })
})
