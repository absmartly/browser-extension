import { act, fireEvent, render, screen } from "@testing-library/react"
import React, { useState } from "react"

import "@testing-library/jest-dom"

import type { AIProviderType } from "~src/lib/ai-providers"

import { AIProviderSection } from "../AIProviderSection"

jest.mock("~src/lib/claude-code-client", () => ({
  ClaudeCodeBridgeClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    getConnection: jest.fn(),
    testEndpoint: jest.fn(),
    clearCustomEndpoint: jest.fn()
  })),
  ConnectionState: {
    NOT_CONFIGURED: "not_configured",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    CONNECTION_FAILED: "connection_failed",
    SERVER_NOT_FOUND: "server_not_found"
  },
  getConnectionStateMessage: () => ""
}))

function Harness({ provider }: { provider: AIProviderType }) {
  const [aiApiKey, setAiApiKey] = useState("")
  const [llmModel, setLlmModel] = useState("")
  const [providerModels, setProviderModels] = useState({})
  const [customEndpoint, setCustomEndpoint] = useState("")
  const [providerEndpoints, setProviderEndpoints] = useState({})
  return (
    <AIProviderSection
      aiProvider={provider}
      aiApiKey={aiApiKey}
      llmModel={llmModel}
      providerModels={providerModels}
      customEndpoint={customEndpoint}
      providerEndpoints={providerEndpoints}
      onAiProviderChange={() => {}}
      onAiApiKeyChange={setAiApiKey}
      onLlmModelChange={setLlmModel}
      onProviderModelsChange={setProviderModels}
      onCustomEndpointChange={setCustomEndpoint}
      onProviderEndpointsChange={setProviderEndpoints}
    />
  )
}

// Types one character at a time into whatever element is focused, like a
// keyboard does, so a remounted input (which loses focus) is detected.
async function typeIntoFocused(text: string) {
  let value = ""
  for (const char of text) {
    const active = document.activeElement as HTMLInputElement
    value = active.value + char
    await act(async () => {
      fireEvent.change(active, { target: { value } })
    })
  }
}

describe("AIProviderSection typing", () => {
  beforeEach(() => {
    ;(global as any).chrome.permissions = {
      contains: jest.fn().mockResolvedValue(false)
    }
  })

  it.each(["openai-api", "anthropic-api", "openrouter-api", "gemini-api"])(
    "keeps the %s API key input mounted and focused while typing",
    async (provider) => {
      render(<Harness provider={provider as AIProviderType} />)
      const input = document.getElementById("ai-api-key") as HTMLInputElement
      input.focus()
      await typeIntoFocused("sk-synthetic")
      expect(document.getElementById("ai-api-key")).toBe(input)
      expect(input).toHaveFocus()
      expect(input).toHaveValue("sk-synthetic")
    }
  )

  it("keeps the custom endpoint disclosure open and focused while typing", async () => {
    render(<Harness provider="openai-api" />)
    const key = document.getElementById("ai-api-key") as HTMLInputElement
    key.focus()
    await typeIntoFocused("sk-synthetic")

    const input = document.getElementById(
      "custom-openai-api-endpoint"
    ) as HTMLInputElement
    const details = input.closest("details") as HTMLDetailsElement
    details.open = true
    input.focus()
    await typeIntoFocused("https://llm")

    expect(document.getElementById("custom-openai-api-endpoint")).toBe(input)
    expect(input).toHaveFocus()
    expect(input).toHaveValue("https://llm")
    expect(screen.getByDisplayValue("https://llm").closest("details")).toBe(
      details
    )
    expect(details.open).toBe(true)
  })
})
