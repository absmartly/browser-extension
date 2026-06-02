/**
 * Audience filter parse / serialize helpers — port of the Vue app's
 * `AudienceFilters.utils.ts`. The wire format is preserved so audiences
 * written from the extension round-trip through the web console unchanged.
 */

import {
  AudienceFiltersData,
  AudienceFiltersSchema,
  AudienceGroup,
  BinaryOperator,
  defineOperatorPrecedence,
  defineOperatorType,
  ExpressionSchema,
  FilterExpression,
  GroupSchema,
  HighPrecedenceOperator,
  isAndRuleGroup,
  isOrRuleGroup,
  LowPrecedenceOperator
} from "./models"

export const getAudienceFiltersInitialState = (): AudienceFiltersData => ({
  operator: "and",
  groups: []
})

const extractValueAndPath = (
  key: string,
  value: unknown
): { value: string; path: string } => {
  switch (defineOperatorType(key)) {
    case "unary":
      return {
        path: (value as { var: { path: string } }).var.path,
        value: ""
      }
    case "binary":
      return {
        path: (value as [{ var: { path: string } }, { value: string }])[0].var
          .path,
        value: (value as [{ var: { path: string } }, { value: string }])[1]
          .value
      }
    default:
      throw new Error("Used unknown operator: " + key)
  }
}

const parseExpressionFromSchema = (
  expression: ExpressionSchema
): FilterExpression => {
  for (const [key, value] of Object.entries(expression)) {
    switch (defineOperatorPrecedence(key)) {
      case "high":
        return {
          ...parseExpressionFromSchema(value as ExpressionSchema),
          highPrecedenceOperator: key as HighPrecedenceOperator
        }
      case "low":
        return {
          lowPrecedenceOperator: key as LowPrecedenceOperator,
          highPrecedenceOperator: null,
          ...extractValueAndPath(key, value)
        }
      default:
        break
    }
  }
  return {
    highPrecedenceOperator: null,
    lowPrecedenceOperator: "eq",
    path: "",
    value: ""
  }
}

const parseGroupFromSchema = (
  group: GroupSchema,
  key: number
): AudienceGroup => {
  if (Array.isArray(group)) {
    return {
      operator: "and",
      expression: (group as ExpressionSchema[]).map(parseExpressionFromSchema),
      key
    }
  }
  if (isAndRuleGroup(group)) {
    return {
      operator: "and",
      expression: group.and.map(parseExpressionFromSchema),
      key
    }
  }
  if (isOrRuleGroup(group)) {
    return {
      operator: "or",
      expression: group.or.map(parseExpressionFromSchema),
      key
    }
  }
  return { operator: "and", expression: [], key }
}

const parseFiltersFromSchema = (
  filter: AudienceFiltersSchema["filter"]
): AudienceFiltersData => {
  const filters = filter[0]
  if (Array.isArray(filters)) {
    return {
      operator: "and",
      groups: filters.map(parseGroupFromSchema)
    }
  }
  const entries = Object.entries(filters)
  if (entries.length > 0) {
    return {
      operator: entries[0][0] as Extract<BinaryOperator, "and" | "or">,
      groups: (entries[0][1] as GroupSchema[]).map(parseGroupFromSchema)
    }
  }
  return getAudienceFiltersInitialState()
}

export const audienceFiltersFromJSON = (json?: string): AudienceFiltersData => {
  if (!json || !json.trim()) return getAudienceFiltersInitialState()
  try {
    const parsedJSON = JSON.parse(json) as {
      filter?: AudienceFiltersSchema["filter"]
    }
    return parsedJSON.filter
      ? parseFiltersFromSchema(parsedJSON.filter)
      : getAudienceFiltersInitialState()
  } catch {
    return getAudienceFiltersInitialState()
  }
}

const parseFilterToExpression = (data: FilterExpression): ExpressionSchema => {
  const parsedExpr: ExpressionSchema =
    defineOperatorType(data.lowPrecedenceOperator) === "unary"
      ? ({
          [data.lowPrecedenceOperator]: { var: { path: data.path } }
        } as ExpressionSchema)
      : ({
          // var must always be the first argument
          [data.lowPrecedenceOperator]: [
            { var: { path: data.path } },
            { value: data.value }
          ]
        } as ExpressionSchema)

  if (data.highPrecedenceOperator) {
    if (defineOperatorType(data.highPrecedenceOperator) === "unary") {
      return { [data.highPrecedenceOperator]: parsedExpr } as ExpressionSchema
    }
  }
  return parsedExpr
}

export const parseAudienceToSchema = (
  audience: AudienceFiltersData
): AudienceFiltersSchema => {
  const parseFilters = (
    filters: AudienceFiltersData
  ): AudienceFiltersSchema["filter"][number] => {
    const parsedGroups = filters.groups.map((group): GroupSchema => {
      return group.operator === "or"
        ? { or: group.expression.map(parseFilterToExpression) }
        : { and: group.expression.map(parseFilterToExpression) }
    })
    return filters.operator === "or"
      ? { or: parsedGroups }
      : { and: parsedGroups }
  }
  return { filter: [parseFilters(audience)] }
}

export const audienceFiltersToJSON = (audience: AudienceFiltersData): string =>
  JSON.stringify(parseAudienceToSchema(audience))

export const isValidFilter = (filter: FilterExpression): boolean => {
  if (!filter.path || !filter.lowPrecedenceOperator) return false
  // unary "null" operator does not need a value
  if (defineOperatorType(filter.lowPrecedenceOperator) === "unary") return true
  return !!filter.value
}

export const hasErrorsAudienceFilter = (filters: AudienceFiltersData) =>
  filters.groups.some(
    (g) =>
      g.expression.length === 0 || g.expression.some((f) => !isValidFilter(f))
  )

let _key = 0
export const nextKey = (): number => ++_key

export const newExpression = (): FilterExpression => ({
  highPrecedenceOperator: null,
  lowPrecedenceOperator: "eq",
  path: "",
  value: ""
})

export const newGroup = (
  operator: Extract<BinaryOperator, "and" | "or"> = "and"
): AudienceGroup => ({
  key: nextKey(),
  operator,
  expression: [newExpression()]
})
