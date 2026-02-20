import { clearExperimentLocalStorage, clearAllExperimentStorage } from '../storage-cleanup'

// Mock the Storage class
jest.mock('@plasmohq/storage', () => {
  const mockRemove = jest.fn().mockResolvedValue(undefined)
  return {
    Storage: jest.fn(() => ({
      remove: mockRemove
    }))
  }
})

describe('storage-cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('clearExperimentLocalStorage', () => {
    it('should use experiment-new-variants key when experimentId is 0', async () => {
      await clearExperimentLocalStorage(0)

      const { Storage } = require('@plasmohq/storage')
      const instance = new Storage()
      expect(instance.remove).toHaveBeenCalledWith('experiment-new-variants')
    })

    it('should use experiment-{id}-variants key for regular experiments', async () => {
      await clearExperimentLocalStorage(123)

      const { Storage } = require('@plasmohq/storage')
      const instance = new Storage()
      expect(instance.remove).toHaveBeenCalledWith('experiment-123-variants')
    })

    it('should handle large experiment IDs', async () => {
      await clearExperimentLocalStorage(999999)

      const { Storage } = require('@plasmohq/storage')
      const instance = new Storage()
      expect(instance.remove).toHaveBeenCalledWith('experiment-999999-variants')
    })
  })

  describe('clearAllExperimentStorage', () => {
    it('should clear both session and local storage for new experiments', async () => {
      await clearAllExperimentStorage(0)

      const { Storage } = require('@plasmohq/storage')
      const instance = new Storage()

      const calls = instance.remove.mock.calls.map((call: any[]) => call[0])
      expect(calls).toContain('domChangesInlineState')
      expect(calls).toContain('elementPickerResult')
      expect(calls).toContain('dragDropResult')
      expect(calls).toContain('visualEditorChanges')
      expect(calls).toContain('visualEditorState')
      expect(calls).toContain('experiment-new-variants')
    })

    it('should clear both session and local storage for real experiments', async () => {
      await clearAllExperimentStorage(456)

      const { Storage } = require('@plasmohq/storage')
      const instance = new Storage()

      const calls = instance.remove.mock.calls.map((call: any[]) => call[0])
      expect(calls).toContain('domChangesInlineState')
      expect(calls).toContain('elementPickerResult')
      expect(calls).toContain('dragDropResult')
      expect(calls).toContain('visualEditorChanges')
      expect(calls).toContain('visualEditorState')
      expect(calls).toContain('experiment-456-variants')
    })
  })
})
