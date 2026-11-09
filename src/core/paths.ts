import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * Project-root path guard and ignore rules (TOOL-1).
 *
 * Every file tool resolves paths through `resolveInRoot`, which:
 *   1. resolves the path against the project root,
 *   2. refuses anything that escapes the root,
 *   3. honours `.gitignore` and `.idrixignore`.
 */

export class PathOutsideRootError extends Error {
  constructor(target: string, root: string) {
    super(`Path is outside the project root: ${target} (root: ${root})`)
    this.name = 'PathOutsideRootError'
  }
}

export class PathIgnoredError extends Error {
  constructor(target: string) {
    super(`Path is ignored by .gitignore/.idrixignore: ${target}`)
    this.name = 'PathIgnoredError'
  }
}

/** Minimal gitignore matcher. Supports `*`, `**`, `?`, negation `!`, dir-only `/` suffix. */
export class IgnoreRules {
  private readonly patterns: Array<{ negated: boolean; regex: RegExp; dirOnly: boolean }> = []

  constructor(text: string) {
    for (const rawLine of text.split(/\r?\n/)) {
      let line = rawLine.trim()
      if (line === '' || line.startsWith('#')) continue
      const negated = line.startsWith('!')
      if (negated) line = line.slice(1).trim()
      const dirOnly = line.endsWith('/')
      if (dirOnly) line = line.slice(0, -1)
      if (line === '') continue
      this.patterns.push({ negated, dirOnly, regex: globToRegex(line) })
    }
  }

  get isEmpty(): boolean {
    return this.patterns.length === 0
  }

  /** `relativePath` must use forward slashes and be relative to the root. */
  matches(relativePath: string, isDir: boolean): boolean {
    let ignored = false
    for (const p of this.patterns) {
      if (p.dirOnly && !isDir) continue
      if (!p.regex.test(relativePath)) continue
      ignored = !p.negated
    }
    return ignored
  }
}

function globToRegex(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` — match across separators
        out += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') {
      out += '[^/]'
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c
    } else {
      out += c
    }
  }
  return new RegExp(`^${out}$`)
}

/** Load ignore rules for a project root (.gitignore + .idrixignore). */
export function loadIgnoreRules(root: string): IgnoreRules {
  const chunks: string[] = []
  for (const name of ['.gitignore', '.idrixignore']) {
    const p = join(root, name)
    if (existsSync(p)) {
      try {
        chunks.push(readFileSync(p, 'utf8'))
      } catch {
        // Unreadable ignore file → treat as empty rather than failing the tool.
      }
    }
  }
  return new IgnoreRules(chunks.join('\n'))
}

/**
 * Resolve `target` inside `root`.
 * Returns the absolute path. Throws PathOutsideRootError if it escapes the root.
 */
export function resolveInRoot(root: string, target: string): string {
  const abs = isAbsolute(target) ? resolve(target) : resolve(root, target)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new PathOutsideRootError(target, root)
  }
  return abs
}

/** Path relative to root, always with forward slashes. */
export function toRelative(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/')
}

/**
 * Resolve and additionally enforce the ignore rules.
 * `allowIgnored` is used when the user explicitly asks for a path (e.g. .gitignore itself).
 */
export function resolveReadable(root: string, target: string, rules: IgnoreRules): string {
  const abs = resolveInRoot(root, target)
  const rel = toRelative(root, abs)
  let isDir = false
  try {
    isDir = statSync(abs).isDirectory()
  } catch {
    // Does not exist yet — treat as a file.
  }
  if (rel !== '' && rules.matches(rel, isDir)) {
    throw new PathIgnoredError(rel)
  }
  return abs
}
