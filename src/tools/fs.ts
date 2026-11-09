import { z } from 'zod'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  IgnoreRules,
  PathIgnoredError,
  PathOutsideRootError,
  loadIgnoreRules,
  resolveInRoot,
  resolveReadable,
  toRelative,
} from '../core/paths.js'
import { writeFileAtomic } from '../core/atomic.js'
import { redactSecrets } from '../core/redact.js'
import { ToolError, textResult, type ToolContext, type ToolDefinition } from './types.js'

/**
 * File tools (TOOL-1): read_file, write_file, edit_file, list_dir, glob, grep.
 *
 * All paths are resolved inside the project root and honour .gitignore /
 * .idrixignore. Reading is free; writing requires permission (checked by the
 * agent loop, not here).
 */

const MAX_READ_BYTES = 400_000
const MAX_LIST_ENTRIES = 500

// --------------------------------------------------------------------------
// read_file
// --------------------------------------------------------------------------

export const readFileTool: ToolDefinition<{ path: string; offset?: number; limit?: number }> = {
  name: 'read_file',
  description:
    'Read a text file from the project. Returns the file content with line numbers. ' +
    'Use offset/limit to read part of a large file.',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, relative to the project root'),
    offset: z.number().int().min(1).optional().describe('1-based first line to read'),
    limit: z.number().int().min(1).optional().describe('Maximum number of lines to read'),
  }),
  readOnly: true,
  target: (i) => i.path,
  execute: (input, ctx) => {
    const abs = safeResolve(ctx, input.path)
    if (!existsSync(abs)) {
      throw new ToolError(`File not found: ${input.path}`)
    }
    const stat = statSync(abs)
    if (stat.isDirectory()) {
      throw new ToolError(`Path is a directory, not a file: ${input.path}`)
    }
    if (stat.size > MAX_READ_BYTES) {
      throw new ToolError(
        `File is too large to read (${stat.size} bytes, limit ${MAX_READ_BYTES}). ` +
          `Read it in chunks with offset/limit instead.`,
      )
    }

    const raw = readFileSync(abs, 'utf8')
    const allLines = raw.split(/\r?\n/)
    const start = (input.offset ?? 1) - 1
    const end = input.limit ? start + input.limit : allLines.length
    const slice = allLines.slice(start, end)

    const numbered = slice
      .map((line, idx) => `${String(start + idx + 1).padStart(5, ' ')}\t${line}`)
      .join('\n')

    const header = `${toRelative(ctx.root, abs)} (${allLines.length} lines)`
    return textResult(`${header}\n${numbered}`)
  },
}

// --------------------------------------------------------------------------
// write_file
// --------------------------------------------------------------------------

export const writeFileTool: ToolDefinition<{
  path: string
  content: string
  append?: boolean
}> = {
  name: 'write_file',
  description:
    'Write a text file inside the project. Overwrites the file unless `append` is true. ' +
    'The write is atomic: the file is either fully old or fully new.',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, relative to the project root'),
    content: z.string().describe('Full file content'),
    append: z.boolean().optional().describe('Append instead of overwriting'),
  }),
  readOnly: false,
  target: (i) => i.path,
  execute: (input, ctx) => {
    const abs = safeResolve(ctx, input.path, { allowIgnored: true })
    const existed = existsSync(abs)
    const previous = existed ? readFileSync(abs, 'utf8') : undefined

    ctx.checkpoint?.(abs)

    const dir = dirname(abs)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (input.append && existed) {
      writeFileAtomic(abs, previous + input.content)
    } else {
      writeFileAtomic(abs, input.content)
    }

    const rel = toRelative(ctx.root, abs)
    const lines = input.content.split(/\r?\n/).length
    return textResult(
      `${existed ? 'Updated' : 'Created'} ${rel} (${lines} lines, ${input.content.length} bytes).`,
    )
  },
}

// --------------------------------------------------------------------------
// edit_file
// --------------------------------------------------------------------------

export const editFileTool: ToolDefinition<{
  path: string
  oldString: string
  newString: string
  replaceAll?: boolean
}> = {
  name: 'edit_file',
  description:
    'Replace an exact string in a file. `oldString` must appear verbatim in the file ' +
    '(and be unique unless replaceAll is true).',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, relative to the project root'),
    oldString: z.string().describe('Exact text to replace'),
    newString: z.string().describe('Replacement text'),
    replaceAll: z.boolean().optional().describe('Replace every occurrence'),
  }),
  readOnly: false,
  target: (i) => i.path,
  execute: (input, ctx) => {
    const abs = safeResolve(ctx, input.path, { allowIgnored: true })
    if (!existsSync(abs)) {
      throw new ToolError(`File not found: ${input.path}`)
    }
    const content = readFileSync(abs, 'utf8')

    const occurrences = countOccurrences(content, input.oldString)
    if (occurrences === 0) {
      throw new ToolError(
        `oldString not found in ${input.path}. The file must contain that text exactly.`,
      )
    }
    if (occurrences > 1 && !input.replaceAll) {
      throw new ToolError(
        `oldString appears ${occurrences} times in ${input.path}. ` +
          `Add more surrounding context to make it unique, or set replaceAll.`,
      )
    }

    ctx.checkpoint?.(abs)

    const updated = input.replaceAll
      ? content.split(input.oldString).join(input.newString)
      : content.replace(input.oldString, input.newString)

    writeFileAtomic(abs, updated)
    return textResult(`Edited ${toRelative(ctx.root, abs)} (${occurrences} replacement(s)).`)
  },
}

// --------------------------------------------------------------------------
// list_dir
// --------------------------------------------------------------------------

