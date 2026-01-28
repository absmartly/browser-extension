import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { getAvatarColor, getInitials } from '~src/utils/avatar'
import { debugError } from '~src/utils/debug'
import type { ABsmartlyUser } from '~src/types/absmartly'

interface AuthenticationStatusSectionProps {
  checkingAuth: boolean
  user: ABsmartlyUser | null
  avatarUrl: string | null
  apiEndpoint: string
  apiKey: string
  authMethod: 'jwt' | 'apikey'
  onCheckAuth: (endpoint: string, config: { apiKey: string; authMethod: 'jwt' | 'apikey' }) => void
  onAuthenticate: () => void
}

export const AuthenticationStatusSection = React.memo(function AuthenticationStatusSection({
  checkingAuth,
  user,
  avatarUrl,
  apiEndpoint,
  apiKey,
  authMethod,
  onCheckAuth,
  onAuthenticate
}: AuthenticationStatusSectionProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [avatarUrl])

  const showAvatar = avatarUrl && !avatarFailed

  return (
    <div className="bg-gray-50 p-3 rounded-md" data-testid="auth-status-section">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700">Authentication Status</div>
        {apiEndpoint && !checkingAuth && (
          <Button
            id="auth-refresh-button"
            onClick={() => onCheckAuth(apiEndpoint, { apiKey, authMethod })}
            size="sm"
            variant="secondary"
            className="text-xs"
          >
            Refresh
          </Button>
        )}
      </div>
      {checkingAuth ? (
        <div className="flex items-center text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Checking authentication...
        </div>
      ) : user ? (
        <div data-testid="auth-user-info">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              {showAvatar ? (
                <img
                  src={avatarUrl}
                  alt={user.name || 'User'}
                  className="w-full h-full object-cover"
                  onError={() => {
                    debugError('Avatar failed to load:', avatarUrl)
                    setAvatarFailed(true)
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: getAvatarColor(user.name || 'User') }}
                >
                  {getInitials(user.name || 'User')}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900" data-testid="auth-user-name">{user.name || 'User'}</div>
              <div className="text-xs text-gray-600" data-testid="auth-user-email">{user.email || 'No email'}</div>
            </div>
          </div>
          {/* Debug info - only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">Debug info</summary>
              <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
{JSON.stringify(user, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-testid="auth-not-authenticated">
          <div className="text-sm text-gray-600">Not authenticated</div>
          {apiEndpoint && (
            <Button
              id="authenticate-button"
              onClick={onAuthenticate}
              size="sm"
              variant="secondary"
            >
              Authenticate in ABsmartly
            </Button>
          )}
        </div>
      )}
    </div>
  )
})
