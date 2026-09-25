import type { z } from 'zod'
import { ExperimentsCacheSchema } from '../../src/lib/validation-schemas'

type ExperimentsCache = z.infer<typeof ExperimentsCacheSchema>
type RawRecord = Record<string, unknown>

const cachedExperimentSchema = ExperimentsCacheSchema.shape.experiments.element

// chrome.storage.sync rejects any item whose key + JSON value exceeds 8192 bytes.
export const SYNC_QUOTA_BYTES_PER_ITEM = 8192
const EXPERIMENTS_CACHE_KEY = 'plasmo:experiments-cache'

const storedItemBytes = (value: unknown) =>
  new TextEncoder().encode(EXPERIMENTS_CACHE_KEY + JSON.stringify(JSON.stringify(value))).length

const asRecords = (value: unknown): RawRecord[] | undefined =>
  Array.isArray(value)
    ? value.map((item) => (item && typeof item === 'object' ? (item as RawRecord) : {}))
    : undefined

// Mirrors setExperimentsCache's minimisation, then keeps only the entries the
// extension's reader accepts: one invalid entry would reject the whole cache.
// Trailing entries are dropped until the stored item fits one sync record.
export function buildExperimentsCacheSeed(
  rawExperiments: unknown[],
  timestamp = Date.now()
): ExperimentsCache | null {
  const experiments = rawExperiments.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const exp = raw as RawRecord
    const parsed = cachedExperimentSchema.safeParse({
      id: exp.id,
      name: exp.name,
      display_name: exp.display_name,
      state: exp.state,
      status: exp.status,
      percentage_of_traffic: exp.percentage_of_traffic,
      traffic_split: exp.traffic_split,
      variants: asRecords(exp.variants)?.map((v) => ({
        variant: v.variant,
        name: v.name,
        is_control: v.is_control
      })),
      applications: asRecords(exp.applications)?.map((a) => ({
        application_id: a.application_id,
        id: a.id,
        name: a.name
      }))
    })
    return parsed.success ? [parsed.data] : []
  })
  const seed: ExperimentsCache = { version: 1, experiments, timestamp }
  while (seed.experiments.length > 0 && storedItemBytes(seed) > SYNC_QUOTA_BYTES_PER_ITEM) {
    seed.experiments.pop()
  }
  return seed.experiments.length > 0 ? seed : null
}
