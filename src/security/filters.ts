/**
 * Filtering of scanner findings so low-noise rules can be turned off by default.
 */
import type { SecurityFinding } from './scanner.js'

/** Rule names we have default exclude lists for. */
export type FilterKey = 'EXFIL' | 'HARDCODED_SECRET'

const defaultExcludes: Record<FilterKey, string[]> = {
  EXFIL: ['Open redirects', 'Unproven input validation (where proof isn\'t obvious)', 'Generic DoS', 'Rate-limit-only findings'],
  HARDCODED_SECRET: [],
}

/** Return findings excluding those listed under any excluded rule name. */
export function applyFilters(findings: SecurityFinding[], overrides: Partial<Record<FilterKey, string[]>> = {}): SecurityFinding[] {
  const excludes = new Set<string>(defaultExcludes['EXFIL'])
  for (const [key, list] of Object.entries(overrides) as [FilterKey, string[]][]) {
    if (list && list.length) excludes.add(...list)
  }
  return findings.filter((f) => !excludes.has(f.message))
}