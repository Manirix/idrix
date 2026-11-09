/**
 * Permission engine (MODE-3, and the non-negotiable "reading is free" rule).
 *
 * Rule syntax in `.idrix/settings.json`:
 *   { "permissions": {
 *       "allow": ["read_file", "list_dir", "grep", "bash(npm test*)", "bash(npm run *)"],
 *       "ask":   ["write_file", "edit_file", "bash(*)"],
 *       "deny":  ["bash(rm -rf *)", "read_file(.env*)"] } }
 *
 * Resolution order: deny → ask → allow → default ask.
 *
 * Rules are matched against a "target" string:
 *   - plain tool          → "read_file"
 *   - tool with a target  → "bash(npm test)" / "read_file(src/app.ts)"
 *
 * Patterns support `*` (any chars except `/` for path-ish targets) and `**`.
 * The tool name itself may contain `*`.
 *
 * IMPORTANT: skills, plugins and MCP servers can only ever *narrow* permissions.
 * `narrowPermissionSets` is the only way they are allowed to change a decision.
 */

export type Decision = 'allow' | 'ask' | 'deny'

export interface PermissionRules {
  allow: string[]
  ask: string[]
  deny: string[]
}

export interface PermissionRequest {
  /** Tool name, e.g. "bash". */
  tool: string
  /** Optional target: command string, file path, URL. */
  target?: string
  /** Extra context shown to the user in the approval prompt. */
  description?: string
}

export interface PermissionConfig {
  rules: PermissionRules
  /** When true, file edits are auto-accepted but shell commands still ask (MODE-4). */
  autoAcceptEdits?: boolean
}

function globToRegex(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else {
        out += '.*'
      }
    } else if (c === '?') {
      out += '.'
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c
    } else {
      out += c
    }
  }
  return new RegExp(`^${out}$`)
}

/**
 * A rule is either:
 *   "tool"            — matches any call of that tool
 *   "tool(pattern)"   — matches calls of that tool whose target matches pattern
 *
 * Pattern matching: `*` matches any chars except `/`, `**` matches any depth.
 * The tool name itself may contain `*`.
 */
function ruleMatches(rule: string, tool: string, target: string | undefined): boolean {
  const open = rule.indexOf('(')
  if (open === -1) {
    // Bare tool name, possibly with a glob.
    return globToRegex(rule).test(tool)
  }
  if (!rule.endsWith(')')) return false
  const ruleTool = rule.slice(0, open)
  const pattern = rule.slice(open + 1, -1)
  if (!globToRegex(ruleTool).test(tool)) return false
  if (target === undefined) return false
  return globToRegex(pattern).test(target)
}

/** Check whether a requested rule narrows / keeps a current rule. */
function ruleNarrows(currentRule: string, requestedRule: string): boolean {
  // Exact match keeps the rule.
  if (currentRule === requestedRule) return true

  // Extract tool name and optional pattern.
  const currentOpen = currentRule.indexOf('(')
  const requestedOpen = requestedRule.indexOf('(')

  const currentTool = currentOpen === -1 ? currentRule : currentRule.slice(0, currentOpen)
  const requestedTool = requestedOpen === -1 ? requestedRule : requestedRule.slice(0, requestedOpen)

  // Tool names must match (bare tool or tool(name)).
  if (currentTool !== requestedTool) return false

  // Both have patterns — check narrowing.
  if (currentOpen !== -1 && requestedOpen !== -1) {
    // currentRule pattern: e.g. "npm test*" or "*"
    // requestedRule pattern: e.g. "npm test*" or "*"
    // A requested rule narrows a current rule when the requested pattern is
    // at least as specific. We consider it narrowing when the requested pattern
    // has more literal text before any trailing wildcards.
    // E.g. "bash(npm test*)" narrows "bash(*)".
    const currentPat = currentRule.slice(currentOpen + 1, -1)
    const requestedPat = requestedRule.slice(requestedOpen + 1, -1)

    // If requested pattern is longer/more specific (has more chars before any *),
    // it narrows the current pattern.
    const curHasStar = currentPat.includes('*')
    const reqHasStar = requestedPat.includes('*')

    if (curHasStar && reqHasStar) {
      // Both have wildcards: the one with more literal text before the * narrows.
      const curPrefix = currentPat.replace('*', '').toLowerCase()
      const reqPrefix = requestedPat.replace('*', '').toLowerCase()
      return reqPrefix.length > curPrefix.length
    }

    if (curHasStar && !reqHasStar) {
      // Current has wildcard, requested is bare/more specific → requested narrows current.
      // E.g. current="bash(*)", requested="bash(npm test*)" → requested narrows.
      return true
    }

    if (!curHasStar && reqHasStar) {
      // Current is bare, requested has wildcard → current is more general, requested doesn't narrow.
      return false
    }

    // Neither has wildcard: exact match already handled above.
    return false
  }

  // Only current has pattern (requested is bare tool).
  if (currentOpen !== -1 && requestedOpen === -1) {
    // Current is "bash(*)", requested is bare "bash" → requested narrows current.
    return true
  }

  // Only requested has pattern (current is bare tool).
  if (currentOpen === -1 && requestedOpen !== -1) {
    // Current is "bash", requested is "bash(npm test*)" → current is more general,
    // requested doesn't narrow current.
    return false
  }

  // Neither has pattern: already handled exact match above.
  return false
}

