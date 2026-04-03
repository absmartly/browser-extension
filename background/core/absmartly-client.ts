import { APIClient, createAPIClient } from "@absmartly/cli/api-client"
import type {
  HttpClient,
  HttpRequestConfig,
  HttpResponse,
} from "@absmartly/cli/api-client"
import type { ABsmartlyConfig } from "~src/types/absmartly"
import { withNetworkRetry } from "~src/lib/api-retry"
import { debugWarn, debugError } from "~src/utils/debug"
import { getJWTCookie } from "./api-client"

export type { APIClient }

class ExtensionHttpClient implements HttpClient {
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

      const data = (await fetchResponse.json()) as T

      if (fetchResponse.status === 401 || fetchResponse.status === 403) {
        throw new Error("AUTH_EXPIRED")
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

export function createExtensionClient(config: ABsmartlyConfig): APIClient {
  if (!config.apiEndpoint) {
    throw new Error("No API endpoint configured")
  }

  const http = new ExtensionHttpClient(config.apiEndpoint, config)
  return createAPIClient(http)
}
