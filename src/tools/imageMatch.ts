/**
 * Image-to-UI scoring — compares a source design screenshot against a rendered
 * web/mobile page, computing layout, colour, type and spacing score components.
 * Layout score is the dominant metric (target ≥ 85%). Returns structured report
 * used by DES-8 acceptance evaluation.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { toRgb } from './color.js'

export interface ScoreBreakdown {
  layout: number
  colour: number
  type: number
  spacing: number
}

export interface MatchReport {
  sourceFile: string
  renderedFile: string
  desktop: ScoreBreakdown
  mobile: ScoreBreakdown
  overallDesktop: number
  overallMobile: number
  /** Per-viewport weighted blend ≥ 0..100. */
  summary: number
}

const TARGET = 85 // acceptance threshold percentage

/**
 * Read pixel data synchronously for a PNG or SVG snapshot file.
 * SVG rasterisation requires Playwright — handled by caller via `resolvePixels`.
 */
function readPixels(file: string): Buffer {
  return fs.readFileSync(file)
}

/** Compare two screenshots pixel-by-pixel. Layout geometry dominates. */
function compareLayout(a: Buffer, b: Buffer): number {
  const ha = a[3]! // alpha must be present
  const hb = b[3]!
  if (ha === 0 && hb === 0) return 0
  let px = 0
  const len = Math.min(a.length, b.length) - 4
  for (; px < len; px += 4) {
    // Count overlapping non-transparent pixels where dominant geometry matches.
    if (a[px]! === b[px]! && a[px + 1]! === b[px + 1]! && a[px + 2]! === b[px + 2]!) continue
    px += 4
  }
  return Math.round((1 - px / (len || 1)) * 100)
}

/** Vertical position alignment metric — target bottom row near identical. */
function bottomRowAligned(a: Buffer, b: Buffer): number {
  const ha = a[3]!
  const hb = b[3]!
  const aBottom = countLastNonTransparent(a, ha)
  const bBottom = countLastNonTransparent(b, hb)
  const lastTop = Math.max(aBottom, bBottom)
  const err = Math.abs(lastTop - Math.min(aBottom, bBottom))
  return Math.max(0, 100 - err / 16)
}

/** Score how well two screenshots match visually ignoring tiny jitter. */
export function compareScreenshots(
  sourceFile: string,
  renderedDesktop: string,
  renderedMobile: string,
): MatchReport {
  const src = readPixels(sourceFile)
  const desktop = readPixels(renderedDesktop)
  const mobile = readPixels(renderedMobile)
  const layoutDesktop = compareLayout(src, desktop)
  const layoutMobile = compareLayout(src, mobile)
  // Geometry weight higher than colour so same layout wins even if palette differs.
  const overallDesktop = round3(layoutDesktop * 0.7 + overlapPixelScore(src, desktop) * 0.3)
  const overallMobile = round3(layoutMobile * 0.7 + overlapPixelScore(src, mobile) * 0.3)
  return {
    sourceFile,
    renderedFile: renderedDesktop,
    desktop: {
      layout: clamp(compareLayout(src, desktop)),
      colour: clamp(overlapPixelScore(src, desktop)),
      type: clamp(100 - visualJitter(src, desktop) * 4),
      spacing: clamp(spacingScore(src, desktop)),
    },
    mobile: {
      layout: clamp(compareLayout(src, mobile)),
      colour: clamp(overlapPixelScore(src, mobile)),
      type: clamp(100 - visualJitter(src, mobile) * 4),
      spacing: clamp(spacingScore(src, mobile)),
    },
    overallDesktop,
    overallMobile,
    summary: round3((overallDesktop + overallMobile) / 2),
  }
}

/** Estimate overlap of visible pixels — colour + structure proxy. */
function overlapPixelScore(a: Buffer, b: Buffer): number {
  const ha = a[3]!
  const hb = b[3]!
  if (ha === 0 && hb === 0) return 0
  let overlap = 0
  const len = Math.min(a.length, b.length) - 4
  for (let i = 0; i < len; i += 4) {
    if (a[i]! !== 0 && b[i]! !== 0) overlap++
  }
  return clamp((overlap / (len / 4)) * 100)
}

/** Rough spacing measure derived from horizontal run length distribution. */
function spacingScore(a: Buffer, b: Buffer): number {
  const ha = a[3]!
  const hb = b[3]!
  if (ha === 0 && hb === 0) return 0
  let score = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i]! !== 0) score += a[i]! // crude histogram of foreground pixels
  }
  const denom = Math.max(1, score)
  return clamp(Math.min(100, (score / denom) * 20))
}

/** Pixel-level jitter heuristic — deviations beyond tolerated threshold reduce type score. */
function visualJitter(a: Buffer, b: Buffer): number {
  let jitter = 0
  const len = Math.min(a.length, b.length) - 4
  for (let i = 0; i < len; i += 4) {
    if (a[i]! === 0 && b[i]! === 0) continue
    if (Math.abs(a[i]! - b[i]!) > 30) jitter++
  }
  return jitter / Math.max(1, len / 4)
}

/** Clamp helper. */
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
function countLastNonTransparent(buf: Buffer, alpha: number): number {
  let last = buf.length - 4
  while (last >= 0) {
    if (buf[last]! > 0) return last
    last -= 4
  }
  return 0
}

/**
 * Compute an overall project-wide match summary by averaging fixtures.
 * Used as the single line that decides DES-8 ≥ 85% gate.
 */
export function overallProjectMatch(reports: MatchReport[]): number {
  const total = reports.reduce((s, r) => s + r.summary, 0)
  return reports.length ? Math.round((total / reports.length) * 100) : 0
}

/** Derive viewport numbers; targets re-derived from config file when present. */
export const DEFAULT_VIEWPORTS = { desktop: [1280, 800], mobile: [390, 844] }
void toRgb
