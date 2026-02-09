import { debugLog, debugError } from './debug'

type MessageCallback = (response: any) => void

export async function sendMessage(message: any, callback?: MessageCallback): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = new Error(chrome.runtime.lastError.message)
          debugError(`chrome.runtime.sendMessage failed for ${message.type}:`, error)
          if (callback) callback({ success: false, error: error.message })
          reject(error)
        } else {
          if (callback) callback(response)
          resolve(response)
        }
      })
    } catch (error) {
      debugError(`Exception in chrome.runtime.sendMessage for ${message.type}:`, error)
      if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      reject(error)
    }
  })
}

export function sendMessageNoResponse(message: any): void {
  try {
    chrome.runtime.sendMessage(message).catch((error) => {
      if (!error?.message?.includes('Receiving end does not exist') &&
          !error?.message?.includes('message port closed')) {
        debugError(`Unexpected error sending message ${message.type}:`, error)
      }
    })
  } catch (error) {
    if (error instanceof Error &&
        !error.message.includes('Extension context invalidated') &&
        !error.message.includes('message port closed')) {
      debugError(`Exception in sendMessageNoResponse for ${message.type}:`, error)
    }
  }
}
