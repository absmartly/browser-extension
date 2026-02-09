import { z } from 'zod'

export const VariantSchema = z.object({
  id: z.number().optional(),
  variant: z.number().optional(),
  name: z.string(),
  is_control: z.boolean().optional(),
  config: z.string()
})

export const ApplicationSchema = z.object({
  id: z.number().optional(),
  application_id: z.number().optional(),
  name: z.string().optional(),
  application_version: z.string().optional(),
  icon_url: z.string().optional()
})

export const ExperimentTagSchema = z.object({
  experiment_tag_id: z.number(),
  name: z.string().optional()
})

export const ExperimentUserSchema = z.object({
  user_id: z.number().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  avatar_url: z.string().optional()
})

export const ExperimentTeamSchema = z.object({
  team_id: z.number(),
  name: z.string().optional()
})

export const UnitTypeSchema = z.object({
  unit_type_id: z.number().optional(),
  name: z.string().optional()
})

export const MetricSchema = z.object({
  metric_id: z.number().optional(),
  id: z.number().optional(),
  name: z.string().optional()
})

export const ExperimentSchema = z.object({
  id: z.number(),
  name: z.string(),
  display_name: z.string().nullish(),
  state: z.enum(['created', 'ready', 'running', 'development', 'full_on', 'stopped', 'archived', 'scheduled']),
  status: z.enum(['draft', 'running', 'stopped', 'archived']).optional(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  full_on_variant: z.number().nullish(),
  percentage_of_traffic: z.number().optional(),
  traffic_split: z.number().optional(),
  nr_variants: z.number().optional(),
  percentages: z.string().optional(),
  audience: z.string().optional(),
  audience_strict: z.boolean().optional(),
  variants: z.array(VariantSchema),
  applications: z.array(ApplicationSchema).optional(),
  unit_type: UnitTypeSchema.optional(),
  unit_type_id: z.number().optional(),
  primary_metric: MetricSchema.nullish(),
  experiment_tags: z.array(ExperimentTagSchema).optional(),
  context_ids: z.array(z.string()).optional(),
  owner: ExperimentUserSchema.optional(),
  owners: z.array(ExperimentUserSchema).optional(),
  teams: z.array(ExperimentTeamSchema).optional(),
  created_by: ExperimentUserSchema.nullish(),
  updated_by: ExperimentUserSchema.nullish(),
  exposures: z.number().optional(),
  started_at: z.string().optional(),
  stopped_at: z.string().optional(),
  type: z.enum(['group_sequential', 'fixed_horizon', 'test']).optional(),
  favorite: z.boolean().optional(),
  custom_section_field_values: z.any().optional()
})

export const ExperimentsResponseSchema = z.object({
  experiments: z.array(ExperimentSchema).optional(),
  data: z.array(ExperimentSchema).optional(),
  total: z.number().optional(),
  totalCount: z.number().optional(),
  count: z.number().optional(),
  hasMore: z.boolean().optional()
}).passthrough()

export const ApplicationsResponseSchema = z.object({
  applications: z.array(ApplicationSchema).optional(),
  data: z.array(ApplicationSchema).optional()
}).passthrough()

export const UnitTypesResponseSchema = z.object({
  unitTypes: z.array(UnitTypeSchema).optional(),
  data: z.array(UnitTypeSchema).optional()
}).passthrough()

export const MetricsResponseSchema = z.object({
  metrics: z.array(MetricSchema).optional(),
  data: z.array(MetricSchema).optional()
}).passthrough()

export const ExperimentTagsResponseSchema = z.object({
  tags: z.array(ExperimentTagSchema).optional(),
  data: z.array(ExperimentTagSchema).optional()
}).passthrough()
