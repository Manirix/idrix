import { describe, expect, it } from 'vitest'

import { canCall, toolsForMode } from '../src/core/modes.js'

describe('modes', () => {
  it('plan mode exposes only read-only tools', () => {
    const set = toolsForMode('plan')
    expect(set.readonly).toContain('read_file')
    expect(set.readonly).toContain('list_dir')
    expect(set.readonly).toContain('glob')
    expect(set.readonly).toContain('grep')
    expect(set.readonly).toContain('ask_user')
  })

  it('plan mode does not expose write, edit or bash at all', () => {
    const set = toolsForMode('plan')
    expect(set.readonly).not.toContain('write_file')
    expect(set.readonly).not.toContain('edit_file')
    expect(set.readonly).not.toContain('bash')
  })

  it('build mode exposes the full tool set', () => {
    const set = toolsForMode('build')
    expect(set.readonly).toContain('write_file')
    expect(set.readonly).toContain('edit_file')
    expect(set.readonly).toContain('bash')
  })

  it('canCall follows the tool set', () => {
    const plan = toolsForMode('plan')
    expect(canCall('read_file', plan)).toBe(true)
    expect(canCall('write_file', plan)).toBe(false)
    expect(canCall('bash', plan)).toBe(false)
  })

  it('a denied tool can never be called', () => {
    const build = { readonly: ['bash'], denied: ['bash'], asks: [] }
    expect(canCall('bash', build)).toBe(false)
  })
})
