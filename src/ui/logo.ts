import { palette } from './theme.js'

/**
 * The terminal wordmark.
 *
 * The SVG in assets/ is the canonical logo; this is its terminal rendering.
 * Flat colours only — no gradients, no glow.
 */

const AMBER = palette.amber
const INK = palette.ink

export const LOGO_LINES = [
  `${AMBER}●${INK}  ┌─────────────────────────┐`,
  `${AMBER}●${INK}  │  ${AMBER}i${INK}d${AMBER}r${INK}i${AMBER}✕${INK}  idrix`,
  `${AMBER}●${INK}  └─────────────────────────┘`,
]

/** The small "ix" monogram used for the favicon/avatar. */
export const MONOGRAM = `${AMBER}i${INK}${AMBER}✕${INK}`
