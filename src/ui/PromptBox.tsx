import React, { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

import { palette } from './theme.js'
import type { Mode } from '../core/modes.js'

/**
 * The prompt box.
 *
 * A single-line input with the `›` prompt character. In plan mode the prompt
 * character turns blue so the mode is obvious at a glance.
 */
export function PromptBox(props: {
  mode: Mode
  busy: boolean
  onSubmit: (text: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const isPlan = props.mode === 'plan'

  return (
    <Box>
      <Text color={isPlan ? palette.info : palette.amber}>› </Text>
      {props.busy ? (
        <Text color={palette.dim}>working… (esc to interrupt)</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={(submitted) => {
            if (submitted.trim() === '') return
            setValue('')
            props.onSubmit(submitted)
          }}
          focus
        />
      )}
    </Box>
  )
}
