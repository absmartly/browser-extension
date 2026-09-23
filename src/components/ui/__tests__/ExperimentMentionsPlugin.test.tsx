import { act, render } from "@testing-library/react"
import React from "react"

import ExperimentMentionsPlugin from "../rich-text/plugins/MentionsPlugin/ExperimentMentionsPlugin"
import { fetchExperimentMentionsPage } from "../rich-text/plugins/MentionsPlugin/mentionData"

let mockOnQueryChange: (query: string | null) => void
jest.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [{ hasNodes: () => false }]
}))
jest.mock("@lexical/react/LexicalTypeaheadMenuPlugin", () => ({
  MenuOption: class {},
  LexicalTypeaheadMenuPlugin: ({ onQueryChange }: any) => {
    mockOnQueryChange = onQueryChange
    return null
  }
}))
jest.mock("../rich-text/plugins/MentionsPlugin/mentionData", () => ({
  fetchExperimentMentionsPage: jest
    .fn()
    .mockResolvedValue({ experiments: [], total: 0 }),
  loadExperimentMentionsByIds: jest.fn()
}))

describe("experiment mention request lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })
  afterEach(() => jest.useRealTimers())

  it("does not fetch an experiment list for each idle custom-field editor", async () => {
    render(
      <>
        {Array.from({ length: 12 }, (_, index) => (
          <ExperimentMentionsPlugin key={index} />
        ))}
      </>
    )
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(fetchExperimentMentionsPage).not.toHaveBeenCalled()
  })

  it("fetches for an active empty # query and search, but not when the menu closes", async () => {
    render(<ExperimentMentionsPlugin />)
    await act(async () => {
      mockOnQueryChange("")
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(fetchExperimentMentionsPage).toHaveBeenCalledWith({
      search: "",
      page: 1,
      items: 15
    })
    await act(async () => {
      mockOnQueryChange("test_owned")
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(fetchExperimentMentionsPage).toHaveBeenLastCalledWith({
      search: "test_owned",
      page: 1,
      items: 15
    })
    const count = (fetchExperimentMentionsPage as jest.Mock).mock.calls.length
    await act(async () => {
      mockOnQueryChange(null)
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(fetchExperimentMentionsPage).toHaveBeenCalledTimes(count)
  })
})
