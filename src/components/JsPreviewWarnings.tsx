import React from 'react'
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import type { JsPagePspWarning } from '~src/hooks/useJsPreviewDiagnostics'

interface JsPreviewWarningsProps {
  pageWarning: JsPagePspWarning | null
  hasJavascriptChanges: boolean
  variantIndex: number
}

/**
 * Page-wide banners that explain why `javascript` DOM-change previews
 * will silently fail on this host. Rendered above the per-change list
 * so the user learns about CSP before triggering any change.
 *
 * Visible only when the variant has at least one javascript change AND
 * a CSP probe result is present. Distinguishes the fully-blocked case
 * (red-ish amber, "won't execute anywhere") from the eval-only-blocked
 * case (soft amber, "fallback will be tried").
 */
export function JsPreviewWarnings({
  pageWarning,
  hasJavascriptChanges,
  variantIndex
}: JsPreviewWarningsProps) {
  if (!hasJavascriptChanges || !pageWarning) return null

  if (pageWarning.jsBlocked) {
    return (
      <div
        id={`js-csp-warning-variant-${variantIndex}`}
        role="alert"
        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      >
        <div className="flex items-start gap-1.5">
          <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div>
            <div className="font-medium">This page blocks dynamic JavaScript.</div>
            <div className="mt-0.5 text-amber-800">
              The page's Content Security Policy prevents both <code>eval</code> and inline{' '}
              <code>&lt;script&gt;</code>, so <code>javascript</code> DOM changes will not execute
              here or in production on this URL.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!pageWarning.evalAllowed) {
    return (
      <div
        id={`js-csp-info-variant-${variantIndex}`}
        role="status"
        className="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-800"
      >
        <div className="flex items-start gap-1.5">
          <InformationCircleIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div>
            This page blocks <code>eval</code> / <code>new Function()</code>. JavaScript changes
            will try an inline <code>&lt;script&gt;</code> fallback; if that also fails the change
            won't run.
          </div>
        </div>
      </div>
    )
  }

  return null
}
