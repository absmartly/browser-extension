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
      if (isInitialCheck) {
        setStatus(prev => ({ ...prev, checking: true }))
      }

      const detected = await isSDKAvailable()

      setStatus({
        sdkDetected: detected,
        checking: false
      })

      isInitialCheck = false
    }

    checkSDK()

    const intervalId = setInterval(checkSDK, 5000)

    return () => clearInterval(intervalId)
  }, [])

  return status
}
