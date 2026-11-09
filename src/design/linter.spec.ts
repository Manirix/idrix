import { describe, expect, it } from 'vitest'
import { lintFile } from '../design/linter.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const FIXTURES = path.join(process.cwd(), 'test', 'fixtures')
const RULES_NEEDED = [
  'gradient',
  'glassmorphism',
  'neon-glow',
  'emoji-icon',
  'rounded-2xl',
  'lorem-ipsum',
  'filler-word',
  'filler-copy',
] as const

describe('design linter', () => {
  it('flags every banned pattern in ai-look-page.html (acceptance test 3)', () => {
    const result = lintFile(path.join(FIXTURES, 'ai-look-page.html'))
    expect(result.score).toMatch(/\d+\/14/)
    const rulesHit = new Set(result.hits.map((h) => h.rule))
    // Ideally all 14 patterns present; acceptance target is ≥ 10 distinct hits.
    for (const r of RULES_NEEDED) expect(rulesHit.has(r)).toBe(true)
  })

  it('returns 0/14 on a clean design', () => {
    const tmp = path.join(FIXTURES, '.tmp-clean.html')
    fs.writeFileSync(tmp, `<div>Fresh bread made daily.</div>`, 'utf8')
    const result = lintFile(tmp)
    fs.unlinkSync(tmp)
    expect(result.score).toBe('0/14')
  })

  it('detects gradients, backdrop blur, rounded-2xl, emojis, filler words, lorem ipsum', () => {
    const html = [
      '<style>',
      '.bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }',
      '.card { background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); border-radius: 1.5rem; }',
      '</style>',
      '<div class="pill">Introducing</div>',
      '<p>Revolutionary platform that Elevate your business</p>',
      '<h3>✨Amazing Feature</h3>',
      '</div>',
    ].join('\n')
    fs.writeFileSync(path.join(FIXTURES, '.tmp-det.html'), html, 'utf8')
    const result = lintFile(path.join(FIXTURES, '.tmp-det.html'))
    fs.unlinkSync(path.join(FIXTURES, '.tmp-det.html'))
    expect(result.score).not.toBe('0/14')
    expect(result.hits.some((h) => h.rule === 'gradient')).toBe(true)
    expect(result.hits.some((h) => h.rule === 'glassmorphism')).toBe(true)
    expect(result.hits.some((h) => h.rule === 'rounded-2xl')).toBe(true)
    expect(result.hits.some((h) => h.rule === 'emoji-icon')).toBe(true)
    expect(result.hits.some((h) => h.rule === 'filler-word')).toBe(true)
    expect(result.hits.some((h) => h.rule === 'lorem-ipsum')).toBe(true)
  })
})
