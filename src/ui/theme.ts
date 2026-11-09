// Idrix palette — PRD §3
// Flat. No gradients, no glow.

export const palette = {
  background: '#121211',
  ink: '#d9d5c9',
  amber: '#e8b04a',
  amberLight: '#c98a1d', // for light backgrounds
  success: '#86c27f',
  error: '#e0705f',
  info: '#7fb0d9',
  violet: '#b79ad6',
  dim: '#77746a',
  line: '#2c2b27',
} as const

export type PaletteKey = keyof typeof palette

// Theme modes for NO_COLOR / force-color
export const themes = {
  dark: palette,
  light: {
    ...palette,
    background: '#f5f3ed',
    ink: '#1a1917',
    amber: '#c98a1d',
    line: '#d9d5c9',
  },
  none: {
    background: '',
    ink: '',
    amber: '',
    amberLight: '',
    success: '',
    error: '',
    info: '',
    violet: '',
    dim: '',
    line: '',
  },
} as const