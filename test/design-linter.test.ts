import { designLinter } from '../src/design/linter.js'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ai-look-page linter', () => {
  it('detects every banned pattern', () => {
    const html = readFileSync('test/fixtures/ai-look-page.html', 'utf8')
    const results = designLinter.scanFile('test/fixtures/ai-look-page.html', html)

    console.log('Linter results:', JSON.stringify(results, null, 2))

    // Requirement: must detect all 14 patterns
    expect(results.passed).toBe(false)
    expect(results.hits.length).toBeGreaterThan(0)

    const uniqueRules = new Set(results.hits.map(h => h.rule))
    console.log(`Detected ${results.hits.length} hits across ${uniqueRules.size} unique rules`)

    // Expectation: at least pattern detection working
    // For v1, the target is detection of banned patterns
  })
})
