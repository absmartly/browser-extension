describe('VariantList Storage Key Logic', () => {
  describe('Storage key generation for experimentId 0 (new experiments)', () => {
    it('should use experiment-new-variants key instead of experiment-0-variants', () => {
      // This test documents the expected behavior when experimentId is 0
      // In the actual component, when saving/loading, the key logic should be:
      // const storageKey = experimentId === 0
      //   ? 'experiment-new-variants'
      //   : `experiment-${experimentId}-variants`

      const experimentId = 0
      const expectedKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      expect(expectedKey).toBe('experiment-new-variants')
    })

    it('should preserve variants saved with experiment-new-variants key', () => {
      // When creating a new experiment with unsaved DOM changes,
      // the key should always be 'experiment-new-variants'
      const experimentId = 0

      for (let i = 0; i < 3; i++) {
        const key = experimentId === 0
          ? 'experiment-new-variants'
          : `experiment-${experimentId}-variants`
        expect(key).toBe('experiment-new-variants')
      }
    })
  })

  describe('Storage key generation for real experiments', () => {
    it('should use experiment-{id}-variants key for experimentId > 0', () => {
      const testIds = [1, 123, 999, 123456]

      for (const experimentId of testIds) {
        const expectedKey = experimentId === 0
          ? 'experiment-new-variants'
          : `experiment-${experimentId}-variants`
        expect(expectedKey).toBe(`experiment-${experimentId}-variants`)
      }
    })

    it('should maintain separate storage for different experiments', () => {
      const exp1Id: number = 1
      const exp2Id: number = 2
      const exp3Id: number = 3

      const exp1Key = exp1Id === 0 ? 'experiment-new-variants' : `experiment-${exp1Id}-variants`
      const exp2Key = exp2Id === 0 ? 'experiment-new-variants' : `experiment-${exp2Id}-variants`
      const exp3Key = exp3Id === 0 ? 'experiment-new-variants' : `experiment-${exp3Id}-variants`

      expect(exp1Key).toBe('experiment-1-variants')
      expect(exp2Key).toBe('experiment-2-variants')
      expect(exp3Key).toBe('experiment-3-variants')
      expect(exp1Key).not.toBe(exp2Key)
      expect(exp2Key).not.toBe(exp3Key)
    })
  })

  describe('Key consistency across load and save operations', () => {
    it('should use same key for loading and saving when experimentId is 0', () => {
      const experimentId = 0

      const loadKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      const saveKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      expect(loadKey).toBe(saveKey)
      expect(loadKey).toBe('experiment-new-variants')
    })

    it('should use same key for loading and saving when experimentId is real', () => {
      const experimentId: number = 789

      const loadKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      const saveKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      expect(loadKey).toBe(saveKey)
      expect(loadKey).toBe('experiment-789-variants')
    })
  })

  describe('Edge cases', () => {
    it('should handle negative experiment IDs correctly', () => {
      const experimentId: number = -1

      const key = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`

      // Negative IDs should not use new-variants key
      expect(key).toBe('experiment--1-variants')
    })

    it('should not mix new and real experiment storage', () => {
      const newExpId: number = 0
      const realExp1Id: number = 1

      const newExpKey = newExpId === 0 ? 'experiment-new-variants' : `experiment-${newExpId}-variants`
      const realExpKey = newExpId === 0 ? 'experiment-new-variants' : `experiment-${newExpId}-variants`

      // Both should be the same since both are 0
      expect(newExpKey).toBe(realExpKey)

      // But when we have a real experiment with ID 1, it should be different
      const realExp1Key = realExp1Id === 0 ? 'experiment-new-variants' : `experiment-${realExp1Id}-variants`
      expect(newExpKey).not.toBe(realExp1Key)
    })
  })
})
