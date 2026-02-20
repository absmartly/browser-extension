import { useState, useCallback, useEffect } from 'react'
import type { ABsmartlyConfig } from '~src/types/absmartly'

import { debugLog, debugWarn } from '~src/utils/debug'
export function usePermissions(config: ABsmartlyConfig | null) {
  const [needsPermissions, setNeedsPermissions] = useState(false)

  const requestPermissionsIfNeeded = useCallback(async (forceRequest = false): Promise<boolean> => {
    debugLog('[ExtensionUI] requestPermissionsIfNeeded called, forceRequest:', forceRequest)

    if (config?.authMethod !== 'jwt') {
      debugLog('[ExtensionUI] Not using JWT auth, skipping permission request')
      return false
    }

    try {
      const hasCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const hasHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })

      debugLog('[ExtensionUI] Permission status - cookies:', hasCookies, 'host:', hasHost)

      if (hasCookies && hasHost) {
        debugLog('[ExtensionUI] ✅ Already have all permissions')
        return false
      }

      debugLog('[ExtensionUI] 🔐 Missing permissions - showing modal...')
      setNeedsPermissions(true)
      return false
    } catch (err) {
      console.error('[ExtensionUI] Error checking permissions:', err)
      return false
    }
  }, [config?.authMethod])

  const handleGrantPermissions = async (
    onSuccess: () => void,
    onError: (message: string) => void
  ) => {
    debugLog('[ExtensionUI] handleGrantPermissions called - requesting permissions')

    try {
      const currentCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const currentHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      debugLog('[ExtensionUI] Current permissions before request - cookies:', currentCookies, 'host:', currentHost)

      debugLog('[ExtensionUI] Requesting cookies permission...')
      const cookiesGranted = await chrome.permissions.request({
        permissions: ['cookies']
      })
      debugLog('[ExtensionUI] Cookies permission result:', cookiesGranted)

      debugLog('[ExtensionUI] Requesting host permission...')
      const hostGranted = await chrome.permissions.request({
        origins: ['https://*.absmartly.com/*']
      })
      debugLog('[ExtensionUI] Host permission result:', hostGranted)

      const finalCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const finalHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      debugLog('[ExtensionUI] Final permissions after request - cookies:', finalCookies, 'host:', finalHost)

      if (cookiesGranted && hostGranted) {
        debugLog('[ExtensionUI] ✅ All permissions granted!')
        setNeedsPermissions(false)

        if (currentCookies && currentHost) {
          debugLog('[ExtensionUI] ⚠️ Permissions were already granted - JWT cookie might be missing or expired')
          onError('You have permissions but authentication failed. Please log in to ABsmartly in your browser first.')
        } else {
          onSuccess()
        }
      } else {
        console.error('[ExtensionUI] ❌ User denied some permissions - cookies:', cookiesGranted, 'host:', hostGranted)
        setNeedsPermissions(false)
        onError('Cookie and host permissions are required for JWT authentication.')
      }
    } catch (err) {
      console.error('[ExtensionUI] Error requesting permissions:', err)
      setNeedsPermissions(false)
      onError('Failed to request permissions. Please try again.')
    }
  }

  const handleDenyPermissions = useCallback(() => {
    debugLog('[ExtensionUI] User denied permissions')
    setNeedsPermissions(false)
  }, [])

  useEffect(() => {
    if (config?.authMethod === 'jwt') {
      debugLog('[ExtensionUI] Checking permissions on mount (JWT auth detected)')
      chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      }).then(hasPermission => {
        if (!hasPermission) {
          debugWarn('[ExtensionUI] ⚠️ Missing cookie permissions! Will request on first API call.')
        } else {
          debugLog('[ExtensionUI] ✅ Cookie permissions already granted')
        }
      })
    }
  }, [config?.authMethod])

  return {
    needsPermissions,
    requestPermissionsIfNeeded,
    handleGrantPermissions,
    handleDenyPermissions
  }
}
