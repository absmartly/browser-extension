import { act, render } from "@testing-library/react"
import React from "react"

import ExperimentMentionsPlugin from "../rich-text/plugins/MentionsPlugin/ExperimentMentionsPlugin"
import { fetchExperimentMentionsPage } from "../rich-text/plugins/MentionsPlugin/mentionData"

let mockOnQueryChange: (query: string | null) => void
let mockOptions: Array<{ experiment: { id: number } }>
jest.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [{ hasNodes: () => false }]
}))
jest.mock("@lexical/react/LexicalTypeaheadMenuPlugin", () => ({
  MenuOption: class {},
  LexicalTypeaheadMenuPlugin: ({ onQueryChange, options }: any) => {
    mockOnQueryChange = onQueryChange
    mockOptions = options
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

  it("ignores stale search completions and reloads after closing and reopening", async () => {
    const fetchPage = fetchExperimentMentionsPage as jest.Mock
    let resolveOld!: (value: any) => void
    let resolveCurrent!: (value: any) => void
    fetchPage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrent = resolve
          })
      )
    const editor = render(<ExperimentMentionsPlugin />)
    await act(async () => {
      mockOnQueryChange("old")
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      mockOnQueryChange("current")
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      resolveOld({ experiments: [{ id: 1, name: "old" }], total: 1 })
    })
    expect(mockOptions).toEqual([])
    await act(async () => {
      mockOnQueryChange(null)
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      resolveCurrent({ experiments: [{ id: 2, name: "closed" }], total: 1 })
    })
    expect(mockOptions).toEqual([])
    await act(async () => {
      mockOnQueryChange("")
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenLastCalledWith({
      search: "",
      page: 1,
      items: 15
    })
    editor.unmount()
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
