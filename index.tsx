import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '~src/components/ErrorBoundary'
import IndexPopup from './popup'
import "~style.css"

const container = document.getElementById('__plasmo')
if (container) {
  const root = createRoot(container)
  root.render(
    <ErrorBoundary>
      <IndexPopup />
    </ErrorBoundary>
  )
}