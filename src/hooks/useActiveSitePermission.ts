import { useCallback, useEffect, useState } from 'react'
import { debugLog, debugWarn } from '~src/utils/debug'

/**
 * Normalise an active-tab URL into the `origin/*` match pattern that
 * `chrome.permissions` uses. Returns `null` for URLs the extension can
 * never be granted access to (chrome://, chrome-extension://, about://,
 * the new-tab page, PDF viewer, etc.) so the caller can skip the banner
 * entirely in those contexts.
 */
export function originPatternFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:' || parsed.protocol === 'about:' || parsed.protocol === 'edge:' || parsed.protocol === 'devtools:') {
      return null
    }
    if (parsed.protocol === 'file:') {
      return 'file:///*'
    }
    return `${parsed.protocol}//${parsed.host}/*`
  } catch {
    return null
  }
}

export interface ActiveSitePermissionState {
  /** The match pattern Chrome would use to grant host permission, e.g. "https://example.com/*". */
  originPattern: string | null
  /** Human-readable host for display in the UI (e.g. "example.com"). */
  host: string | null
  /** True once we've finished the initial check. */
  checked: boolean
  /**
   * True when the extension currently has host permission for the active
   * tab's origin (or when the tab is a page where permission does not apply,
   * e.g. chrome://). False only when we have a real origin we could ask for
   * but Chrome has not yet granted it.
   */
  hasPermission: boolean
  /**
   * Ask Chrome for host permission for the active tab's origin. Must be
   * called from a user-gesture handler (e.g. a button onClick) — Chrome
   * rejects programmatic permission requests. Returns the final
   * granted/denied boolean.
   */
  requestPermission: () => Promise<boolean>
}

async function queryActiveTabUrl(): Promise<string | undefined> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    return tab?.url
  } catch (err) {
    debugWarn('[useActiveSitePermission] chrome.tabs.query failed:', err)
    return undefined
  }
}

/**
 * Keep the sidebar's view of "do we have access to the current tab" in sync
 * with Chrome's optional host_permissions grant set. The extension ships
 * with host permission for `*.absmartly.com` + localhost and declares
 * `"optional_host_permissions": ["<all_urls>"]`, so every other site must
 * be granted per-origin via Chrome's native prompt; this hook surfaces the
 * "not yet granted" state so the UI can ask for it.
 */
export function useActiveSitePermission(): ActiveSitePermissionState {
  const [originPattern, setOriginPattern] = useState<string | null>(null)
  const [host, setHost] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean>(true)
  const [checked, setChecked] = useState<boolean>(false)

  const refresh = useCallback(async () => {
    const url = await queryActiveTabUrl()
    const pattern = originPatternFromUrl(url)
    if (!pattern) {
      setOriginPattern(null)
      setHost(null)
      setHasPermission(true)
      setChecked(true)
      return
    }
    setOriginPattern(pattern)
    try {
      const parsed = new URL(url!)
      setHost(parsed.host || parsed.protocol)
    } catch {
      setHost(null)
    }
    if (typeof chrome === 'undefined' || !chrome.permissions?.contains) {
      setHasPermission(true)
      setChecked(true)
      return
    }
    try {
      const granted = await chrome.permissions.contains({ origins: [pattern] })
      debugLog('[useActiveSitePermission] pattern:', pattern, 'granted:', granted)
      setHasPermission(!!granted)
    } catch (err) {
      debugWarn('[useActiveSitePermission] permissions.contains failed:', err)
      setHasPermission(true)
    } finally {
      setChecked(true)
    }
  }, [])

  useEffect(() => {
    refresh()

    if (typeof chrome === 'undefined') return

    const onAdded = () => refresh()
    const onRemoved = () => refresh()
    const onTabActivated = () => refresh()
    const onTabUpdated = (_id: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.url) refresh()
    }

    chrome.permissions?.onAdded?.addListener?.(onAdded)
    chrome.permissions?.onRemoved?.addListener?.(onRemoved)
    chrome.tabs?.onActivated?.addListener?.(onTabActivated)
    chrome.tabs?.onUpdated?.addListener?.(onTabUpdated)

    return () => {
      // Chrome typings for `permissions.onAdded/onRemoved` don't expose
      // `removeListener` on the narrow event subtype; cast through `unknown`
      // so cleanup still unregisters the listeners in practice.
      ;(chrome.permissions?.onAdded as unknown as { removeListener?: (fn: () => void) => void } | undefined)?.removeListener?.(onAdded)
      ;(chrome.permissions?.onRemoved as unknown as { removeListener?: (fn: () => void) => void } | undefined)?.removeListener?.(onRemoved)
      chrome.tabs?.onActivated?.removeListener?.(onTabActivated)
      chrome.tabs?.onUpdated?.removeListener?.(onTabUpdated)
    }
  }, [refresh])

  const requestPermission = useCallback(async () => {
    if (!originPattern) return true
    if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false
    try {
      const granted = await chrome.permissions.request({ origins: [originPattern] })
      setHasPermission(!!granted)
      return !!granted
    } catch (err) {
      debugWarn('[useActiveSitePermission] permissions.request failed:', err)
      return false
    }
  }, [originPattern])

  return { originPattern, host, checked, hasPermission, requestPermission }
}
