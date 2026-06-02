import { EXPERIMENT_FILL_TOOL_SCHEMA } from "~src/lib/ai-providers/experiment-fill-schema"

describe("EXPERIMENT_FILL_TOOL_SCHEMA", () => {
  it("declares the expected tool name and required fields", () => {
    expect(EXPERIMENT_FILL_TOOL_SCHEMA.name).toBe("fill_experiment_fields")
    const props = EXPERIMENT_FILL_TOOL_SCHEMA.input_schema.properties
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining([
        "display_name",
        "name",
        "hypothesis",
        "prediction",
        "description",
        "percentage_of_traffic",
        "percentages",
        "audience",
        "audience_strict",
        "applications",
        "tags",
        "variants",
        "custom_fields"
      ])
    )
    expect(EXPERIMENT_FILL_TOOL_SCHEMA.input_schema.required).toContain(
      "display_name"
    )
  })

  it("nests variants with name + description", () => {
    const variants =
      EXPERIMENT_FILL_TOOL_SCHEMA.input_schema.properties.variants
    expect(variants.type).toBe("array")
    expect(variants.items.properties).toHaveProperty("name")
    expect(variants.items.properties).toHaveProperty("description")
  })

  it("declares custom_fields as an array of {field_id,value}", () => {
    const cf = EXPERIMENT_FILL_TOOL_SCHEMA.input_schema.properties.custom_fields
    expect(cf.type).toBe("array")
    expect(cf.items.required).toEqual(
      expect.arrayContaining(["field_id", "value"])
    )
    expect(cf.items.properties.field_id.type).toBe("integer")
  })
})
