import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { JsPreviewWarnings } from '../JsPreviewWarnings'
import type { JsPagePspWarning } from '~src/hooks/useJsPreviewDiagnostics'

const makeWarning = (overrides: Partial<JsPagePspWarning> = {}): JsPagePspWarning => ({
  evalAllowed: true,
  inlineAllowed: true,
  jsBlocked: false,
  timestamp: '2026-04-21T00:00:00Z',
  ...overrides
})

describe('JsPreviewWarnings', () => {
  it('renders nothing when there are no javascript changes in the variant', () => {
    const { container } = render(
      <JsPreviewWarnings
        pageWarning={makeWarning({ jsBlocked: true })}
        hasJavascriptChanges={false}
        variantIndex={0}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when no CSP probe has reported yet', () => {
    const { container } = render(
      <JsPreviewWarnings
        pageWarning={null}
        hasJavascriptChanges={true}
        variantIndex={0}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on pages where both eval and inline are allowed', () => {
    const { container } = render(
      <JsPreviewWarnings
        pageWarning={makeWarning({ evalAllowed: true, inlineAllowed: true, jsBlocked: false })}
        hasJavascriptChanges={true}
        variantIndex={0}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the blocking alert when the page blocks both eval and inline scripts', () => {
    render(
      <JsPreviewWarnings
        pageWarning={makeWarning({
          evalAllowed: false,
          inlineAllowed: false,
          jsBlocked: true
        })}
        hasJavascriptChanges={true}
        variantIndex={2}
      />
    )
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('id', 'js-csp-warning-variant-2')
    expect(banner).toHaveTextContent('This page blocks dynamic JavaScript.')
    expect(banner).toHaveTextContent(/will not execute/i)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the softer fallback notice when eval is blocked but inline is still allowed', () => {
    render(
      <JsPreviewWarnings
        pageWarning={makeWarning({
          evalAllowed: false,
          inlineAllowed: true,
          jsBlocked: false
        })}
        hasJavascriptChanges={true}
        variantIndex={1}
      />
    )
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('id', 'js-csp-info-variant-1')
    expect(banner).toHaveTextContent(/inline/i)
    expect(banner).toHaveTextContent(/fallback/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
