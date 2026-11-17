export function normalizeSourceFeatureId(
  sourceFeatureId: string | number | undefined | null
): string {
  const value = sourceFeatureId == null ? '' : String(sourceFeatureId).trim()
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : value
}
