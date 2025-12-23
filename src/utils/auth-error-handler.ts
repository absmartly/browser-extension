export interface AuthErrorHandlerOptions {
  setAuthError: (error: string) => void
  setError: (error: string) => void
  requestPermissionsIfNeeded?: (forceRequest: boolean) => Promise<boolean>
  retryCallback?: () => void
}

export function isAuthError(error: any): boolean {
  return error?.isAuthError === true || error?.message === 'AUTH_EXPIRED'
}

export async function handleAuthError(
  error: any,
  options: AuthErrorHandlerOptions
): Promise<void> {
  const { setAuthError, setError, requestPermissionsIfNeeded, retryCallback } = options

  if (!isAuthError(error)) {
    return
  }

  console.log('[handleAuthError] AUTH_EXPIRED error detected')
  setAuthError('authentication expired')

  if (requestPermissionsIfNeeded) {
    const permissionsGranted = await requestPermissionsIfNeeded(true)

    if (permissionsGranted && retryCallback) {
      console.log('[handleAuthError] Retrying after permissions granted...')
      setTimeout(retryCallback, 500)
    } else {
      setError('Your session has expired. Please log in again.')
    }
  } else {
    setError('Your session has expired. Please log in again.')
  }
}