export const listDirTool: ToolDefinition<{ path?: string }> = {
  name: 'list_dir',
  description: 'List the files and directories at a path inside the project.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe('Directory to list, relative to the project root. Defaults to the root.'),
  }),
  readOnly: true,
  target: (i) => i.path ?? '.',
  execute: (input, ctx) => {
    const abs = safeResolve(ctx, input.path ?? '.', { allowIgnored: true })
    if (!existsSync(abs)) {
      throw new ToolError(`Directory not found: ${input.path ?? '.'}`)
    }
    if (!statSync(abs).isDirectory()) {
      throw new ToolError(`Not a directory: ${input.path ?? '.'}`)
    }

    const rules = loadIgnoreRules(ctx.root)
    const entries = readdirSync(abs, { withFileTypes: true })
      .filter((e) => {
        const rel = toRelative(ctx.root, join(abs, e.name))
        return !rules.matches(rel, e.isDirectory())
      })
      .slice(0, MAX_LIST_ENTRIES)

    const lines = entries.map((e) => {
      const rel = toRelative(ctx.root, join(abs, e.name))
      if (e.isDirectory()) return `${rel}/`
      try {
        const size = statSync(join(abs, e.name)).size
        return `${rel} (${size} bytes)`
      } catch {
        return rel
      }
    })

    const rel = toRelative(ctx.root, abs) || '.'
    return textResult(`${rel}/\n${lines.join('\n')}`)
  },
}

// --------------------------------------------------------------------------
// glob
// --------------------------------------------------------------------------

export const globTool: ToolDefinition<{ pattern: string; path?: string }> = {
  name: 'glob',
  description:
    'Find files by glob pattern (e.g. "**/*.ts"). Returns matching paths relative to the project root.',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    path: z.string().optional().describe('Directory to search in. Defaults to the root.'),
  }),
  readOnly: true,
  target: (i) => i.pattern,
  execute: (input, ctx) => {
    const base = safeResolve(ctx, input.path ?? '.', { allowIgnored: true })
    const rules = loadIgnoreRules(ctx.root)
    const matches = globFiles(base, ctx.root, input.pattern, rules)
    return textResult(
      matches.length === 0
        ? `No files matched ${input.pattern}`
        : matches.join('\n'),
    )
  },
}

// --------------------------------------------------------------------------
// grep
// --------------------------------------------------------------------------

export const grepTool: ToolDefinition<{
  pattern: string
  path?: string
  glob?: string
  ignoreCase?: boolean
}> = {
  name: 'grep',
  description:
    'Search file contents with a regular expression. Returns matching lines with file:line prefixes.',
  inputSchema: z.object({
    pattern: z.string().describe('Regular expression to search for'),
    path: z.string().optional().describe('Directory to search in. Defaults to the root.'),
    glob: z.string().optional().describe('Only search files matching this glob'),
    ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  }),
  readOnly: true,
  target: (i) => i.pattern,
  execute: (input, ctx) => {
    const base = safeResolve(ctx, input.path ?? '.', { allowIgnored: true })
    const rules = loadIgnoreRules(ctx.root)

    let re: RegExp
    try {
      re = new RegExp(input.pattern, input.ignoreCase ? 'i' : '')
    } catch (err) {
      throw new ToolError(
        `Invalid regular expression: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const out: string[] = []
    for (const file of globFiles(base, ctx.root, input.glob ?? '**/*', rules)) {
      const abs = join(ctx.root, file)
      let content: string
      try {
        const st = statSync(abs)
        if (st.size > MAX_READ_BYTES) continue
        content = readFileSync(abs, 'utf8')
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (re.test(line)) {
          out.push(`${file}:${i + 1}: ${line.trim().slice(0, 300)}`)
          if (out.length >= 500) {
            return textResult(`${out.join('\n')}\n… (truncated at 500 matches)`)
          }
        }
      }
    }

    return textResult(
      out.length === 0 ? `No matches for ${input.pattern}` : out.join('\n'),
    )
  },
}

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let count = 0
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = haystack.indexOf(needle, idx + needle.length)
  }
  return count
}

/** Resolve a path inside the root, applying ignore rules unless explicitly allowed. */
function safeResolve(
  ctx: ToolContext,
  target: string,
  opts: { allowIgnored?: boolean } = {},
): string {
  try {
    if (opts.allowIgnored) {
      return resolveInRoot(ctx.root, target)
    }
    return resolveReadable(ctx.root, target, loadIgnoreRules(ctx.root))
  } catch (err) {
    if (err instanceof PathOutsideRootError) {
      throw new ToolError(
        `Refused: ${target} is outside the project root. Idrix only works inside the current project.`,
      )
    }
    if (err instanceof PathIgnoredError) {
      throw new ToolError(
        `Refused: ${target} is ignored by .gitignore/.idrixignore. ` +
          `Ask the user if they really want to touch it.`,
      )
    }
    throw err
  }
}

/**
 * Walk a directory tree collecting files matching a glob pattern.
 * Returns paths relative to the project root, forward-slashed.
 */
export function globFiles(
  base: string,
  root: string,
  pattern: string,
  rules: IgnoreRules,
  limit = 1000,
): string[] {
  const results: string[] = []
  const patternRe = globToRegex(pattern)

  const walk = (dir: string): void => {
    if (results.length >= limit) return
    let entries: Dirent<string>[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= limit) return
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const abs = join(dir, entry.name)
      const rel = toRelative(root, abs)
      if (rules.matches(rel, entry.isDirectory())) continue
      if (entry.isDirectory()) {
        walk(abs)
      } else {
        if (patternRe.test(rel)) results.push(rel)
      }
    }
  }

  walk(base)
  return results.sort()
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

/** Redact secrets from a text blob (used before text reaches the model). */
export { redactSecrets }
