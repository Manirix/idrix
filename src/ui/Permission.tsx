import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

import { palette } from './theme.js'

/**
 * The permission prompt (PRD §4 "Permission prompt").
 *
 * Choices:
 *   1. yes
 *   2. yes, don't ask again for this project
 *   3. no, and tell Idrix why
 *
 * The "don't ask again" choice is only offered for rules that can be persisted
 * (a command pattern or a path), never for a one-off.
 */

export type PermissionChoice = 'yes' | 'yes-always' | 'no'

export interface PermissionRequestView {
  /** The tool being requested, e.g. "bash". */
  tool: string
  /** The target: a command, a file path, a URL. */
  target?: string
  /** Extra explanation shown to the user. */
  description?: string
  /** Whether "don't ask again" can be persisted for this request. */
  allowPersist?: boolean
}

export function Permission(props: {
  request: PermissionRequestView
  onDecision: (choice: PermissionChoice, reason?: string) => void
}): React.JSX.Element {
  const [index, setIndex] = useState(0)

  const options: Array<{ label: string; value: PermissionChoice }> = [
    { label: 'yes', value: 'yes' },
    ...(props.request.allowPersist === false
      ? []
      : [{ label: "yes, don't ask again for this project", value: 'yes-always' as const }]),
    { label: 'no, and tell Idrix what to do instead', value: 'no' },
  ]

  useInput((input, key) => {
    if (key.downArrow || input === 'j') {
      setIndex((i) => (i + 1) % options.length)
    } else if (key.upArrow || input === 'k') {
      setIndex((i) => (i - 1 + options.length) % options.length)
    } else if (key.return) {
      const chosen = options[index]
      props.onDecision(chosen ? chosen.value : 'no')
    }
  })

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color={palette.amber}>● </Text>
        <Text color={palette.ink} bold>
          {props.request.tool}
          {props.request.target ? ' wants to run' : ' is waiting for approval'}
        </Text>
      </Box>

      {props.request.target ? (
        <Box paddingLeft={2}>
          <Text color={palette.ink}>{props.request.target}</Text>
        </Box>
      ) : null}

      {props.request.description ? (
        <Box paddingLeft={2}>
          <Text color={palette.dim}>{props.request.description}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" paddingLeft={2} paddingTop={1}>
        {options.map((opt, i) => (
          <Box key={opt.value}>
            <Text color={i === index ? palette.amber : palette.dim}>
              {i === index ? '› ' : '  '}
            </Text>
            <Text color={i === index ? palette.ink : palette.dim}>{opt.label}</Text>
          </Box>
        ))}
      </Box>

      <Box paddingLeft={2}>
        <Text color={palette.dim}>↑↓ choose · enter confirm</Text>
      </Box>
    </Box>
  )
}
