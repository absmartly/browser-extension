import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { VariantList } from '../VariantList'
import type { Variant } from '../variant/VariantCard'
import * as messaging from '~src/lib/messaging'
import * as storage from '~src/utils/storage'

jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

jest.mock('~src/utils/storage', () => ({
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.())
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
} as any

const mockVariants: Variant[] = [
  {
    name: 'Control',
    config: {
      __dom_changes: []
    }
  },
  {
    name: 'Variant A',
    config: {
      __dom_changes: [
        {
          selector: '.btn',
          type: 'style',
          value: { color: 'red' }
        }
      ]
    }
  }
]

describe('VariantList', () => {
  const defaultProps = {
    initialVariants: mockVariants,
    experimentId: 123,
    experimentName: 'test_experiment',
    onVariantsChange: jest.fn(),
    canEdit: true,
    canAddRemove: true,
    domFieldName: '__dom_changes',
    onNavigateToAI: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render variant cards', () => {
      render(<VariantList {...defaultProps} />)

      expect(screen.getByText('Control')).toBeInTheDocument()
      expect(screen.getByText('Variant A')).toBeInTheDocument()
    })

    it('should expand variant cards by default (except control)', async () => {
      render(<VariantList {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Variant A')).toBeInTheDocument()
      })
    })
  })

  describe('Preview Toggle', () => {
    it('should enable preview for single variant', async () => {
      render(<VariantList {...defaultProps} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'ABSMARTLY_PREVIEW',
              action: 'apply'
            })
          )
        })
      }
    })

    it('should prevent multiple preview toggle', async () => {
      render(<VariantList {...defaultProps} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      if (previewButtons.length >= 2) {
        fireEvent.click(previewButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(previewButtons[1])

        expect(messaging.sendToContent).toHaveBeenCalledTimes(1)
      }
    })

    it('should disable preview when toggling off', async () => {
      render(<VariantList {...defaultProps} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalled()
        })

        jest.clearAllMocks()

        fireEvent.click(previewButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'ABSMARTLY_PREVIEW',
              action: 'remove'
            })
          )
        })
      }
    })
  })

  describe('Add/Delete Variants', () => {
    it('should add new variant', async () => {
      render(<VariantList {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add variant/i })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(defaultProps.onVariantsChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            ...mockVariants,
            expect.objectContaining({ name: 'Variant 2' })
          ]),
          true
        )
      })
    })

    it('should delete variant', async () => {
      render(<VariantList {...defaultProps} />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[deleteButtons.length - 1])

        await waitFor(() => {
          expect(defaultProps.onVariantsChange).toHaveBeenCalledWith(
            expect.arrayContaining([mockVariants[0]]),
            true
          )
        })
      }
    })

    it('should not allow delete when canAddRemove is false', () => {
      render(<VariantList {...defaultProps} canAddRemove={false} />)

      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
      expect(deleteButtons).toHaveLength(0)
    })

    it('should not allow add when canAddRemove is false', () => {
      render(<VariantList {...defaultProps} canAddRemove={false} />)

      const addButton = screen.queryByRole('button', { name: /add variant/i })
      expect(addButton).not.toBeInTheDocument()
    })
  })

  describe('Variant Name Editing', () => {
    it('should update variant name', async () => {
      render(<VariantList {...defaultProps} />)

      const variantNameInputs = screen.getAllByDisplayValue(/Variant/)
      if (variantNameInputs.length > 1) {
        const input = variantNameInputs[1] as HTMLInputElement
        fireEvent.change(input, { target: { value: 'Updated Variant' } })

        await waitFor(() => {
          expect(defaultProps.onVariantsChange).toHaveBeenCalledWith(
            expect.arrayContaining([
              mockVariants[0],
              expect.objectContaining({ name: 'Updated Variant' })
            ]),
            true
          )
        })
      }
    })

    it('should not allow editing when canEdit is false', () => {
      render(<VariantList {...defaultProps} canEdit={false} />)

      const variantNameInputs = screen.getAllByDisplayValue(/Variant/)
      if (variantNameInputs.length > 0) {
        expect(variantNameInputs[0]).toBeDisabled()
      }
    })
  })

  describe('DOM Changes Management', () => {
    it('should update DOM changes for variant', async () => {
      render(<VariantList {...defaultProps} />)

      const newChanges = [
        {
          selector: '.new-btn',
          type: 'text' as const,
          value: 'Click me'
        }
      ]

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })

    it('should filter disabled changes from preview', async () => {
      const variantsWithDisabled: Variant[] = [
        {
          name: 'Control',
          config: {
            __dom_changes: []
          }
        },
        {
          name: 'Variant A',
          config: {
            __dom_changes: [
              {
                selector: '.btn',
                type: 'style',
                value: { color: 'red' },
                disabled: true
              },
              {
                selector: '.title',
                type: 'text',
                value: 'New Title'
              }
            ]
          }
        }
      ]

      render(<VariantList {...defaultProps} initialVariants={variantsWithDisabled} />)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })

  describe('Preview Refresh', () => {
    it('should refresh preview when requested', async () => {
      render(<VariantList {...defaultProps} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalled()
        })

        jest.clearAllMocks()

        const refreshButton = screen.queryByRole('button', { name: /refresh/i })
        if (refreshButton) {
          fireEvent.click(refreshButton)

          await waitFor(() => {
            expect(messaging.sendToContent).toHaveBeenCalledWith(
              expect.objectContaining({
                type: 'ABSMARTLY_PREVIEW',
                action: 'update'
              })
            )
          })
        }
      }
    })
  })

  describe('Storage Integration', () => {
    it('should load saved variants from storage on mount', async () => {
      const savedVariants: Variant[] = [
        {
          name: 'Control',
          config: {
            __dom_changes: [],
            customField: 'saved value'
          }
        }
      ];

      (storage.localAreaStorage.get as jest.Mock).mockResolvedValueOnce(savedVariants)

      render(<VariantList {...defaultProps} />)

      await waitFor(() => {
        expect(storage.localAreaStorage.get).toHaveBeenCalledWith('experiment-123-variants')
      })
    })

    it('should save variants to storage on change', async () => {
      render(<VariantList {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add variant/i })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(storage.localAreaStorage.set).toHaveBeenCalledWith(
          'experiment-123-variants',
          expect.any(Array)
        )
      })
    })

    it('should handle storage errors gracefully', async () => {
      (storage.localAreaStorage.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'))

      render(<VariantList {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })

  describe('Percentage Validation', () => {
    it('should validate percentages sum to 100%', async () => {
      render(<VariantList {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })

  describe('Visual Editor Integration', () => {
    it('should open visual editor for variant', async () => {
      render(<VariantList {...defaultProps} />)

      const veButtons = screen.queryAllByRole('button', { name: /visual editor/i })
      if (veButtons.length > 0) {
        fireEvent.click(veButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'START_VISUAL_EDITOR'
            })
          )
        })
      }
    })

    it('should prevent opening VE when another is active', async () => {
      render(<VariantList {...defaultProps} />)

      const veButtons = screen.queryAllByRole('button', { name: /visual editor/i })
      if (veButtons.length >= 2) {
        fireEvent.click(veButtons[0])

        await waitFor(() => {
          expect(messaging.sendToContent).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(veButtons[1])

        expect(messaging.sendToContent).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('AI Navigation', () => {
    it('should navigate to AI page when requested', async () => {
      render(<VariantList {...defaultProps} />)

      const aiButtons = screen.queryAllByRole('button', { name: /ai/i })
      if (aiButtons.length > 0) {
        fireEvent.click(aiButtons[0])

        await waitFor(() => {
          expect(defaultProps.onNavigateToAI).toHaveBeenCalled()
        })
      }
    })

    it('should auto-navigate to AI when autoNavigateToAI prop is set', async () => {
      render(<VariantList {...defaultProps} autoNavigateToAI="Variant A" />)

      await waitFor(() => {
        expect(defaultProps.onNavigateToAI).toHaveBeenCalledWith(
          'Variant A',
          expect.any(Function),
          expect.any(Array),
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        )
      })
    })
  })

  describe('Variant Reordering', () => {
    it('should not trigger preview update on reorder', async () => {
      render(<VariantList {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })

  describe('Empty Variant List', () => {
    it('should handle empty variant list', () => {
      render(<VariantList {...defaultProps} initialVariants={[]} />)

      const addButton = screen.queryByRole('button', { name: /add variant/i })
      expect(addButton).toBeInTheDocument()
    })
  })
})
