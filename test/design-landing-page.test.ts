import { designLinter } from '../src/design/linter.js'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Mama Tee Landing Page lint', () => {
  it('passes linter with 0/14 banned patterns', () => {
    const html = readFileSync('./.idrix/design/landing-page.html', 'utf8')
    const results = designLinter.scanFile('./.idrix/design/landing-page.html', html)

    console.log(`Linter result: ${results.score}`)
    console.log('Hits:', JSON.stringify(results.hits, null, 2))

    expect(results.passed).toBe(true)
    expect(results.score).toBe('0/14')
  })

  it('has scroll reveal, hover states, real copy, and no gradients', () => {
    const html = readFileSync('./.idrix/design/landing-page.html', 'utf8')
    expect(html).toContain('transition: border-radius')
    expect(html).toContain('.feature:hover')
    expect(html).not.toMatch(/background.*gradient|radial-gradient|conic-gradient/)
  })
})
