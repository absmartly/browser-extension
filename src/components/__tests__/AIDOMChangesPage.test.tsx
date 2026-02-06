import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AIDOMChangesPage } from '../AIDOMChangesPage'
import type { DOMChange } from '~src/types/dom-changes'

// Mock the messaging module
jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

// Mock the storage module
jest.mock('~src/utils/storage', () => ({
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock the markdown module
jest.mock('~src/utils/markdown', () => ({
  renderMarkdown: jest.fn((md: string) => md)
}))

// Mock chrome storage
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

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

describe('AIDOMChangesPage - Preview Toggle', () => {
  const mockChanges: DOMChange[] = [
    {
      selector: '.test-button',
      type: 'style',
      value: { color: 'red' }
    }
  ]

  const defaultProps = {
    variantName: 'Test Variant',
    currentChanges: mockChanges,
    onBack: jest.fn(),
    onGenerate: jest.fn().mockResolvedValue({
      domChanges: mockChanges,
      response: 'Generated changes',
      action: 'append' as const
    }),
    onRestoreChanges: jest.fn(),
    onPreviewToggle: jest.fn(),
    onPreviewRefresh: jest.fn(),
    onPreviewWithChanges: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call onPreviewWithChanges when toggling preview ON', async () => {
    render(<AIDOMChangesPage {...defaultProps} />)

    const toggleButton = screen.getByRole('button', { name: /OFF/i })
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewWithChanges).toHaveBeenCalledWith(
        true,
        mockChanges
      )
    })
  })

  it('should call onPreviewToggle when toggling preview OFF', async () => {
    render(<AIDOMChangesPage {...defaultProps} />)

    // First toggle ON using the ID selector
    const toggleButton = document.querySelector('#vibe-studio-preview-toggle') as HTMLElement
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(toggleButton.textContent).toContain('ON')
    })

    // Then toggle OFF
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewToggle).toHaveBeenCalledWith(false)
    })
  })

  it('should reapply changes when toggling preview ON after being OFF', async () => {
    render(<AIDOMChangesPage {...defaultProps} />)

    const toggleButton = document.querySelector('#vibe-studio-preview-toggle') as HTMLElement

    // Toggle ON
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewWithChanges).toHaveBeenCalledWith(
        true,
        mockChanges
      )
    })

    jest.clearAllMocks()

    // Toggle OFF
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewToggle).toHaveBeenCalledWith(false)
    })

    jest.clearAllMocks()

    // Toggle ON again - this should reapply the changes
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewWithChanges).toHaveBeenCalledWith(
        true,
        mockChanges
      )
    })
  })

  it('should preserve changes after generating new ones and toggling', async () => {
    const newChanges: DOMChange[] = [
      {
        selector: '.new-element',
        type: 'text',
        value: 'New text'
      }
    ]

    const onGenerateMock = jest.fn().mockResolvedValue({
      domChanges: newChanges,
      response: 'Generated new changes',
      action: 'append' as const
    })

    render(
      <AIDOMChangesPage
        {...defaultProps}
        onGenerate={onGenerateMock}
      />
    )

    // Generate new changes
    const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
    fireEvent.change(textarea, { target: { value: 'Make it red' } })

    const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(onGenerateMock).toHaveBeenCalled()
    })

    // Wait for preview to be auto-enabled with new changes
    await waitFor(() => {
      expect(defaultProps.onPreviewWithChanges).toHaveBeenCalledWith(
        true,
        expect.arrayContaining([...mockChanges, ...newChanges])
      )
    })

    jest.clearAllMocks()

    const toggleButton = document.querySelector('#vibe-studio-preview-toggle') as HTMLElement

    // Toggle OFF
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewToggle).toHaveBeenCalledWith(false)
    })

    jest.clearAllMocks()

    // Toggle ON again - should reapply combined changes
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(defaultProps.onPreviewWithChanges).toHaveBeenCalledWith(
        true,
        expect.arrayContaining([...mockChanges, ...newChanges])
      )
    })
  })

  it('should update button text when toggling', async () => {
    render(<AIDOMChangesPage {...defaultProps} />)

    const toggleButton = document.querySelector('#vibe-studio-preview-toggle') as HTMLElement

    // Initially OFF
    expect(toggleButton.textContent).toContain('OFF')

    // Toggle ON
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(toggleButton.textContent).toContain('ON')
    })

    // Toggle OFF
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(toggleButton.textContent).toContain('OFF')
    })
  })
})