/**
 * Decide whether a tool call needs approval.
 * Order: deny → allow → ask → default.
 */
export function checkPermission(req: PermissionRequest, cfg: PermissionConfig): Decision {
  const { allow, ask, deny } = cfg.rules
  const target = req.target

  for (const rule of deny) {
    if (ruleMatches(rule, req.tool, target)) return 'deny'
  }
  for (const rule of allow) {
    if (ruleMatches(rule, req.tool, target)) return 'allow'
  }
  for (const rule of ask) {
    if (ruleMatches(rule, req.tool, target)) return 'ask'
  }

  // MODE-4: auto-accept edits (file writes only), shell commands still ask.
  if (cfg.autoAcceptEdits && (req.tool === 'write_file' || req.tool === 'edit_file')) {
    return 'allow'
  }

  // Default: reading is free, everything else asks.
  if (READ_ONLY_TOOLS.has(req.tool)) return 'allow'
  return 'ask'
}

/**
 * Narrow permissions — used by skills/plugins/MCP servers, which may only remove
 * permissions, never add them.
 *
 * Given the current rules and a set of rules a skill wants to apply, produce the
 * intersection. A skill asking to allow `bash(*)` against a user config that asks
 * for `bash(*)` leaves the result as `ask`, never `allow`.
 */
export function narrowPermissionSets(
  current: PermissionRules,
  requested: Partial<PermissionRules>,
): PermissionRules {
  let allow = [...current.allow]
  let ask = [...current.ask]
  let deny = [...current.deny]

  // If the skill explicitly requests allow/ask, filter current rules to only
  // those that the requested rules match/narrow.
  if (requested.allow !== undefined) {
    allow = requested.allow.length > 0
      ? current.allow.filter((r) =>
          requested.allow!.some((nr) => ruleNarrows(r, nr)),
        )
      : []
  }
  if (requested.ask !== undefined) {
    ask = requested.ask.length > 0
      ? current.ask.filter((r) =>
          requested.ask!.some((nr) => ruleNarrows(r, nr)),
        )
      : []
  }

  // If the skill requests deny, remove any matching rules from allow/ask
  // and add them to deny.
  if (requested.deny !== undefined && requested.deny.length > 0) {
    const requestedDeny = requested.deny
    // Remove from allow
    allow = allow.filter((r) =>
      !requestedDeny.some((dr) => ruleNarrows(r, dr)),
    )
    // Remove from ask
    ask = ask.filter((r) =>
      !requestedDeny.some((dr) => ruleNarrows(r, dr)),
    )
    // Add to deny
    deny = union(deny, requestedDeny)
  }

  return { allow, ask, deny }
}

export const READ_ONLY_TOOLS = new Set([
  'read_file',
  'list_dir',
  'glob',
  'grep',
  'web_search',
  'web_fetch',
])

/** Union of two rule arrays (deduped). */
function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]))
}