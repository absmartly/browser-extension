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

  describe('JS diagnostic badges', () => {
    const jsChange: DOMChange = {
      selector: '.hero',
      type: 'javascript',
      value: 'element.textContent = "x"'
    }
    const experimentName = 'exp_1'
    const getChangeKey = (name: string | undefined, selector: string) =>
      `${name || '__preview__'}::${selector}`

    it('renders a CSP badge for a javascript change with reason=csp', () => {
      render(
        <DOMChangeList
          changes={[jsChange]}
          experimentName={experimentName}
          getChangeKey={getChangeKey}
          changeDiagnostics={{
            [getChangeKey(experimentName, '.hero')]: {
              reason: 'csp',
              message: 'Refused to evaluate',
              timestamp: 't'
            }
          }}
          {...defaultProps}
        />
      )
      expect(screen.getByText('Blocked by page CSP')).toBeInTheDocument()
      expect(screen.getByText('Refused to evaluate')).toBeInTheDocument()
    })

    it('renders a runtime badge for a javascript change with reason=runtime', () => {
      render(
        <DOMChangeList
          changes={[jsChange]}
          experimentName={experimentName}
          getChangeKey={getChangeKey}
          changeDiagnostics={{
            [getChangeKey(experimentName, '.hero')]: {
              reason: 'runtime',
              message: 'TypeError: x is not a function',
              timestamp: 't'
            }
          }}
          {...defaultProps}
        />
      )
      expect(screen.getByText('JavaScript runtime error')).toBeInTheDocument()
      expect(screen.getByText('TypeError: x is not a function')).toBeInTheDocument()
    })

    it('renders a pending badge with status role for a javascript change with reason=pending', () => {
      render(
        <DOMChangeList
          changes={[jsChange]}
          experimentName={experimentName}
          getChangeKey={getChangeKey}
          changeDiagnostics={{
            [getChangeKey(experimentName, '.hero')]: {
              reason: 'pending',
              message: 'Waiting for selector to appear on the page',
              timestamp: 't'
            }
          }}
          {...defaultProps}
        />
      )
      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('Waiting for selector')
    })

    it('does not render a diagnostic badge for non-javascript change types', () => {
      const textChange: DOMChange = { selector: '.hero', type: 'text', value: 'hi' }
      render(
        <DOMChangeList
          changes={[textChange]}
          experimentName={experimentName}
          getChangeKey={getChangeKey}
          changeDiagnostics={{
            [getChangeKey(experimentName, '.hero')]: {
              reason: 'csp',
              message: 'should be ignored for text changes',
              timestamp: 't'
            }
          }}
          {...defaultProps}
        />
      )
      expect(screen.queryByText('Blocked by page CSP')).not.toBeInTheDocument()
      expect(screen.queryByText('should be ignored for text changes')).not.toBeInTheDocument()
    })

    it('does not render a badge when no diagnostic exists for the change selector', () => {
      render(
        <DOMChangeList
          changes={[jsChange]}
          experimentName={experimentName}
          getChangeKey={getChangeKey}
          changeDiagnostics={{
            [getChangeKey(experimentName, '.other')]: {
              reason: 'csp',
              message: 'different selector',
              timestamp: 't'
            }
          }}
          {...defaultProps}
        />
      )
      expect(screen.queryByText('Blocked by page CSP')).not.toBeInTheDocument()
    })
  })
})
