export function getVariantConfigError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "Variant config must be a JSON object"
  }

  const domChanges = (value as Record<string, unknown>).__dom_changes
  if (
    domChanges !== undefined &&
    !Array.isArray(domChanges) &&
    (domChanges === null ||
      typeof domChanges !== "object" ||
      !Array.isArray((domChanges as Record<string, unknown>).changes))
  ) {
    return "Variant DOM changes must be an array or an object with a changes array"
  }
}
