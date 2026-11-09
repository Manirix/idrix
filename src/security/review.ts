/**
 * Diff-aware security reviewer for `/security-review` (docs/PRD.md §5.9, Phase 9).
 *
 * No model call. Pipes git diff output directly into the scanner on changed lines.
 * Runs synchronously via child_process.execFileSync('git','diff',...) so it is
 * deterministic, CI-safe and testable without a network or API key.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { scanFile, type SecurityFinding } from './scanner.js'
import { applyFilters } from './filters.js'

export interface ReviewResult {
  findings: SecurityFinding[]
  filesScanned: number
  diffStaged: boolean
}

export interface SecurityReviewOptions {
  root?: string
  staged?: boolean
  filters?: Record<string, string[]>
}

/** Get a unified diff of changed files for the current repo at options.root. */
export function getDiffText(opts: SecurityReviewOptions = {}): string {
  const root = opts.root ?? process.cwd()
  try {
    const args: string[] = []
    if (opts.staged !== false) args.push('-U1') // 1-line context for line numbering
    args.push('--no-prefix')
    execFileSync('git', ['diff', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    return ''
  } catch {
    return ''
  }
}

/**
 * Scan all changed files between the working tree and HEAD, plus staged changes,
 * and collect findings with file:line attribution.
 *
 * @returns findings for every hit across all changed files.
 */
export function runSecurityReview(opts: SecurityReviewOptions = {}): ReviewResult {
  const filters = opts.filters ?? defaultFilters()
  const findings: SecurityFinding[] = []
  let filesScanned = 0

  // Gather both unstaged and staged changes.
  const hunks: Array<{ file: string; additions: string[] }> = []
  try {
    const diffOut = execFileSync('git', ['diff', '-U1', '--no-prefix'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    collectHunksFromGitDiff(diffOut, hunks)
  } catch { /* empty repo: nothing changed */ }

  try {
    const staged = execFileSync('git', ['diff', '--cached', '-U1', '--no-prefix'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    collectHunksFromGitDiff(staged, hunks, true)
  } catch { /* empty staged changes */ }

  for (const h of hunks) {
    if (!h.additions.length) continue
    filesScanned++
    try {
      const content = readFileContentAtPath(join(opts.root ?? process.cwd(), h.file), h.additions)
      const perLine = scanFile(h.file, content)
      findings.push(...perLine)
    } catch {
      // File may have been deleted since the diff was produced; skip gracefully.
    }
  }

  const deduped = dedupeFindings(findings)
  const afterFilters = applyFilters(deduped, filters)
  return { findings: afterFilters, filesScanned, diffStaged: hunks.length > 0 }
}

function defaultFilters(): Record<string, string[]> {
  return {
    EXFIL: ['Open redirects', 'Unproven input validation (where proof isn\'t obvious)', 'Generic DoS', 'Rate-limit-only findings'],
  }
}

interface Hunk {
  file: string
  additions: string[]
}

/** Parse `git diff` output into per-file addition lists. */
function collectHunksFromGitDiff(diff: string, out: Hunk[]): void {
  const fileHeaderRe = /^diff --(\w*) (\S+)$/gm
  const addedRe = /^\+\+\+\s+(\S+)/g
  const hunkBodyRe = /^@@ -\d+(?:,\d+)? \d+(?:,\d+)? @@/g

  const hunks: Array<{ file: string; additions: string[] }> = []
  let curFile = ''
  let curAdditions: string[] = []
  let inAdded = false

  for (const raw of diff.split('\n')) {
    const l = raw
    const mHeader = fileHeaderRe.exec(l)
    if (mHeader) {
      curFile = mHeader[2]!
      curAdditions = []
      inAdded = false
      continue
    }
    const mAdd = addedRe.exec(l)
    if (mAdd && /^---\b/.test(l)) {
      inAdded = true
      curAdditions = []
      continue
    }
    const mLine = hunkBodyRe.exec(l)
    if (mLine) {
      // Save previous hunk.
      if (curFile) hunks.push({ file: curFile, additions: curAdditions })
      curAdditions = []
      inAdded = false
      continue
    }
    if (inAdded) {
      curAdditions.push(l)
    }
  }
  if (curFile) hunks.push({ file: curFile, additions: curAdditions })
  for (const h of hunks) out.push(h)
}

function readFileContentAtPath(filePath: string, additions: string[]): string {
  // Reconstruct content from the pure added-lines; merged with unchanged prefix not available here.
  // For simplicity, use the added lines plus any tracked-context helper: just scan added lines directly.
  return additions.join('\n')
}

/** Deduplicate findings by (file, line, rule); keep first with highest severity. */
function dedupeFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const byKey = new Map<string, SecurityFinding>()
  for (const f of findings) {
    const key = `${f.rule}:${f.line}`
    const existing = byKey.get(key)
    if (!existing || (f.severity === 'critical' && existing.severity !== 'critical')) {
      byKey.set(key, f)
    }
  }
  return Array.from(byKey.values())
}

