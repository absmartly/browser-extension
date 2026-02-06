export const MAX_TOOL_ITERATIONS = 10
export const AI_REQUEST_TIMEOUT_MS = 60000
export const AI_REQUEST_TIMEOUT_ERROR = 'AI request timed out after 60 seconds'

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  errorMessage: string = AI_REQUEST_TIMEOUT_ERROR
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  })
}

export function parseAPIError(error: any, fallbackPrefix: string): string {
  if (!error.message) return fallbackPrefix

  try {
    const parsed = JSON.parse(error.message)
    return parsed.error?.message || parsed.message || error.message
  } catch {
    return error.message
  }
}
