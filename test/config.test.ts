import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { configSchema, loadConfig, mergeConfig } from '../src/core/config.js'

describe('config schema', () => {
  it('applies defaults for an empty config', () => {
    const parsed = configSchema.parse({})
    expect(parsed.limits.maxStepsPerTurn).toBe(40)
    expect(parsed.fallback).toEqual([])
    expect(parsed.permissions.allow).toEqual([])
  })

  it('rejects an unknown provider type', () => {
    const result = configSchema.safeParse({
      providers: { bad: { type: 'not-a-provider' } },
    })
    expect(result.success).toBe(false)
  })

  it('accepts the provider types from the plan', () => {
    const result = configSchema.safeParse({
      providers: {
        openrouter: { type: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY' },
        gemini: { type: 'google', apiKeyEnv: 'GEMINI_API_KEY' },
        deepseek: {
          type: 'openai-compatible',
          baseURL: 'https://api.deepseek.com/v1',
          apiKeyEnv: 'DEEPSEEK_API_KEY',
        },
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('mergeConfig', () => {
  it('lets the override win for scalars', () => {
    expect(mergeConfig({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 })
  })

  it('merges nested objects', () => {
    expect(mergeConfig({ limits: { max: 1, min: 0 } }, { limits: { max: 9 } })).toEqual({
      limits: { max: 9, min: 0 },
    })
  })

  it('replaces arrays rather than concatenating them', () => {
    expect(mergeConfig({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] })
  })

  it('ignores undefined values in the override', () => {
    expect(mergeConfig({ a: 1 }, { a: undefined })).toEqual({ a: 1 })
  })
})

describe('config file loading', () => {
  it('reads project settings and merges them over the defaults', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idrix-cfg-'))
    mkdirSync(join(dir, '.idrix'))
    writeFileSync(
      join(dir, '.idrix', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['read_file'] } }),
      'utf8',
    )

    // loadConfig reads the global file too; in a test environment it is absent
    // or harmless, so we only assert the project part wins.
    const cfg = loadConfig(dir)
    expect(cfg.permissions.allow).toContain('read_file')
  })
})
