import { useState, useEffect } from 'react'
import { isSDKAvailable } from '~src/utils/sdk-bridge'

export interface SDKStatus {
  sdkDetected: boolean
  checking: boolean
}

export function useSDKStatus() {
  const [status, setStatus] = useState<SDKStatus>({
    sdkDetected: false,
    checking: true
  })

  useEffect(() => {
    let isInitialCheck = true

    const checkSDK = async () => {
      try {
        if (isInitialCheck) {
          setStatus(prev => ({ ...prev, checking: true }))
        }

        const detected = await isSDKAvailable()

        setStatus({
          sdkDetected: detected,
          checking: false
        })

        isInitialCheck = false
      } catch (error) {
        console.error('[useSDKStatus] Error checking SDK availability:', error)
        setStatus({
          sdkDetected: false,
          checking: false
        })
      }
    }

    checkSDK()

    const intervalId = setInterval(checkSDK, 5000)

    return () => clearInterval(intervalId)
  }, [])

  return status
}
