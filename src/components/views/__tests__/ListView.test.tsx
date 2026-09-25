import { render } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { ListView } from "../ListView"

jest.mock("~src/hooks/useSDKStatus", () => ({
  useSDKStatus: () => ({ sdkDetected: true, checking: false, checked: true })
}))
jest.mock("~src/components/ExperimentFilter", () => ({
  ExperimentFilter: () => null
}))
jest.mock("~src/components/ExperimentList", () => ({
  ExperimentList: () => null
}))
jest.mock("~src/components/Pagination", () => ({
  Pagination: () => null
}))
jest.mock("~src/components/CreateExperimentDropdown", () => ({
  CreateExperimentDropdown: () => <button id="create-experiment-menu-button" />,
  CreateExperimentDropdownPanel: () => null
}))
jest.mock("~src/components/Logo", () => ({ Logo: () => null }))

const noop = () => {}

function renderListView() {
  return render(
    <ListView
      config={null}
      filteredExperiments={[]}
      experimentsLoading={false}
      favoriteExperiments={new Set()}
      filters={null}
      applications={[]}
      currentPage={1}
      pageSize={50}
      totalExperiments={0}
      hasMore={false}
      error={null}
      isAuthenticated={true}
      createPanelOpen={false}
      templates={[]}
      templatesLoading={false}
      templateSearchQuery=""
      onExperimentClick={noop}
      onToggleFavorite={noop}
      onFilterChange={noop}
      onPageChange={noop}
      onPageSizeChange={noop}
      onRefresh={noop}
      onCreateFromScratch={noop}
      onCreateFromTemplate={noop}
      onLoginRedirect={noop}
      setCurrentPage={noop}
      setView={noop}
      setCreatePanelOpen={noop}
      setTemplateSearchQuery={noop}
      loadExperiments={async () => {}}
    />
  )
}

describe("ListView header", () => {
  it("keeps the heading and all actions inside one wrapping header row", () => {
    const { container } = renderListView()
    const header = container.querySelector("#experiments-list-header")!
    expect(header).toHaveClass("flex-wrap")
    for (const id of [
      "experiments-heading",
      "refresh-experiments-button",
      "create-experiment-menu-button",
      "nav-events",
      "nav-settings"
    ]) {
      expect(header.querySelector(`#${id}`)).toBeInTheDocument()
    }
  })

  // E2E specs locate the list with "#experiments-header, h1:has-text(...)";
  // a wrapper reusing that id makes the locator ambiguous (strict mode).
  it("does not reuse the experiments-header id for the header wrapper", () => {
    const { container } = renderListView()
    expect(container.querySelector("#experiments-header")).toBeNull()
  })
})
