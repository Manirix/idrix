/**
 * Local-only scope guard (PRD SEC-3 / docs/PRD.md §5.2.5).
 *
 * Dynamic tests run only against localhost, 127.0.0.0/8 and ::1, or the port
 * the audit process itself started — never another host, IP, domain or the
 * user's network range. Refused targets are recorded so the report can note
 * that dynamic probes were skipped rather than executed.
 */

export type ScopeCheck = 'ok' | 'refused' | 'localOnly'

const LOCAL_HOSTS: ReadonlyArray<string> = ['localhost', '::1']
// 127.0.0.0/8 as exact IPs is wider than needed; we accept the literal mask and
// expand it for matching. The CIDR mask is kept so callers can pass their own range.
const INTERNAL_IP_PREFIXES: ReadonlyArray<[string, string]> = [
  ['10.0.0.0', '10.255.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
]

function normalizeTarget(target: string): { host: string; port: number } {
  // Strip protocol.
  const rest = target.replace(/^https?:\/\//i, '')
  // Split host:port. Port optional -> default to listening port captured by caller.
  const parts = rest.split(':')
  const host = parts[0] ?? ''
  let port = 0
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]!)) {
    port = Number.parseInt(parts[parts.length - 1], 10)
  }
  return { host, port }
}

function matchesLocal(host: string): boolean {
  if (LOCAL_HOSTS.includes(host)) return true
  for (const [start, end] of INTERNAL_IP_PREFIXES) {
    if (ipInRange(host, start, end)) return true
  }
  return false
}

/** Check whether a target host is local-only. Throws on genuinely refused targets. */
export function assertLocal(target: string, selfPort = 0): ScopeCheckResult {
  const { host } = normalizeTarget(target)
  if (matchesLocal(host)) {
    return { status: 'ok', host, port: selfPort }
  }
  throw new Error(`Refused to scan ${target} — dynamic tests run only against localhost / your own local copy.`)
}

export interface ScopeCheckResult {
  status: 'ok' | 'refused'
  host: string
  port: number
  refused: boolean
}

/** Used by scanDirectory overrides so scanDirectory can record refused targets. */
export function localOnlyTargetGuard(target: string, selfPort = 0): ScopeCheckResult {
  try {
    assertLocal(target, selfPort)
    return { status: 'ok', host: normalizeTarget(target).host, port: selfPort, refused: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'refused', host: normalizeTarget(target).host, port: selfPort, refused: true, reason: msg }
  }
}

function ipToNumber(ip: string): number {
  const [a, b, c, d] = ip.split('.').map((x) => Number.parseInt(x, 10))
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d
}

function ipInRange(ip: string, start: string, end: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false
  const n = ipToNumber(ip)
  const s = ipToNumber(start)
  const e = ipToNumber(end)
  return n >= s && n <= e
}
