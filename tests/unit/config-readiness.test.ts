import { waitForConfigInitialization } from '../helpers/config-readiness'
import { CONFIG_INITIALIZATION_KEY } from '../../background/core/config-initialization-key'

// Runs the fixture helper's evaluate callback in this process's global scope,
// standing in for the extension service worker.
const worker = { evaluate: async <R, A>(fn: (arg: A) => R | Promise<R>, arg: A) => fn(arg) }

afterEach(() => { delete (globalThis as any)[CONFIG_INITIALIZATION_KEY] })

test('fails with a rebuild instruction when the worker exposes no readiness promise', async () => {
  await expect(waitForConfigInitialization(worker)).rejects.toThrow(/readiness promise: rebuild the extension/)
})

test('fails when the readiness marker is not a promise', async () => {
  ;(globalThis as any)[CONFIG_INITIALIZATION_KEY] = true
  await expect(waitForConfigInitialization(worker)).rejects.toThrow(/rebuild the extension/)
})

test('waits for the worker initialization to settle before returning', async () => {
  let release!: () => void
  ;(globalThis as any)[CONFIG_INITIALIZATION_KEY] = new Promise<void>(resolve => { release = resolve })
  let returned = false
  const waiting = waitForConfigInitialization(worker).then(() => { returned = true })
  await Promise.resolve(); await Promise.resolve()
  expect(returned).toBe(false)
  release()
  await waiting
  expect(returned).toBe(true)
})
