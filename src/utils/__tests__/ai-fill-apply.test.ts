import {
  applyAIResultToDraft,
  applyAIVariantNames,
  type AIApplyDraft
} from "~src/utils/ai-fill-apply"

const baseDraft: AIApplyDraft = {
  name: "my_test",
  display_name: "My Test",
  percentage_of_traffic: 100,
  percentages: "50/50",
  audience_strict: false,
  audience: '{"filter":[{"and":[]}]}',
  application_ids: [],
  tag_ids: [],
  primary_metric_id: null,
  secondary_metric_ids: [],
  customFieldValues: {}
}

describe("applyAIResultToDraft", () => {
  it("overwrites string/number scalars when present", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      {
        display_name: "Renamed",
        name: "renamed",
        percentage_of_traffic: 50,
        percentages: "33/33/34",
        audience: '{"filter":[{"and":[{"k":"v"}]}]}',
        audience_strict: true
      },
      [],
      [],
      [],
      []
    )
    expect(next.display_name).toBe("Renamed")
    expect(next.name).toBe("renamed")
    expect(next.percentage_of_traffic).toBe(50)
    expect(next.percentages).toBe("33/33/34")
    expect(next.audience).toBe('{"filter":[{"and":[{"k":"v"}]}]}')
    expect(next.audience_strict).toBe(true)
  })

  it("never mutates the input draft", () => {
    const before = JSON.stringify(baseDraft)
    applyAIResultToDraft(baseDraft, { display_name: "Stamped" }, [], [], [], [])
    expect(JSON.stringify(baseDraft)).toBe(before)
  })

  it("maps AI applications by name to application_ids and drops unknown names", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      { applications: ["Web", "Android", "MysteryPlatform"] },
      [],
      [
        { application_id: 11, name: "Web" },
        { application_id: 22, name: "iOS" },
        { application_id: 33, name: "Android" }
      ] as any,
      [],
      []
    )
    expect(next.application_ids).toEqual([11, 33])
  })

  it("does not stomp existing application_ids when AI returns no applications", () => {
    const draft = { ...baseDraft, application_ids: [42] }
    const next = applyAIResultToDraft(
      draft,
      { display_name: "Just a rename" },
      [],
      [{ application_id: 11, name: "Web" }] as any,
      [],
      []
    )
    expect(next.application_ids).toEqual([42])
  })

  it("maps AI tags by name to tag_ids and drops unknown names", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      { tags: ["checkout", "ghost-tag", "mobile"] },
      [],
      [],
      [
        { experiment_tag_id: 100, name: "checkout" },
        { experiment_tag_id: 200, name: "mobile" }
      ] as any,
      []
    )
    expect(next.tag_ids).toEqual([100, 200])
  })

  it("maps AI primary_metrics name to primary_metric_id (first match wins)", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      { primary_metrics: ["Unknown", "Conversion Rate"] },
      [],
      [],
      [],
      [
        { metric_id: 11, name: "Conversion Rate" },
        { metric_id: 22, name: "Revenue per User" }
      ] as any
    )
    expect(next.primary_metric_id).toBe(11)
  })

  it("maps AI secondary_metrics and dedupes the primary metric out", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      {
        primary_metrics: ["Conversion Rate"],
        secondary_metrics: [
          "Revenue per User",
          "Conversion Rate",
          "Bounce Rate",
          "Unknown"
        ]
      },
      [],
      [],
      [],
      [
        { metric_id: 11, name: "Conversion Rate" },
        { metric_id: 22, name: "Revenue per User" },
        { metric_id: 33, name: "Bounce Rate" }
      ] as any
    )
    expect(next.primary_metric_id).toBe(11)
    expect(next.secondary_metric_ids).toEqual([22, 33])
  })

  it("merges AI custom_fields keyed by id and drops unknown ids", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      {
        custom_fields: [
          { field_id: 7, value: "Bigger CTAs help conversion" },
          { field_id: 999, value: "should be dropped" }
        ]
      },
      [
        {
          id: 7,
          custom_section_field_id: 7,
          title: "Hypothesis",
          type: "text",
          required: true
        } as any
      ],
      [],
      [],
      []
    )
    expect(next.customFieldValues).toEqual({
      "7": "Bigger CTAs help conversion"
    })
  })

  it("maps top-level hypothesis/prediction/description into customFieldValues by title match", () => {
    const next = applyAIResultToDraft(
      baseDraft,
      {
        hypothesis: "It will lift CR",
        prediction: "+5%",
        description: "context"
      },
      [
        { id: 1, title: "Hypothesis", type: "text" } as any,
        { id: 2, title: "Prediction", type: "text" } as any,
        { id: 3, title: "Description", type: "text" } as any
      ],
      [],
      [],
      []
    )
    expect(next.customFieldValues).toEqual({
      "1": "It will lift CR",
      "2": "+5%",
      "3": "context"
    })
  })
})

describe("applyAIVariantNames", () => {
  it("renames variants positionally and returns a new array", () => {
    const out = applyAIVariantNames(
      [
        { name: "Control", config: "{}" },
        { name: "Variant 1", config: "{}" }
      ],
      [{ name: "Original" }, { name: "New CTA Copy" }]
    )
    expect(out).toEqual([
      { name: "Original", config: "{}" },
      { name: "New CTA Copy", config: "{}" }
    ])
  })

  it("returns null when nothing changed (identical names)", () => {
    expect(
      applyAIVariantNames(
        [{ name: "A" }, { name: "B" }],
        [{ name: "A" }, { name: "B" }]
      )
    ).toBeNull()
  })

  it("returns null when no AI variants supplied", () => {
    expect(applyAIVariantNames([{ name: "A" }], [])).toBeNull()
  })

  it("keeps extras when AI returns fewer variants than exist", () => {
    const out = applyAIVariantNames(
      [
        { name: "Control", config: "{}" },
        { name: "Variant 1", config: "{}" },
        { name: "Variant 2", config: "{}" }
      ],
      [{ name: "Original" }]
    )
    expect(out).toEqual([
      { name: "Original", config: "{}" },
      { name: "Variant 1", config: "{}" },
      { name: "Variant 2", config: "{}" }
    ])
  })

  it("ignores AI extras when more variants are supplied than exist", () => {
    const out = applyAIVariantNames(
      [
        { name: "Control", config: "{}" },
        { name: "Variant 1", config: "{}" }
      ],
      [
        { name: "Original" },
        { name: "New CTA Copy" },
        { name: "Bonus Variant" }
      ]
    )
    expect(out).toEqual([
      { name: "Original", config: "{}" },
      { name: "New CTA Copy", config: "{}" }
    ])
  })

  it("leaves existing names in place when AI provides empty/missing/non-string", () => {
    const out = applyAIVariantNames(
      [
        { name: "Control", config: "{}" },
        { name: "Variant 1", config: "{}" },
        { name: "Variant 2", config: "{}" }
      ],
      [
        { name: "" },
        { description: "no name field" } as any,
        { name: "Real Rename" }
      ]
    )
    expect(out).toEqual([
      { name: "Control", config: "{}" },
      { name: "Variant 1", config: "{}" },
      { name: "Real Rename", config: "{}" }
    ])
  })
})
