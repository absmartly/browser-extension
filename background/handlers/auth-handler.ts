import { Storage } from "@plasmohq/storage"
import axios from "axios"
import type { ABsmartlyConfig } from "~src/types/absmartly"
import { debugLog, debugError } from "~src/utils/debug"

const storage = new Storage()
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

const ALLOWED_API_DOMAINS = ["absmartly.com", "absmartly.io"]

/**
 * Validates that an API endpoint is from an allowed domain to prevent token leakage
 */
export function validateAPIEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname

    const isAllowed = ALLOWED_API_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      debugError(`[Security] Invalid API endpoint domain: ${hostname}. Only ${ALLOWED_API_DOMAINS.join(", ")} domains are allowed.`)
      return false
    }

    return true
  } catch (e) {
    debugError("[Security] Failed to parse API endpoint URL:", e)
    return false
  }
}

/**
 * Gets configuration from storage, including API key from secure storage
 */
export async function getConfig(): Promise<ABsmartlyConfig | null> {
  const config = await storage.get("absmartly-config") as ABsmartlyConfig | null

  if (config) {
    const secureApiKey = await secureStorage.get("absmartly-apikey") as string | null
    config.apiKey = secureApiKey || config.apiKey || ""

    if (config.apiEndpoint && !validateAPIEndpoint(config.apiEndpoint)) {
      throw new Error("Invalid API endpoint: Only ABsmartly domains are allowed")
    }
  }

  return config
}

/**
 * Checks if an error response indicates authentication failure
 */
export function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

/**
 * Retrieves JWT token from browser cookies for a given domain
 * Tries multiple strategies to find the JWT cookie
 */
