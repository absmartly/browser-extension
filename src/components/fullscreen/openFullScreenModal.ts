import React from "react"
import { createRoot, type Root } from "react-dom/client"

import { FullScreenModalHost } from "./FullScreenModalHost"

interface OpenOptions<T> {
  render: (api: { close: (value?: T) => void }) => React.ReactNode
  /** Optional CSS to inject into the shadow root (Tailwind classes won't work otherwise). */
  styleHref?: string
}

const HOST_ID = "absmartly-fullscreen-host"

export function openFullScreenModal<T = unknown>(
  options: OpenOptions<T>
): Promise<T | null> {
  return new Promise((resolve) => {
    const existing = document.getElementById(HOST_ID)
    if (existing) existing.remove()

    const host = document.createElement("div")
    host.id = HOST_ID
    host.style.cssText = "all: initial;"
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: "open" })

    if (options.styleHref) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = options.styleHref
      shadow.appendChild(link)
    }

    const mount = document.createElement("div")
    shadow.appendChild(mount)

    let root: Root | null = createRoot(mount)
    let resolved = false

    const close = (value?: T) => {
      if (resolved) return
      resolved = true
      try {
        root?.unmount()
      } finally {
        root = null
        host.remove()
        resolve(value === undefined ? null : value)
      }
    }

    root.render(
      React.createElement(FullScreenModalHost, null, options.render({ close }))
    )
  })
}
