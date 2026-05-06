import type { ToolDefinition } from "./base"

export const EXPERIMENT_FILL_TOOL_SCHEMA: ToolDefinition & {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, any>
    required: string[]
  }
} = {
  name: "fill_experiment_fields",
  description:
    "Fill the ABsmartly experiment Create/Edit form with high-quality, " +
    "consistent values based on the page context, the user's draft, any " +
    "DOM changes already authored, and the per-variant before/after screenshots.",
  input_schema: {
    type: "object",
    properties: {
      display_name: {
        type: "string",
        description: "Human-readable experiment name. Title case, no quotes."
      },
      name: {
        type: "string",
        description:
          "Machine-friendly experiment name. Lowercase, snake_case, ASCII only."
      },
      hypothesis: {
        type: "string",
        description:
          "We believe that {change} will cause {metric} to {direction} for " +
          "{audience} because {reason}. 1–3 sentences."
      },
      prediction: {
        type: "string",
        description:
          "Quantitative prediction with directionality and confidence. 1–2 sentences."
      },
      description: {
        type: "string",
        description:
          "What is being changed and why. 2–4 sentences. Plain English."
      },
      percentage_of_traffic: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description:
          "Suggested traffic %. Default 100 unless the page suggests a smaller rollout."
      },
      percentages: {
        type: "string",
        pattern: "^\\d+(/\\d+)+$",
        description:
          'Slash-separated allocation summing to 100. Example: "50/50" or "34/33/33".'
      },
      audience: {
        type: "string",
        description:
          'JSON-encoded audience filter, e.g. \'{"filter":[{"and":[]}]}\'. ' +
          "Leave the default empty filter unless the page strongly implies a segment."
      },
      audience_strict: {
        type: "boolean",
        description: "Whether the audience filter is strict."
      },
      applications: {
        type: "array",
        items: { type: "string" },
        description:
          "Names of applications this experiment targets. Pick only from the list provided in the user message."
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Tag names that classify this experiment. Pick only from the list provided in the user message."
      },
      variants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Variant name. Keep 'Control' for variant index 0 unless told otherwise."
            },
            description: {
              type: "string",
              description: "Short label describing what this variant changes."
            }
          },
          required: ["name"]
        },
        description:
          "One entry per variant in the order Control, Variant 1, Variant 2, ..."
      },
      custom_fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field_name: { type: "string" },
            value: {
              description:
                "Value matching the field's declared type: string for text/select/string, " +
                "string[] for multiselect, boolean for boolean, number for number, " +
                "JSON-string for json."
            }
          },
          required: ["field_name", "value"]
        },
        description:
          "Values for the workspace's custom section fields. Only include fields " +
          "listed in the customFieldDefinitions section of the user message."
      }
    },
    required: ["display_name"]
  }
}