export async function getJWTCookie(domain: string): Promise<string | null> {
  try {
    debugLog("=== getJWTCookie START ===")
    debugLog("Input domain:", domain)

    let parsedUrl: URL
    try {
      parsedUrl = new URL(domain.startsWith("http") ? domain : `https://${domain}`)
    } catch (e) {
      debugError("Failed to parse URL:", domain, e)
      return null
    }

    const hostname = parsedUrl.hostname
    const protocol = parsedUrl.protocol
    const baseUrl = `${protocol}//${hostname}`

    debugLog("Parsed URL:", { hostname, protocol, baseUrl })

    debugLog("Strategy 1: Fetching cookies for exact URL:", baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog(`Found ${urlCookies.length} cookies for URL ${baseUrl}`)

    if (urlCookies.length > 0) {
      debugLog("URL cookies:", urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    const domainParts = hostname.split(".")
    const baseDomain = domainParts.length > 2
      ? domainParts.slice(-2).join(".")
      : hostname

    debugLog("Strategy 2: Fetching cookies for base domain:", baseDomain)
    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    debugLog(`Found ${domainCookies.length} cookies for domain ${baseDomain}`)

    if (domainCookies.length > 0) {
      debugLog("Domain cookies:", domainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    debugLog("Strategy 3: Fetching cookies for .domain:", `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog(`Found ${dotDomainCookies.length} cookies for .${baseDomain}`)

    if (dotDomainCookies.length > 0) {
      debugLog(".Domain cookies:", dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog(`Total unique cookies found: ${uniqueCookies.length}`)

    let jwtCookie = uniqueCookies.find(cookie =>
      cookie.name === "jwt" ||
      cookie.name === "JWT" ||
      cookie.name === "access_token" ||
      cookie.name === "auth_token" ||
      cookie.name === "authorization"
    )

    if (!jwtCookie) {
      jwtCookie = uniqueCookies.find(cookie => {
        const value = cookie.value
        return value && value.includes(".") && value.split(".").length === 3
      })
    }

    if (jwtCookie) {
      debugLog(`✅ JWT cookie found: ${jwtCookie.name} (length: ${jwtCookie.value.length}, domain: ${jwtCookie.domain})`)
      debugLog("=== getJWTCookie END (SUCCESS) ===")
      return jwtCookie.value
    }

    debugLog("❌ No JWT cookie found")
    debugLog("=== getJWTCookie END (NOT FOUND) ===")
    return null
  } catch (error) {
    debugError("Error getting JWT cookie:", error)
    return null
  }
}

/**
 * Opens the ABsmartly login page in a new tab
 * Only opens if user is not already authenticated
 */
export async function openLoginPage(): Promise<{ authenticated: boolean }> {
  const config = await getConfig()
  if (!config?.apiEndpoint) {
    return { authenticated: false }
  }

  let baseUrl = config.apiEndpoint.replace(/\/v1$/, "")
  if (baseUrl.includes("/api/")) {
    baseUrl = baseUrl.substring(0, baseUrl.indexOf("/api"))
  } else if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 4)
  }

  try {
    const authResponse = await makeAPIRequest("GET", "/auth/current-user", undefined, false)

    if (authResponse.ok) {
      debugLog("User is already authenticated")
      return { authenticated: true }
    }
  } catch (error) {
    debugLog("Auth check failed, user needs to login:", error)
  }

  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

/**
 * Makes an authenticated API request with automatic JWT/API key fallback
 * @param method HTTP method
 * @param path API path (e.g., /experiments)
 * @param data Request body data
 * @param retryWithJWT Whether to retry with alternate auth method on 401
 */
export async function makeAPIRequest(
  method: string,
  path: string,
  data?: any,
  retryWithJWT: boolean = true
) {
  debugLog("=== makeAPIRequest called ===", { method, path, data })

  const config = await getConfig()
  debugLog("Config loaded:", {
    hasApiKey: !!config?.apiKey,
    apiEndpoint: config?.apiEndpoint,
    apiKeyLength: config?.apiKey?.length || 0,
    authMethod: config?.authMethod || "jwt"
  })

  if (!config?.apiEndpoint) {
    throw new Error("No API endpoint configured")
  }

  const authMethod = config.authMethod || "jwt"
  const shouldTryJwtFirst = authMethod === "jwt"

  const buildHeaders = async (useApiKey: boolean = true) => {
    const headers: any = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }

    if (shouldTryJwtFirst) {
      debugLog("Using JWT authentication method...")
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      debugLog("JWT cookie result:", jwtToken ? `Found (length: ${jwtToken.length}, preview: ${jwtToken.substring(0, 20)}...)` : "Not found")

      if (jwtToken) {
        if (jwtToken.includes(".") && jwtToken.split(".").length === 3) {
          headers["Authorization"] = `JWT ${jwtToken}`
        } else {
          headers["Authorization"] = `Bearer ${jwtToken}`
        }
        debugLog("Using JWT from browser cookie, Authorization header:", headers["Authorization"].substring(0, 30) + "...")
      } else {
        debugLog("No JWT cookie available - user may need to log in to ABsmartly")
      }
      return headers
    } else {
      if (config.apiKey && useApiKey) {
        debugLog("Using API key authentication method")
        const authHeader = config.apiKey.includes(".") && config.apiKey.split(".").length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        headers["Authorization"] = authHeader
      } else if (!config.apiKey) {
        debugLog("No API key provided, attempting JWT fallback...")
        const jwtToken = await getJWTCookie(config.apiEndpoint)
        if (jwtToken) {
          if (jwtToken.includes(".") && jwtToken.split(".").length === 3) {
            headers["Authorization"] = `JWT ${jwtToken}`
          } else {
            headers["Authorization"] = `Bearer ${jwtToken}`
          }
          debugLog("Using JWT from cookie as fallback")
        } else {
          debugLog("No authentication method available")
        }
      }
    }

    return headers
  }

  const headers = await buildHeaders()

  const cleanEndpoint = config.apiEndpoint.replace(/\/+$/, "")

  const baseURL = cleanEndpoint.endsWith("/v1")
    ? cleanEndpoint
    : `${cleanEndpoint}/v1`

  const cleanPath = path.startsWith("/") ? path : `/${path}`
  let url = `${baseURL}${cleanPath}`
  let requestData = undefined

  if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
    if (data && Object.keys(data).length > 0) {
      const params = new URLSearchParams()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      url += "?" + params.toString()
    }
  } else {
    requestData = data
  }

  debugLog("Making axios request:", {
    method,
    url,
    requestData,
    authorization: headers.Authorization || "None"
  })

  try {
    const response = await axios({
      method,
      url,
      data: requestData,
      headers,
      withCredentials: false
    })

    return response.data
  } catch (error) {
    debugError("Request failed:", error.response?.status, error.response?.data)

    if (isAuthError(error) && retryWithJWT) {
      if (authMethod === "apikey" && headers.Authorization?.startsWith("Api-Key")) {
        debugLog("API key auth failed (401), retrying with JWT cookie...")

        const jwtToken = await getJWTCookie(config.apiEndpoint)

        if (jwtToken) {
          const newHeaders: any = {
            "Content-Type": "application/json",
            "Accept": "application/json"
          }

          if (jwtToken.includes(".") && jwtToken.split(".").length === 3) {
            newHeaders["Authorization"] = `JWT ${jwtToken}`
          } else {
            newHeaders["Authorization"] = `Bearer ${jwtToken}`
          }

          debugLog("Retrying with JWT authorization:", newHeaders.Authorization)

          try {
            const response = await axios({
              method,
              url,
              data: requestData,
              headers: newHeaders,
              withCredentials: false
            })

            debugLog("JWT fallback successful!")
            return response.data
          } catch (jwtError) {
            debugError("JWT fallback also failed:", jwtError.response?.status)
            throw new Error("AUTH_EXPIRED")
          }
        } else {
          debugLog("No JWT cookie available for retry")
        }
      }
      else if (authMethod === "jwt" && config.apiKey && !headers.Authorization?.startsWith("Api-Key")) {
        debugLog("JWT auth failed (401), retrying with API key...")

        const newHeaders: any = {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }

        const authHeader = config.apiKey.includes(".") && config.apiKey.split(".").length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        newHeaders["Authorization"] = authHeader

        debugLog("Retrying with API key authorization")

        try {
          const response = await axios({
            method,
            url,
            data: requestData,
            headers: newHeaders,
            withCredentials: false
          })

          debugLog("API key fallback successful!")
          return response.data
        } catch (apiKeyError) {
          debugError("API key fallback also failed:", apiKeyError.response?.status)
          throw new Error("AUTH_EXPIRED")
        }
      }
    }

    if (isAuthError(error)) {
      throw new Error("AUTH_EXPIRED")
    }
    throw error
  }
}
