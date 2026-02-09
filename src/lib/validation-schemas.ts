import { z } from 'zod'
import type { Experiment, Variant } from '~src/types/absmartly'

const ExperimentStateSchema = z.enum([
  'created',
  'ready',
  'running',
  'development',
  'full_on',
  'stopped',
  'archived',
  'scheduled'
])

const ExperimentStatusSchema = z.enum(['draft', 'running', 'stopped', 'archived'])

const ExperimentTypeSchema = z.enum(['group_sequential', 'fixed_horizon', 'test'])

const ExperimentUserSchema = z.object({
  user_id: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  avatar: z
    .object({
      base_url: z.string().optional()
    })
    .optional()
})

const ExperimentTeamSchema = z.object({
  team_id: z.number().int().positive(),
  name: z.string()
})

const ApplicationSchema = z.object({
  id: z.number().int().positive().optional(),
  application_id: z.number().int().positive().optional(),
  name: z.string().optional(),
  application_version: z.string().optional(),
  icon_url: z.string().url().optional()
})

const UnitTypeSchema = z.object({
  unit_type_id: z.number().int().positive().optional(),
  name: z.string().optional()
})

const MetricSchema = z.object({
  metric_id: z.number().int().positive().optional(),
  name: z.string().optional(),
  id: z.number().int().positive().optional()
})

const ExperimentTagSchema = z.object({
  experiment_tag_id: z.number().int().positive(),
  name: z.string()
})

const ExperimentCustomSectionFieldValueSchema = z.object({
  id: z.number().int().positive().optional(),
  experiment_id: z.number().int().positive().optional(),
  custom_section_field_id: z.number().int().positive().optional(),
  experiment_custom_section_field_id: z.number().int().positive().optional(),
  type: z.string().optional(),
  value: z.unknown(),
  updated_at: z.string().optional()
})

export const VariantSchema = z.object({
  id: z.number().int().positive().optional(),
  variant: z.number().int().nonnegative().optional(),
  name: z.string().min(1),
  is_control: z.boolean().optional(),
  config: z.string()
})

const CachedVariantSchema = z.object({
  variant: z.number().int().nonnegative().optional(),
  name: z.string().optional(),
  is_control: z.boolean().optional()
})

const CachedApplicationSchema = z.object({
  application_id: z.number().int().positive().optional(),
  id: z.number().int().positive().optional(),
  name: z.string().min(1).optional()
})

export const ExperimentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  display_name: z.string().nullish(),
  state: ExperimentStateSchema,
  status: ExperimentStatusSchema.optional(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  full_on_variant: z.number().int().nonnegative().nullish(),
  percentage_of_traffic: z.number().min(0).max(100).optional(),
  traffic_split: z.number().min(0).max(100).optional(),
  nr_variants: z.number().int().nonnegative().optional(),
  percentages: z.string().optional(),
  audience: z.string().optional(),
  audience_strict: z.boolean().optional(),
  variants: z.array(VariantSchema).min(1),
  applications: z.array(ApplicationSchema).optional(),
  unit_type: UnitTypeSchema.optional(),
  unit_type_id: z.number().int().positive().optional(),
  primary_metric: MetricSchema.nullish(),
  experiment_tags: z.array(ExperimentTagSchema).optional(),
  context_ids: z.array(z.string()).optional(),
  owner: ExperimentUserSchema.optional(),
  owners: z.array(ExperimentUserSchema).optional(),
  teams: z.array(ExperimentTeamSchema).optional(),
  created_by: ExperimentUserSchema.nullish(),
  updated_by: ExperimentUserSchema.nullish(),
  exposures: z.number().int().nonnegative().optional(),
  started_at: z.string().optional(),
  stopped_at: z.string().optional(),
  type: ExperimentTypeSchema.optional(),
  favorite: z.boolean().optional(),
  custom_section_field_values: z
    .union([z.array(ExperimentCustomSectionFieldValueSchema), z.record(z.string(), z.unknown())])
    .optional()
})

const CachedExperimentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  display_name: z.string().nullish().optional(),
  state: ExperimentStateSchema.optional(),
  status: ExperimentStatusSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().nullish().optional(),
  percentage_of_traffic: z.number().min(0).max(100).optional(),
  traffic_split: z.number().min(0).max(100).optional(),
  variants: z.array(CachedVariantSchema).optional(),
  applications: z.array(CachedApplicationSchema).optional()
})

export const DOMChangeActionSchema = z.enum([
  'text',
  'style',
  'styleRules',
  'class',
  'attribute',
  'html',
  'javascript',
  'move',
  'remove',
  'insert',
  'create'
])

const BaseDOMChangeSchema = z.object({
  selector: z.string().min(1),
  disabled: z.boolean().optional(),
  waitForElement: z.boolean().optional(),
  triggerOnView: z.boolean().optional(),
  observerRoot: z.string().optional()
})

const DOMChangeStyleSchema = BaseDOMChangeSchema.extend({
  type: z.literal('style'),
  value: z.record(z.string(), z.string()),
  important: z.boolean().optional(),
  mode: z.enum(['replace', 'merge']).optional(),
  persistStyle: z.boolean().optional()
})

const DOMChangeStyleRulesSchema = BaseDOMChangeSchema.extend({
  type: z.literal('styleRules'),
  value: z.string().optional(),
  states: z
    .object({
      normal: z.record(z.string(), z.string()).optional(),
      hover: z.record(z.string(), z.string()).optional(),
      active: z.record(z.string(), z.string()).optional(),
      focus: z.record(z.string(), z.string()).optional()
    })
    .optional(),
  important: z.boolean().optional(),
  persistStyle: z.boolean().optional()
})

const DOMChangeTextSchema = BaseDOMChangeSchema.extend({
  type: z.literal('text'),
  value: z.string(),
  originalText: z.string().optional()
})

const DOMChangeClassSchema = BaseDOMChangeSchema.extend({
  type: z.literal('class'),
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
  mode: z.enum(['replace', 'merge']).optional()
})

const DOMChangeAttributeSchema = BaseDOMChangeSchema.extend({
  type: z.literal('attribute'),
  value: z.record(z.string(), z.string()),
  mode: z.enum(['replace', 'merge']).optional(),
  persistAttribute: z.boolean().optional()
})

const DOMChangeHTMLSchema = BaseDOMChangeSchema.extend({
  type: z.literal('html'),
  value: z.string(),
  originalHtml: z.string().optional()
})

const DOMChangeJavaScriptSchema = BaseDOMChangeSchema.extend({
  type: z.literal('javascript'),
  value: z.string(),
  persistScript: z.boolean().optional()
})

const DOMChangeMoveSchema = BaseDOMChangeSchema.extend({
  type: z.literal('move'),
  targetSelector: z.string().min(1),
  position: z.enum(['before', 'after', 'firstChild', 'lastChild'])
})

const DOMChangeRemoveSchema = BaseDOMChangeSchema.extend({
  type: z.literal('remove')
})

const DOMChangeInsertSchema = BaseDOMChangeSchema.extend({
  type: z.literal('insert'),
  html: z.string(),
  position: z.enum(['before', 'after', 'firstChild', 'lastChild'])
})

const DOMChangeCreateSchema = BaseDOMChangeSchema.extend({
  type: z.literal('create'),
  element: z.string(),
  targetSelector: z.string().min(1),
  position: z.enum(['before', 'after', 'firstChild', 'lastChild'])
})

export const DOMChangeSchema = z.discriminatedUnion('type', [
  DOMChangeStyleSchema,
  DOMChangeStyleRulesSchema,
  DOMChangeTextSchema,
  DOMChangeClassSchema,
  DOMChangeAttributeSchema,
  DOMChangeHTMLSchema,
  DOMChangeJavaScriptSchema,
  DOMChangeMoveSchema,
  DOMChangeRemoveSchema,
  DOMChangeInsertSchema,
  DOMChangeCreateSchema
])

export const URLFilterConfigSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  mode: z.enum(['simple', 'regex']).optional(),
  matchType: z.enum(['full-url', 'path', 'domain', 'query', 'hash']).optional()
})

