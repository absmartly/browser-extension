import { APIClient, createAPIClient } from "@absmartly/cli/api-client"
import type {
  HttpClient,
  HttpRequestConfig,
  HttpResponse,
} from "@absmartly/cli/api-client"
import type { ABsmartlyConfig } from "~src/types/absmartly"
import { withNetworkRetry } from "~src/lib/api-retry"

export type { APIClient, HttpClient, HttpRequestConfig, HttpResponse }

class AuthExpiredError extends Error {
  constructor() {
    super("AUTH_EXPIRED")
    this.name = "AuthExpiredError"
  }
}

export { AuthExpiredError }

export class ExtensionHttpClient implements HttpClient {
  constructor(
    private endpoint: string,
    private config: ABsmartlyConfig
  ) {}

  getBaseUrl(): string {
    return this.endpoint.replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1"
  }

  async request<T = unknown>(
    config: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...config.headers,
    }

    const authMethod = this.config.authMethod || "jwt"

    if (authMethod === "apikey" && this.config.apiKey) {
      const isJWTFormat =
        this.config.apiKey.includes(".") &&
        this.config.apiKey.split(".").length === 3
      headers["Authorization"] = isJWTFormat
        ? `JWT ${this.config.apiKey}`
        : `Api-Key ${this.config.apiKey}`
    }

    let url = config.url
    if (url.startsWith("/")) {
      url = this.getBaseUrl() + url
    }

    if (config.params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      }
      const qs = searchParams.toString()
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs
      }
    }

    const response = await withNetworkRetry(async () => {
      const fetchResponse = await fetch(url, {
        method: config.method,
        headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
        credentials: "include",
      })

      if (fetchResponse.status === 401 || fetchResponse.status === 403) {
        throw new AuthExpiredError()
      }

      let data: T
      try {
        data = (await fetchResponse.json()) as T
      } catch {
        throw new Error(
          `API returned non-JSON response (status ${fetchResponse.status})`
        )
      }

      if (!fetchResponse.ok) {
        const error = new Error(
          `API request failed with status ${fetchResponse.status}`
        )
        ;(error as any).response = { status: fetchResponse.status, data }
        throw error
      }

      const responseHeaders: Record<string, string> = {}
      fetchResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        status: fetchResponse.status,
        data,
        headers: responseHeaders,
      }
    }, 3)

    return response
  }
}

export function createExtensionHttpClient(
  config: ABsmartlyConfig
): ExtensionHttpClient {
  if (!config.apiEndpoint) {
    throw new Error("No API endpoint configured")
  }
  return new ExtensionHttpClient(config.apiEndpoint, config)
}

export function createExtensionClient(config: ABsmartlyConfig): APIClient {
  if (!config.apiEndpoint) {
    throw new Error("No API endpoint configured")
  }

  const http = new ExtensionHttpClient(config.apiEndpoint, config)
  return createAPIClient(http)
}
