import { describe, expect, it } from 'vitest'
import { designLinter } from '../src/design/linter.js'
import { readFileSync } from 'node:fs'

const html = readFileSync('test/fixtures/ai-look-page.html', 'utf8')
const results = designLinter.scanFile('test/fixtures/ai-look-page.html', html)

describe('design linter on ai-look-page.html', () => {
  it('detects banned patterns and reports score', () => {
    expect(results.score).toMatch(/^\d+\/14$/)
    // The fixture intentionally contains banned AI-look patterns, so score must be > 0
    expect(parseInt(results.score, 10)).toBeGreaterThan(0)
  })

  it('hits cover multiple rule numbers', () => {
    const uniqueRules = new Set(results.hits.map(h => h.rule))
    expect(uniqueRules.size).toBeGreaterThanOrEqual(2)
  })
})
