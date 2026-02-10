import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DOMChangeList } from '../dom-editor/DOMChangeList'
import type { DOMChange } from '~src/types/dom-changes'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

const defaultProps = {
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onToggle: jest.fn(),
  onReorder: jest.fn(),
  editingIndex: null
}

describe('DOMChangeList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render without error when changes is empty', () => {
    const { container } = render(
      <DOMChangeList changes={[]} {...defaultProps} />
    )
    expect(container).toBeTruthy()
  })

  it('should render without error when changes has items', () => {
    const changes: DOMChange[] = [
      { selector: '.test', type: 'text', value: 'Hello' }
    ]
    const { container } = render(
      <DOMChangeList changes={changes} {...defaultProps} />
    )
    expect(container).toBeTruthy()
  })

  it('should not throw hooks order error when transitioning from empty to non-empty changes', () => {
    const { rerender } = render(
      <DOMChangeList changes={[]} {...defaultProps} />
    )

    const changes: DOMChange[] = [
      { selector: '.test', type: 'text', value: 'Hello' }
    ]

    expect(() => {
      rerender(<DOMChangeList changes={changes} {...defaultProps} />)
    }).not.toThrow()
  })

  it('should not throw hooks order error when transitioning from non-empty to empty changes', () => {
    const changes: DOMChange[] = [
      { selector: '.test', type: 'text', value: 'Hello' }
    ]

    const { rerender } = render(
      <DOMChangeList changes={changes} {...defaultProps} />
    )

    expect(() => {
      rerender(<DOMChangeList changes={[]} {...defaultProps} />)
    }).not.toThrow()
  })

  it('should not throw hooks order error across multiple transitions', () => {
    const changes: DOMChange[] = [
      { selector: '.test', type: 'text', value: 'Hello' }
    ]

    const { rerender } = render(
      <DOMChangeList changes={[]} {...defaultProps} />
    )

    expect(() => {
      rerender(<DOMChangeList changes={changes} {...defaultProps} />)
      rerender(<DOMChangeList changes={[]} {...defaultProps} />)
      rerender(<DOMChangeList changes={changes} {...defaultProps} />)
      rerender(<DOMChangeList changes={[]} {...defaultProps} />)
    }).not.toThrow()
  })

  it('should show empty state message when changes is empty', () => {
    render(<DOMChangeList changes={[]} {...defaultProps} />)
    expect(screen.getByText('No DOM changes configured')).toBeInTheDocument()
  })

  it('should not show empty state message when changes has items', () => {
    const changes: DOMChange[] = [
      { selector: '.test', type: 'text', value: 'Hello' }
    ]
    render(<DOMChangeList changes={changes} {...defaultProps} />)
    expect(screen.queryByText('No DOM changes configured')).not.toBeInTheDocument()
  })
})
