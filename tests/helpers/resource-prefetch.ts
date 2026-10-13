// Fail closed: never turn a failed live request into a valid empty cache.
export async function fetchResource(
  resource: string,
  request: () => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  attempts = 5
): Promise<unknown[]> {
  let failure = 'request failed'
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request()
      if (response.ok) {
        const data = await response.json()
        const rows = Array.isArray(data) ? data : data?.[resource]
        if (!Array.isArray(rows)) throw new Error('invalid response shape')
        return rows
      }
      failure = `HTTP ${response.status}`
      if (response.status !== 429 && response.status < 500) {
        throw new NonRetryable(failure)
      }
    } catch (error) {
      if (error instanceof NonRetryable) throw new Error(`Pre-fetch ${resource}: ${error.message}`)
      // No response bodies, endpoints or credentials in setup diagnostics.
      failure = error instanceof Error && error.name === 'AbortError' ? 'request timeout' : 'request/response failure'
    }
    if (attempt < attempts) await pause(250 * 2 ** (attempt - 1))
  }
  throw new Error(`Pre-fetch ${resource} failed after ${attempts} attempts: ${failure}; cache not published`)
}

class NonRetryable extends Error {}

export function requireEditorResources(resources: Record<string, unknown[]>) {
  for (const key of ['applications', 'unitTypes']) {
    if (!resources[key]?.length) throw new Error(`Live test prerequisite missing: ${key} is empty; cache not published`)
  }
}
