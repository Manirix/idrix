import { describe, expect, it } from 'vitest'

import {
  checkPermission,
  narrowPermissionSets,
  type PermissionRules,
} from '../src/core/permissions.js'

const rules = (partial: Partial<PermissionRules>): PermissionRules => ({
  allow: partial.allow ?? [],
  ask: partial.ask ?? [],
  deny: partial.deny ?? [],
})

describe('checkPermission', () => {
  it('allows reading for free', () => {
    const cfg = { rules: rules({}) }
    expect(checkPermission({ tool: 'read_file' }, cfg)).toBe('allow')
    expect(checkPermission({ tool: 'list_dir' }, cfg)).toBe('allow')
    expect(checkPermission({ tool: 'grep' }, cfg)).toBe('allow')
  })

  it('asks before writing or running commands by default', () => {
    const cfg = { rules: rules({}) }
    expect(checkPermission({ tool: 'write_file' }, cfg)).toBe('ask')
    expect(checkPermission({ tool: 'edit_file' }, cfg)).toBe('ask')
    expect(checkPermission({ tool: 'bash' }, cfg)).toBe('ask')
  })

  it('applies deny before ask and allow', () => {
    const cfg = {
      rules: rules({
        allow: ['bash(npm test*)', 'bash(npm run *)'],
        ask: ['bash(*)'],
        deny: ['bash(rm -rf *)'],
      }),
    }
    expect(
      checkPermission({ tool: 'bash', target: 'npm test' }, cfg),
    ).toBe('allow')
    expect(
      checkPermission({ tool: 'bash', target: 'npm run build' }, cfg),
    ).toBe('allow')
    expect(checkPermission({ tool: 'bash', target: 'rm -rf /' }, cfg)).toBe('deny')
    expect(checkPermission({ tool: 'bash', target: 'curl example.com' }, cfg)).toBe('ask')
  })

  it('matches path patterns on file rules', () => {
    const cfg = { rules: rules({ deny: ['read_file(.env*)'] }) }
    expect(checkPermission({ tool: 'read_file', target: '.env' }, cfg)).toBe('deny')
    expect(checkPermission({ tool: 'read_file', target: '.env.local' }, cfg)).toBe('deny')
    expect(checkPermission({ tool: 'read_file', target: 'src/app.ts' }, cfg)).toBe('allow')
  })

  it('auto-accepts edits but still asks for shell when autoAcceptEdits is on', () => {
    const cfg = { rules: rules({}), autoAcceptEdits: true }
    expect(checkPermission({ tool: 'write_file', target: 'a.ts' }, cfg)).toBe('allow')
    expect(checkPermission({ tool: 'edit_file', target: 'a.ts' }, cfg)).toBe('allow')
    expect(checkPermission({ tool: 'bash', target: 'ls' }, cfg)).toBe('ask')
  })
})

describe('narrowPermissionSets', () => {
  it('never lets a skill widen an ask into an allow', () => {
    const current = rules({ ask: ['bash(*)'] })
    const narrowed = narrowPermissionSets(current, { allow: ['bash(*)'] })
    expect(narrowed.allow).toEqual([])
    expect(narrowed.ask).toEqual(['bash(*)'])
  })

  it('lets a skill add deny rules', () => {
    const current = rules({ allow: ['bash(npm test*)'] })
    const narrowed = narrowPermissionSets(current, { deny: ['bash(npm test*)'] })
    expect(narrowed.deny).toEqual(['bash(npm test*)'])
    // The allow rule is dropped because the skill narrowed it away.
    expect(narrowed.allow).toEqual([])
  })

  it('keeps the narrower of two allow rules', () => {
    const current = rules({ allow: ['bash(npm test*)', 'bash(npm run *)'] })
    const narrowed = narrowPermissionSets(current, { allow: ['bash(npm test*)'] })
    expect(narrowed.allow).toEqual(['bash(npm test*)'])
  })
})
