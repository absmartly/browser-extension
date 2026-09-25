import { CONFIG_INITIALIZATION_KEY } from '../../background/core/config-initialization-key'

type Evaluator = {
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>
}

// Seeding while the worker's startup config write is in flight can be
// overwritten (authMethod falls back to jwt and requests go out without
// Authorization). A missing marker must fail loudly rather than skip the wait.
export async function waitForConfigInitialization(worker: Evaluator): Promise<void> {
  const ready = await worker.evaluate(async (key: string) => {
    const initialization = (globalThis as Record<string, unknown>)[key] as { then?: unknown } | undefined
    if (!initialization || typeof initialization.then !== 'function') return false
    await initialization
    return true
  }, CONFIG_INITIALIZATION_KEY)
  if (!ready) {
    throw new Error(`Extension service worker has no ${CONFIG_INITIALIZATION_KEY} readiness promise: rebuild the extension (bun run build) before running e2e tests`)
  }
}
