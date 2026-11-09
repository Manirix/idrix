import React from 'react'
import { Box, Text } from 'ink'

import { palette } from './theme.js'
import type { Mode } from '../core/modes.js'

/**
 * The status bar (PRD §4).
 *
 * Always shows: the mode pill (BUILD amber / PLAN blue), a shift+tab hint and
 * a short command hint.
 */
export function StatusBar(props: {
  mode: Mode
  cost?: string
  hint?: string
}): React.JSX.Element {
  const isPlan = props.mode === 'plan'
  const pillColor = isPlan ? palette.info : palette.amber

  return (
    <Box paddingTop={1}>
      <Text color={pillColor}>● {isPlan ? 'PLAN' : 'BUILD'}</Text>
      <Text color={palette.dim}> · shift+tab mode</Text>
      <Text color={palette.dim}> · /help commands</Text>
      {props.cost ? <Text color={palette.dim}> · {props.cost}</Text> : null}
      {props.hint ? <Text color={palette.dim}> · {props.hint}</Text> : null}
    </Box>
  )
}
