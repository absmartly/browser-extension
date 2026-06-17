import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import { AutocompleteInput } from "../AutocompleteInput"

import "@testing-library/jest-dom"

function renderControlled({
  fetchOptions,
  initialValue = "",
  debounceMs
}: {
  fetchOptions: (prefix: string) => Promise<string[]>
  initialValue?: string
  debounceMs?: number
}) {
  function Wrapper() {
    const [value, setValue] = React.useState(initialValue)
    return (
      <AutocompleteInput
        id="my-input"
        data-testid="my-input"
        placeholder="Type something"
        value={value}
        onChange={setValue}
        fetchOptions={fetchOptions}
        debounceMs={debounceMs}
      />
    )
  }
  return render(<Wrapper />)
}

describe("AutocompleteInput", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders an input with the provided id, placeholder, and value", () => {
    renderControlled({
      fetchOptions: jest.fn().mockResolvedValue([]),
      initialValue: "hello"
    })

    const input = screen.getByTestId("my-input") as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe("hello")
    expect(input.placeholder).toBe("Type something")
    expect(input.id).toBe("my-input")
  })

  it("opens dropdown on focus and shows suggestions returned by fetchOptions", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue(["country", "city"])

    renderControlled({ fetchOptions })

    const input = screen.getByTestId("my-input")
    fireEvent.focus(input)

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchOptions).toHaveBeenCalledWith("")
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument()
      expect(screen.getByText("country")).toBeInTheDocument()
      expect(screen.getByText("city")).toBeInTheDocument()
    })
  })

  it("debounces fetchOptions while typing", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue([])

    renderControlled({ fetchOptions, debounceMs: 250 })

    const input = screen.getByTestId("my-input")
    fireEvent.focus(input)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchOptions).toHaveBeenCalledTimes(1)
    expect(fetchOptions).toHaveBeenLastCalledWith("")

    fireEvent.change(input, { target: { value: "c" } })
    fireEvent.change(input, { target: { value: "co" } })
    fireEvent.change(input, { target: { value: "cou" } })

    expect(fetchOptions).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchOptions).toHaveBeenCalledTimes(2)
    expect(fetchOptions).toHaveBeenLastCalledWith("cou")
  })

  it("calls onChange with the option value when an option is clicked", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue(["alpha", "beta"])

    const onChange = jest.fn()
    render(
      <AutocompleteInput
        id="picky"
        data-testid="picky"
        placeholder=""
        value=""
        onChange={onChange}
        fetchOptions={fetchOptions}
      />
    )

    fireEvent.focus(screen.getByTestId("picky"))
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => screen.getByText("beta"))
    fireEvent.mouseDown(screen.getByText("beta"))

    expect(onChange).toHaveBeenCalledWith("beta")
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })
  })

  it("closes the dropdown on Escape", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue(["one"])

    renderControlled({ fetchOptions })

    const input = screen.getByTestId("my-input")
    fireEvent.focus(input)
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => screen.getByRole("listbox"))

    fireEvent.keyDown(input, { key: "Escape" })

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })
  })

  it("lets the user type free text even when fetchOptions returns nothing", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue([])

    const onChange = jest.fn()
    render(
      <AutocompleteInput
        id="freetext"
        data-testid="freetext"
        placeholder=""
        value=""
        onChange={onChange}
        fetchOptions={fetchOptions}
      />
    )

    const input = screen.getByTestId("freetext")
    fireEvent.change(input, { target: { value: "custom.attr.path" } })
    expect(onChange).toHaveBeenCalledWith("custom.attr.path")
  })

  it("still allows typing when fetchOptions rejects", async () => {
    const fetchOptions = jest
      .fn<Promise<string[]>, [string]>()
      .mockRejectedValue(new Error("offline"))

    const onChange = jest.fn()
    render(
      <AutocompleteInput
        id="erroring"
        data-testid="erroring"
        placeholder=""
        value=""
        onChange={onChange}
        fetchOptions={fetchOptions}
      />
    )

    const input = screen.getByTestId("erroring")
    fireEvent.focus(input)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.change(input, { target: { value: "manual value" } })

    expect(onChange).toHaveBeenCalledWith("manual value")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })
})
