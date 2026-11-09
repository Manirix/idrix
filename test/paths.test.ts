import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  IgnoreRules,
  PathIgnoredError,
  PathOutsideRootError,
  loadIgnoreRules,
  resolveInRoot,
  resolveReadable,
} from '../src/core/paths.js'

describe('IgnoreRules', () => {
  it('matches a plain name', () => {
    const rules = new IgnoreRules('node_modules\n')
    expect(rules.matches('node_modules', true)).toBe(true)
    expect(rules.matches('src/app.ts', false)).toBe(false)
  })

  it('matches a glob', () => {
    const rules = new IgnoreRules('*.log\n')
    expect(rules.matches('debug.log', false)).toBe(true)
    expect(rules.matches('logs/debug.log', false)).toBe(false)
  })

  it('matches across directories with **', () => {
    const rules = new IgnoreRules('dist/**\n')
    expect(rules.matches('dist/app.js', false)).toBe(true)
    expect(rules.matches('dist/nested/app.js', false)).toBe(true)
  })

  it('honours negation', () => {
    const rules = new IgnoreRules('*.log\n!important.log\n')
    expect(rules.matches('debug.log', false)).toBe(true)
    expect(rules.matches('important.log', false)).toBe(false)
  })

  it('ignores comments and blank lines', () => {
    const rules = new IgnoreRules('# a comment\n\n   \n')
    expect(rules.isEmpty).toBe(true)
  })

  it('only matches directories for a dir-only rule', () => {
    const rules = new IgnoreRules('build/\n')
    expect(rules.matches('build', true)).toBe(true)
    expect(rules.matches('build', false)).toBe(false)
  })
})

describe('resolveInRoot', () => {
  const root = mkdtempSync(join(tmpdir(), 'idrix-paths-'))

  it('resolves a relative path inside the root', () => {
    expect(resolveInRoot(root, 'src/app.ts')).toBe(join(root, 'src', 'app.ts'))
  })

  it('throws when the path escapes the root', () => {
    expect(() => resolveInRoot(root, '../outside')).toThrow(PathOutsideRootError)
  })

  it('throws for an absolute path outside the root', () => {
    expect(() => resolveInRoot(root, '/etc/passwd')).toThrow(PathOutsideRootError)
  })

  it('allows the root itself', () => {
    expect(resolveInRoot(root, '.')).toBe(root)
  })
})

describe('resolveReadable', () => {
  it('refuses an ignored file', () => {
    const root = mkdtempSync(join(tmpdir(), 'idrix-paths-'))
    writeFileSync(join(root, '.gitignore'), 'secret.txt\n', 'utf8')
    writeFileSync(join(root, 'secret.txt'), 'x', 'utf8')
    const rules = loadIgnoreRules(root)
    expect(() => resolveReadable(root, 'secret.txt', rules)).toThrow(PathIgnoredError)
    rmSync(root, { recursive: true, force: true })
  })

  it('allows a normal file', () => {
    const root = mkdtempSync(join(tmpdir(), 'idrix-paths-'))
    writeFileSync(join(root, 'app.ts'), 'x', 'utf8')
    const rules = loadIgnoreRules(root)
    expect(resolveReadable(root, 'app.ts', rules)).toBe(join(root, 'app.ts'))
    rmSync(root, { recursive: true, force: true })
  })
})
