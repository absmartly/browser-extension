import { useState, useEffect, useRef, useCallback } from 'react'
import { isSDKAvailable } from '~src/utils/sdk-bridge'

export interface SDKStatus {
  sdkDetected: boolean
  checking: boolean
  checked: boolean
}

export function useSDKStatus() {
  const [status, setStatus] = useState<SDKStatus>({
    sdkDetected: false,
    checking: true,
    checked: false
  })

  const checkInFlightRef = useRef(false)
  const lastCheckAtRef = useRef(0)
  const isMountedRef = useRef(true)

  const runCheck = useCallback(async (isInitial: boolean) => {
    if (checkInFlightRef.current) return

    const now = Date.now()
    if (!isInitial && now - lastCheckAtRef.current < 2000) {
      return
    }

    checkInFlightRef.current = true
    if (isInitial) {
      setStatus(prev => ({ ...prev, checking: true }))
    }

    try {
      const detected = await isSDKAvailable()
      lastCheckAtRef.current = Date.now()
      if (isMountedRef.current) {
        setStatus({
          sdkDetected: detected,
          checking: false,
          checked: true
        })
      }
    } catch (error) {
      console.error('[useSDKStatus] Error checking SDK availability:', error)
      if (isMountedRef.current) {
        setStatus(prev => ({
          sdkDetected: prev.sdkDetected,
          checking: false,
          checked: prev.checked
        }))
      }
    } finally {
      checkInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    runCheck(true)

    const handleFocus = () => {
      void runCheck(false)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runCheck(false)
      }
    }

    const handleTabActivated = () => {
      void runCheck(false)
    }

    const handleTabUpdated = (_tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.status === 'complete') {
        void runCheck(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    chrome.tabs?.onActivated.addListener(handleTabActivated)
    chrome.tabs?.onUpdated.addListener(handleTabUpdated)

    return () => {
      isMountedRef.current = false
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      chrome.tabs?.onActivated.removeListener(handleTabActivated)
      chrome.tabs?.onUpdated.removeListener(handleTabUpdated)
    }
  }, [runCheck])

  return status
}
