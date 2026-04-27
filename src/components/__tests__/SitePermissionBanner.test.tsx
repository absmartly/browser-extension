import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import type { ActiveSitePermissionState } from "~src/hooks/useActiveSitePermission"

import { SitePermissionBanner } from "../SitePermissionBanner"

const makePermission = (
  overrides: Partial<ActiveSitePermissionState> = {}
): ActiveSitePermissionState => ({
  originPattern: "https://example.com/*",
  host: "example.com",
  checked: true,
  hasPermission: false,
  requestPermission: jest.fn().mockResolvedValue(true),
  ...overrides
})

describe("SitePermissionBanner", () => {
  it("renders nothing before the initial check completes", () => {
    const { container } = render(
      <SitePermissionBanner permission={makePermission({ checked: false })} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when permission is already granted", () => {
    const { container } = render(
      <SitePermissionBanner
        permission={makePermission({ hasPermission: true })}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing on schemes where host permission does not apply (chrome://, etc.)", () => {
    const { container } = render(
      <SitePermissionBanner
        permission={makePermission({ host: null, originPattern: null })}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the permission prompt with the active host when permission is missing", () => {
    render(<SitePermissionBanner permission={makePermission()} />)
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "site-permission-banner"
    )
    expect(screen.getByText(/Grant access to example\.com/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Grant access/i })).toBeEnabled()
  })

  it("invokes requestPermission when the Grant access button is clicked", async () => {
    const requestPermission = jest.fn().mockResolvedValue(true)
    render(
      <SitePermissionBanner
        permission={makePermission({ requestPermission })}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Grant access/i }))
    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
  })

  it("surfaces a denial message when the user rejects the native prompt", async () => {
    const requestPermission = jest.fn().mockResolvedValue(false)
    render(
      <SitePermissionBanner
        permission={makePermission({ requestPermission })}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Grant access/i }))
    await waitFor(() =>
      expect(
        screen.getByText(/Permission was not granted/i)
      ).toBeInTheDocument()
    )
  })
})
