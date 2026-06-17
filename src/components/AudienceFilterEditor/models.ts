/**
 * Audience filter data model — port of the Vue app's
 * `views/ExperimentForm/Audiences/AudienceFilters/AudienceFilters.models.ts`.
 *
 * Wire format (the JSON we read from / write to the API) and the in-memory
 * editor model are intentionally kept symmetrical with the web app so an
 * extension-edited audience round-trips through the web console without
 * change.
 */

export const binaryOperators = [
  "and",
  "or",
  "in",
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
  "match"
] as const

export const semverOperators = [
  "semver_eq",
  "semver_gt",
  "semver_gte",
  "semver_lt",
  "semver_lte"
] as const

export const unaryOperators = ["null", "not"] as const

export const highPrecedenceOperators = ["not"] as const

export const lowPrecedenceOperators = [
  "null",
  "in",
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
  "match"
] as const

export const lowPrecedenceOperatorsWithSemver = [
  ...lowPrecedenceOperators,
  ...semverOperators
] as const

export type BinaryOperator = (typeof binaryOperators)[number]
export type SemverOperator = (typeof semverOperators)[number]
export type UnaryOperator = (typeof unaryOperators)[number]
export type Operator = BinaryOperator | UnaryOperator

export type HighPrecedenceOperator = (typeof highPrecedenceOperators)[number]
export type LowPrecedenceOperator =
  | (typeof lowPrecedenceOperators)[number]
  | SemverOperator

/**
 * Display labels for the operators surfaced in the UI dropdown. Pulled from
 * the Vue app's `operatorDict` so the option labels match what users see in
 * the web console.
 */
export const operatorDict: Record<
  LowPrecedenceOperator | UnaryOperator,
  string
> = {
  in: "Contains",
  eq: "Equal",
  gt: "Greater Than",
  gte: "Greater Than/Equal",
  lt: "Less Than",
  lte: "Less Than/Equal",
  match: "RegExp Match",
  null: "Null",
  not: "Not",
  semver_eq: "Version Equal",
  semver_gt: "Version Greater Than",
  semver_gte: "Version Greater Than/Equal",
  semver_lt: "Version Less Than",
  semver_lte: "Version Less Than/Equal"
}

export type FilterExpression = {
  highPrecedenceOperator: HighPrecedenceOperator | null
  lowPrecedenceOperator: LowPrecedenceOperator
  path: string
  value: string
}

export type AudienceGroup = {
  key: number
  operator: Extract<BinaryOperator, "and" | "or">
  expression: FilterExpression[]
}

export type AudienceFiltersData = {
  operator: Extract<BinaryOperator, "and" | "or">
  groups: AudienceGroup[]
}

/* Wire (serialized) shapes — what we read from / write to `formData.audience`. */

export type AttributeAndValueSchema = [
  { var: { path: string } },
  { value: string }
]

export type ExpressionSchema =
  | { [key: string]: AttributeAndValueSchema | { var: { path: string } } }
  | {
      not: {
        [key: string]: AttributeAndValueSchema | { var: { path: string } }
      }
    }

export type GroupSchema =
  | { or: ExpressionSchema[] }
  | { and: ExpressionSchema[] }

export type AudienceFiltersSchema = {
  filter: [GroupSchema[] | { or: GroupSchema[] } | { and: GroupSchema[] }]
}

/* Type guards (web-app shapes — copied verbatim so parsing matches). */

export const isOrRuleGroup = <T>(
  group: { or?: T } | { and?: T }
): group is { or: T } => (group as { or?: T }).or !== undefined

export const isAndRuleGroup = <T>(
  group: { or?: T } | { and?: T }
): group is { and: T } => (group as { and?: T }).and !== undefined

const isOperatorFound = (operator: string) => (item: string) =>
  item === operator

export const defineOperatorPrecedence = (
  operator: string
): "high" | "low" | undefined => {
  if (highPrecedenceOperators.some(isOperatorFound(operator))) return "high"
  if (lowPrecedenceOperators.some(isOperatorFound(operator))) return "low"
  if (semverOperators.some(isOperatorFound(operator))) return "low"
  return undefined
}

export const defineOperatorType = (
  operator: string
): "unary" | "binary" | undefined => {
  if (unaryOperators.some(isOperatorFound(operator))) return "unary"
  if (binaryOperators.some(isOperatorFound(operator))) return "binary"
  if (semverOperators.some(isOperatorFound(operator))) return "binary"
  return undefined
}
