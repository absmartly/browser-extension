import { DOMChangesDataSchema } from "./validation-schemas"

export function getVariantConfigError(
  value: unknown,
  domFieldName = "__dom_changes"
): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "Variant config must be a JSON object"
  }

  const domChanges = (value as Record<string, unknown>)[domFieldName]
  const label =
    domFieldName === "__dom_changes"
      ? "Variant DOM changes"
      : `Variant DOM changes (${domFieldName})`
  if (
    domChanges !== undefined &&
    !Array.isArray(domChanges) &&
    (domChanges === null ||
      typeof domChanges !== "object" ||
      !Array.isArray((domChanges as Record<string, unknown>).changes))
  ) {
    return `${label} must be an array or an object with a changes array`
  }
  if (
    domChanges !== undefined &&
    !DOMChangesDataSchema.safeParse(domChanges).success
  ) {
    return `${label} contain invalid data`
  }
}
