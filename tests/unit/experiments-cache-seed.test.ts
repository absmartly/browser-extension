import { buildExperimentsCacheSeed } from '../helpers/experiments-cache-seed'

jest.mock('../../src/utils/notifications', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined)
}))

// src/__mocks__ replaces Plasmo Storage globally; this test needs its real
// serializer to prove the seeded chrome.storage format is readable.
jest.mock('@plasmohq/storage', () => jest.requireActual('@plasmohq/storage'))

function installChromeStorage(sync: Record<string, unknown>) {
  const area = {
    get: jest.fn(async (keys: string[] | string) => {
      const list = Array.isArray(keys) ? keys : [keys]
      return Object.fromEntries(list.filter((k) => k in sync).map((k) => [k, sync[k]]))
    }),
    set: jest.fn(async (items: Record<string, unknown>) => Object.assign(sync, items)),
    remove: jest.fn(async (keys: string[] | string) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete sync[k]
    }),
    onChanged: { addListener: jest.fn(), removeListener: jest.fn() }
  }
  ;(global as any).chrome = {
    ...(global as any).chrome,
    storage: { sync: area, local: area, session: area, onChanged: area.onChanged }
  }
}

async function readThroughExtension(sync: Record<string, unknown>) {
  installChromeStorage(sync)
  let result: unknown
  await jest.isolateModulesAsync(async () => {
    const { getExperimentsCache } = await import('../../src/utils/storage')
    result = await getExperimentsCache()
  })
  return result as { experiments: Array<{ id: number }> } | null
}

const liveShaped = [
  {
    id: 11,
    name: 'running_exp',
    display_name: 'Running',
    state: 'running',
    percentage_of_traffic: 100,
    variants: [{ variant: 0, name: 'A', config: '{}' }],
    applications: [{ application_id: 3, application: { name: 'www' } }]
  },
  { id: 12, name: 'unknown_state', state: 'not-a-state' },
  { id: 'x', name: 'bad_id' },
  null
]

test('seed keeps only entries the extension cache schema accepts', () => {
  const seed = buildExperimentsCacheSeed(liveShaped, 1000)
  expect(seed?.experiments.map((e) => e.id)).toEqual([11])
  expect(buildExperimentsCacheSeed([{ id: 'x' }])).toBeNull()
})

test('JSON-string seed is read back by getExperimentsCache via Plasmo Storage', async () => {
  const seed = buildExperimentsCacheSeed(liveShaped, 1000)
  const cache = await readThroughExtension({ 'experiments-cache': JSON.stringify(seed) })
  expect(cache?.experiments.map((e) => e.id)).toEqual([11])
})

test('an unserialized object seed is not readable by Plasmo Storage', async () => {
  const seed = buildExperimentsCacheSeed(liveShaped, 1000)
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(await readThroughExtension({ 'experiments-cache': seed })).toBeNull()
  errors.mockRestore()
})
