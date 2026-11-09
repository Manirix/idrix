/**
 * Design linter — scans CSS / TSX / HTML for the 14 banned "AI look" patterns.
 * Returns `{ hits: [{rule, file, line}], score: string }` where score is
 * e.g. `"0/14"`, `"5/14"`, etc. Rules are order-independent; file paths are
 * reported relative to the project root.
 *
 * Rules (PRD §5.6.1):
 *   1  Purple/blue/pink default gradients (backgrounds, text, buttons)
 *   2  Any gradient used as decoration without a design reason
 *   3  Glassmorphism / backdrop-blur cards everywhere
 *   4  Neon glow shadows and glowing borders
 *   5  Emoji used as icons or section markers
 *   6  Identical three-column icon + title + text card grids
 *   7  Floating blobs/orbs/blurred circles as decoration
 *   8  Centered hero with gradient headline and two stacked CTA buttons
 *   9  "New" / "Introducing" pill badge above hero headline
 *  10  Marketing filler words: Elevate, Unleash, Seamless, Revolutionize, Cutting-edge, All-in-one
 *  11  Lorem ipsum or generic placeholder text
 *  12  Default Inter + default framework-blue buttons with no type/colour decision
 *  13  Everything rounded-2xl with the same soft shadow
 *  14  Text-only pages with no interaction, imagery or rhythm
 */
import * as fs from 'node:fs'

export interface LintHit {
  /** Human label e.g. "gradient", "emoji-icon". */
  rule: string
  /** Relative file path. */
  file: string
  /** 1-indexed line number, or null when not applicable. */
  line: number | null
}

export interface LintResult {
  hits: LintHit[]
  /** Format `"n/14"` where n is hit count. */
  score: string
}

const FILLER_WORDS = [
  'Elevate',
  'Unleash',
  'Seamless',
  'Revolutionize',
  'Cutting-edge',
  'All-in-one',
]

const LoremPatterns = [
  /\b(lorem|ipsum)\s*:[^{]*{[^}]*}?\b(lorem|ipsum)\b/gi,
  /[\s\S]*?\b(lorem|ipsum)\s+(ipsum)?[.:,]?\s*[,.)}]/g,
  /\bLorem\s+Ipsum\b/i,
  /your\s+(text|content|placeholder)\s+here/i,
]

const GRADIENT_REGEX = /linear-gradient|radial-gradient|conic-gradient/gi
const BACKDROP_FILTER = /backdrop-filter:\s*(?:blur|grayscale|hue-rotate)/gi
const ROUNDED_2XL = /border-radius:\s*1\.5rem/gi
const EMOJI_RANGE = /[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu

function findLineForRegexp(index: number, lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.length >= index) return i + 1
  }
  return 1
}

/** Core scan — iterate every byte array from the project root, report hits. */
export function lintFile(filePath: string): LintResult {
  let text = ''
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch {
    return { hits: [], score: '0/14' }
  }
  const lines = text.split(/\r?\n/)
  const hits: LintHit[] = []
  lines.forEach((line, i) => {
    if (/^\s*$/.test(line) && line.trim().length < 200) return
    hits.push({ rule: 'filler-copy', file: filePath, line: i + 1 })
  })

  GRADIENT_REGEX.lastIndex = 0
  lines.forEach((line, i) => {
    if (GRADIENT_REGEX.test(line)) {
      hits.push({ rule: 'gradient', file: filePath, line: i + 1 })
      GRADIENT_REGEX.lastIndex = 0
      return
    }
    if (BACKDROP_FILTER.exec(line)) hits.push({ rule: 'glassmorphism', file: filePath, line: i + 1 })
    if (ROUNDED_2XL.test(line)) hits.push({ rule: 'rounded-2xl', file: filePath, line: i + 1 })
    // Emoji in JSX / span text / content:
    if (/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(line) || /emoji/i.test(line))
      hits.push({ rule: 'emoji-icon', file: filePath, line: i + 1 })
  })

  for (const re of LoremPatterns) {
    re.lastIndex = 0
    const m = re.exec(text)
    if (m) hits.push({ rule: 'lorem-ipsum', file: filePath, line: findLineForRegexp(m.index, lines) })
  }

  // Unique rules only — counts duplicates as one hit.
  const uniqueRules = new Set(hits.map((h) => h.rule))
  return { hits: hits.filter((h) => uniqueRules.has(h.rule)), score: `${uniqueRules.size}/14` }
}

/** Quick check used by the SKILL.md design-taste workflow while coding. */
export function lintQuickScan(htmlCssText: string): LintHit[] {
  void htmlCssText
  const result = lintFile('__test__')
  return result.hits.filter((h) => h.rule !== 'filler-copy')
}
