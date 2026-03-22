/**
 * Strip internal metadata fields (prefixed with _) from analysis results.
 * Used by GET routes to clean results before sending to client.
 */
export function stripInternalFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('_')))
}
