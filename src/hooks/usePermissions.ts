import { useState, useCallback, useEffect } from 'react'
import type { ABsmartlyConfig } from '~src/types/absmartly'

export function usePermissions(config: ABsmartlyConfig | null) {
  const [needsPermissions, setNeedsPermissions] = useState(false)

  const requestPermissionsIfNeeded = useCallback(async (forceRequest = false): Promise<boolean> => {
    console.log('[ExtensionUI] requestPermissionsIfNeeded called, forceRequest:', forceRequest)

    if (config?.authMethod !== 'jwt') {
      console.log('[ExtensionUI] Not using JWT auth, skipping permission request')
      return false
    }

    try {
      const hasCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const hasHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })

      console.log('[ExtensionUI] Permission status - cookies:', hasCookies, 'host:', hasHost)

      if (hasCookies && hasHost) {
        console.log('[ExtensionUI] ✅ Already have all permissions')
        return false
      }

      console.log('[ExtensionUI] 🔐 Missing permissions - showing modal...')
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
    console.log('[ExtensionUI] handleGrantPermissions called - requesting permissions')

    try {
      const currentCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const currentHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      console.log('[ExtensionUI] Current permissions before request - cookies:', currentCookies, 'host:', currentHost)

      console.log('[ExtensionUI] Requesting cookies permission...')
      const cookiesGranted = await chrome.permissions.request({
        permissions: ['cookies']
      })
      console.log('[ExtensionUI] Cookies permission result:', cookiesGranted)

      console.log('[ExtensionUI] Requesting host permission...')
      const hostGranted = await chrome.permissions.request({
        origins: ['https://*.absmartly.com/*']
      })
      console.log('[ExtensionUI] Host permission result:', hostGranted)

      const finalCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const finalHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      console.log('[ExtensionUI] Final permissions after request - cookies:', finalCookies, 'host:', finalHost)

      if (cookiesGranted && hostGranted) {
        console.log('[ExtensionUI] ✅ All permissions granted!')
        setNeedsPermissions(false)

        if (currentCookies && currentHost) {
          console.log('[ExtensionUI] ⚠️ Permissions were already granted - JWT cookie might be missing or expired')
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
    console.log('[ExtensionUI] User denied permissions')
    setNeedsPermissions(false)
  }, [])

  useEffect(() => {
    if (config?.authMethod === 'jwt') {
      console.log('[ExtensionUI] Checking permissions on mount (JWT auth detected)')
      chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      }).then(hasPermission => {
        if (!hasPermission) {
          console.warn('[ExtensionUI] ⚠️ Missing cookie permissions! Will request on first API call.')
        } else {
          console.log('[ExtensionUI] ✅ Cookie permissions already granted')
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
