import React, { useState } from 'react'
import { Button } from './ui/Button'
import { ShieldExclamationIcon } from '@heroicons/react/24/outline'
import type { ActiveSitePermissionState } from '~src/hooks/useActiveSitePermission'

interface Props {
  permission: ActiveSitePermissionState
}

/**
 * Top-of-sidebar banner shown when the extension lacks Chrome host permission
 * for the active tab. The "Grant access" button must be clicked by the user —
 * Chrome's `permissions.request` API is only honoured from a user gesture.
 */
export function SitePermissionBanner({ permission }: Props) {
  const { checked, hasPermission, host, requestPermission } = permission
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!checked || hasPermission || !host) {
    return null
  }

  const handleClick = async () => {
    setRequesting(true)
    setError(null)
    try {
      const granted = await requestPermission()
      if (!granted) {
        setError('Permission was not granted. The extension needs access to this site to preview and edit experiments here.')
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div
      id="site-permission-banner"
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <div className="flex items-start gap-2">
        <ShieldExclamationIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">Grant access to {host}</div>
          <p className="mt-0.5 text-xs text-amber-800">
            The extension can't interact with this site until you allow it. Click the button below — Chrome will
            show a native prompt to confirm.
          </p>
          {error && (
            <p className="mt-1 text-xs text-red-700">{error}</p>
          )}
        </div>
        <Button
          id="site-permission-grant-button"
          size="sm"
          variant="primary"
          onClick={handleClick}
          disabled={requesting}
        >
          {requesting ? 'Requesting…' : 'Grant access'}
        </Button>
      </div>
    </div>
  )
}
