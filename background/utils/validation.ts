import { z } from 'zod'

/**
 * Validation utilities for background script
 * All Zod schemas for validating input data from content scripts and sidebar
 */

/**
 * Schema for validating ABsmartly configuration
 * Ensures all config parameters meet security and format requirements
 */
export const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url(),
  applicationId: z.number().int().positive().optional(),
  authMethod: z.enum(['jwt', 'apikey']).optional(),
  domChangesFieldName: z.string().optional(),
  sdkEndpoint: z.string().url().optional(),
  queryPrefix: z.string().optional(),
  persistQueryToCookie: z.boolean().optional(),
  injectSDK: z.boolean().optional(),
  sdkUrl: z.string().url().optional()
})

/**
 * Schema for validating API request parameters
 * Prevents invalid HTTP methods and empty paths
 */
export const APIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
  path: z.string().min(1),
  data: z.any().optional()
})

/**
 * Type inference from schemas
 */
export type ValidatedConfig = z.infer<typeof ConfigSchema>
export type ValidatedAPIRequest = z.infer<typeof APIRequestSchema>

/**
 * Validates ABsmartly configuration object
 * @param config - Configuration object to validate
 * @returns Validated configuration or throws ZodError
 */
export function validateConfig(config: unknown): ValidatedConfig {
  return ConfigSchema.parse(config)
}

/**
 * Validates API request parameters
 * @param request - API request object to validate
 * @returns Validated request or throws ZodError
 */
export function validateAPIRequest(request: unknown): ValidatedAPIRequest {
  return APIRequestSchema.parse(request)
}

/**
 * Safe validation that returns result object instead of throwing
 * @param config - Configuration object to validate
 * @returns Result with success flag and data or error
 */
export function safeValidateConfig(config: unknown) {
  return ConfigSchema.safeParse(config)
}

/**
 * Safe validation for API requests
 * @param request - API request object to validate
 * @returns Result with success flag and data or error
 */
export function safeValidateAPIRequest(request: unknown) {
  return APIRequestSchema.safeParse(request)
}
