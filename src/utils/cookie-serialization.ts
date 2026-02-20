import type { ExperimentOverrides, OverrideValue } from './overrides'
import { ENV_TYPE } from './overrides'

/**
 * Parse cookie value format: "devEnv=envName|exp1:variant.env.id,exp2:variant"
 * Extracts both overrides and dev environment from cookie string
 */
export function parseCookieValue(cookieValue: string): { overrides: ExperimentOverrides; devEnv?: string } {
  if (!cookieValue) return { overrides: {} }

  let devEnv: string | undefined
  let experimentsStr = cookieValue

  // Check if dev environment is included
  if (cookieValue.startsWith('devEnv=')) {
    const parts = cookieValue.split('|')
    devEnv = decodeURIComponent(parts[0].substring(7))
    experimentsStr = parts[1] || ''
  }

  const overrides: ExperimentOverrides = {}
  if (experimentsStr) {
    const experiments = experimentsStr.split(',')

    for (const exp of experiments) {
      const [name, values] = exp.split(':')
      if (!name || !values) continue

      const decodedName = decodeURIComponent(name)
      const parts = values.split('.')

      if (parts.length === 1) {
        // Simple format: just variant (running experiment)
        overrides[decodedName] = parseInt(parts[0], 10)
      } else if (parts.length === 2) {
        // Format: variant.env
        overrides[decodedName] = {
          variant: parseInt(parts[0], 10),
          env: parseInt(parts[1], 10)
        }
      } else {
        // Full format: variant.env.id
        overrides[decodedName] = {
          variant: parseInt(parts[0], 10),
          env: parseInt(parts[1], 10),
          id: parseInt(parts[2], 10)
        }
      }
    }
  }

  return { overrides, devEnv }
}

/**
 * Serialize a single experiment override to string format
 * Format: "name:variant" or "name:variant.env.id"
 */
function serializeExperiment(name: string, value: number | OverrideValue): string {
  const encodedName = encodeURIComponent(name)

  if (typeof value === 'number') {
    // Simple format for running experiments
    return `${encodedName}:${value}`
  }

  // Extended format with env and optional id
  if (value.env !== undefined && value.env !== ENV_TYPE.PRODUCTION) {
    if (value.id !== undefined) {
      // Full format: variant.env.id
      return `${encodedName}:${value.variant}.${value.env}.${value.id}`
    }
    // Format without id: variant.env
    return `${encodedName}:${value.variant}.${value.env}`
  }

  // Running experiment stored as object (shouldn't happen, but handle it)
  return `${encodedName}:${value.variant}`
}

/**
 * Serialize overrides to cookie string format
 * Format: "devEnv=envName|exp1:variant.env.id,exp2:variant"
 */
export function serializeOverrides(overrides: ExperimentOverrides, devEnv?: string | null): string {
  const parts: string[] = []

  for (const [name, value] of Object.entries(overrides)) {
    parts.push(serializeExperiment(name, value))
  }

  const experimentsStr = parts.join(',')

  // Include dev environment if provided
  if (devEnv) {
    return `devEnv=${encodeURIComponent(devEnv)}|${experimentsStr}`
  }

  return experimentsStr
}

/**
 * Generate inline script code that parses cookie overrides
 * Returns a self-executing function that reads and parses the absmartly_overrides cookie
 */
export function generateCookieParserScript(cookieName: string): string {
  return `
    (() => {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('${cookieName}='))
        ?.split('=')[1];
      if (!cookieValue) return {};

      // Parse compact format with experiment ID
      let devEnv = undefined;
      let experimentsStr = cookieValue;

      // Check if dev environment is included
      if (cookieValue.startsWith('devEnv=')) {
        const parts = cookieValue.split('|');
        devEnv = decodeURIComponent(parts[0].substring(7));
        experimentsStr = parts[1] || '';
      }

      const result = {};
      if (experimentsStr) {
        const experiments = experimentsStr.split(',');

        for (const exp of experiments) {
          const [name, values] = exp.split(':');
          if (!name || !values) continue;

          const decodedName = decodeURIComponent(name);
          const parts = values.split('.');

          if (parts.length === 1) {
            result[decodedName] = parseInt(parts[0], 10);
          } else if (parts.length === 2) {
            result[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            };
          } else {
            result[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            };
          }
        }
      }

      return result;
    })()
  `
}