export const URLFilterSchema = z.union([z.string(), z.array(z.string()), URLFilterConfigSchema])

export const DOMChangesConfigSchema = z.object({
  changes: z.array(DOMChangeSchema),
  urlFilter: URLFilterSchema.optional(),
  waitForElement: z.boolean().optional(),
  persistStyle: z.boolean().optional(),
  important: z.boolean().optional(),
  observerRoot: z.string().optional()
})

export const DOMChangesDataSchema = z.union([z.array(DOMChangeSchema), DOMChangesConfigSchema])

export const VariantConfigSchema = z.object({
  __dom_changes: z.array(DOMChangeSchema).optional(),
  dom_changes: z.array(DOMChangeSchema).optional()
})

export const ExperimentsCacheSchema = z.object({
  version: z.number().int().positive(),
  experiments: z.array(CachedExperimentSchema),
  timestamp: z.number().int().positive()
})

export function parseExperiment(data: unknown): Experiment {
  try {
    return ExperimentSchema.parse(data) as unknown as Experiment
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Experiment validation failed:', error.issues)
      throw new Error(`Invalid experiment data: ${error.issues[0].path.join('.')}: ${error.issues[0].message}`)
    }
    throw error
  }
}

export function parseExperiments(data: unknown): Experiment[] {
  try {
    return z.array(ExperimentSchema).parse(data) as unknown as Experiment[]
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Experiments array validation failed:', error.issues)
      throw new Error(
        `Invalid experiments array: ${error.issues[0].path.join('.')}: ${error.issues[0].message}`
      )
    }
    throw error
  }
}

export function safeParseExperiments(data: unknown): { success: true; data: Experiment[] } | { success: false; error: string } {
  try {
    const result = z.array(ExperimentSchema).safeParse(data)
    if (result.success) {
      return { success: true, data: result.data as unknown as Experiment[] }
    } else {
      const firstError = result.error.issues[0]
      return {
        success: false,
        error: `${firstError.path.join('.')}: ${firstError.message}`
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export function parseVariantConfig(configStr: string): unknown {
  try {
    const parsed = JSON.parse(configStr)

    if (parsed.__dom_changes || parsed.dom_changes) {
      const validated = VariantConfigSchema.parse(parsed)
      return validated
    }

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Variant config validation failed:', error.issues)
      throw new Error(`Invalid variant config: ${error.issues[0].path.join('.')}: ${error.issues[0].message}`)
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in variant config: ${error.message}`)
    }

    throw error
  }
}

export function safeParseVariantConfig(configStr: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(configStr)

    if (parsed.__dom_changes || parsed.dom_changes) {
      const result = VariantConfigSchema.safeParse(parsed)
      if (result.success) {
        return { success: true, data: result.data }
      } else {
        const firstError = result.error.issues[0]
        return {
          success: false,
          error: `${firstError.path.join('.')}: ${firstError.message}`
        }
      }
    }

    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: `Invalid JSON: ${error.message}` }
    }
    return { success: false, error: String(error) }
  }
}

export function parseExperimentsCache(data: unknown): { experiments: z.infer<typeof CachedExperimentSchema>[]; timestamp: number } {
  try {
    const validated = ExperimentsCacheSchema.parse(data)
    return validated as unknown as { experiments: z.infer<typeof CachedExperimentSchema>[]; timestamp: number }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Experiments cache validation failed:', error.issues)
      throw new Error(
        `Invalid experiments cache: ${error.issues[0].path.join('.')}: ${error.issues[0].message}`
      )
    }
    throw error
  }
}

export function safeParseJSON<T = unknown>(jsonStr: string, schema?: z.ZodSchema<T>): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonStr)

    if (schema) {
      const result = schema.safeParse(parsed)
      if (result.success) {
        return { success: true, data: result.data }
      } else {
        const firstError = result.error.issues[0]
        return {
          success: false,
          error: `Validation failed: ${firstError.path.join('.')}: ${firstError.message}`
        }
      }
    }

    return { success: true, data: parsed as T }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: `Invalid JSON: ${error.message}` }
    }
    return { success: false, error: String(error) }
  }
}
