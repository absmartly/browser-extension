import type { z } from 'zod'
import { ExperimentsCacheSchema } from '../../src/lib/validation-schemas'

type ExperimentsCache = z.infer<typeof ExperimentsCacheSchema>
type RawRecord = Record<string, unknown>

const cachedExperimentSchema = ExperimentsCacheSchema.shape.experiments.element

const asRecords = (value: unknown): RawRecord[] | undefined =>
  Array.isArray(value)
    ? value.map((item) => (item && typeof item === 'object' ? (item as RawRecord) : {}))
    : undefined

// Mirrors setExperimentsCache's minimisation, then keeps only the entries the
// extension's reader accepts: one invalid entry would reject the whole cache.
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
  return experiments.length > 0 ? { version: 1, experiments, timestamp } : null
}
