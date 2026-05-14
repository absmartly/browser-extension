import React from "react"
import { createRoot, type Root } from "react-dom/client"

import { FullScreenModalHost } from "./FullScreenModalHost"

interface OpenOptions<T> {
  render: (api: { close: (value?: T) => void }) => React.ReactNode
  /** Optional CSS to inject into the shadow root (Tailwind classes won't work otherwise). */
  styleHref?: string
}

const HOST_ID = "absmartly-fullscreen-host"

/**
 * Clone every <style> and <link rel="stylesheet"> from the current document
 * (head + any open shadow roots we can find) into `target`. This brings the
 * sidebar's Tailwind stylesheet into the modal's shadow root so Tailwind
 * classes inside the modal render correctly.
 *
 * The modal lives on `document.body` of the sidebar iframe — Plasmo emits a
 * hashed CSS file at `tabs/sidebar.<hash>.css` and links it from the iframe's
 * `<head>` at runtime, so cloning from `document.head` is enough to pull in
 * Tailwind plus any other globally-registered styles.
 */
function cloneDocumentStyles(target: ShadowRoot): void {
  const seen = new Set<string>()

  const dedupKey = (node: HTMLStyleElement | HTMLLinkElement): string => {
    if (node.tagName === "LINK") {
      return `link:${(node as HTMLLinkElement).href}`
    }
    // Style tags rarely have a stable identifier — fall back to a hash of the
    // text content so we don't double-append the same inline block.
    return `style:${node.textContent || ""}`
  }

  const appendIfNew = (node: HTMLStyleElement | HTMLLinkElement): void => {
    const key = dedupKey(node)
    if (seen.has(key)) return
    seen.add(key)
    target.appendChild(node.cloneNode(true))
  }

  document
    .querySelectorAll<
      HTMLStyleElement | HTMLLinkElement
    >('head style, head link[rel="stylesheet"]')
    .forEach(appendIfNew)
}

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

    // Pull Tailwind (and any other head-level stylesheets) into the shadow
    // root so utility classes inside the modal actually render. Without this
    // the modal renders with UA defaults — see FT-1905.
    cloneDocumentStyles(shadow)

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
