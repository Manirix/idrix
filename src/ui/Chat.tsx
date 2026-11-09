import React from 'react'
import { Box, Text } from 'ink'

import { palette } from './theme.js'

/**
 * The chat transcript.
 *
 * Rows follow the PRD's terminal style:
 *   ● step bullet
 *   ⎿ sub-step
 *   › prompt
 */

export type ChatRow =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean }
  | { kind: 'tool'; id: string; tool: string; target?: string; status: 'running' | 'done' | 'failed' | 'denied'; detail?: string }
  | { kind: 'error'; id: string; text: string }
  | { kind: 'notice'; id: string; text: string }

export function Chat(props: { rows: ChatRow[] }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      {props.rows.map((row) => (
        <ChatRowView key={row.id} row={row} />
      ))}
    </Box>
  )
}

function ChatRowView(props: { row: ChatRow }): React.JSX.Element {
  const { row } = props

  switch (row.kind) {
    case 'user':
      return (
        <Box>
          <Text color={palette.amber}>› </Text>
          <Text>{row.text}</Text>
        </Box>
      )

    case 'assistant':
      return (
        <Box>
          <Text color={palette.ink}>{row.text}</Text>
          {row.streaming ? <Text color={palette.dim}>▋</Text> : null}
        </Box>
      )

    case 'tool': {
      const icon =
        row.status === 'running'
          ? '●'
          : row.status === 'done'
            ? '✓'
            : row.status === 'denied'
              ? '⊘'
              : '✕'
      const color =
        row.status === 'done'
          ? palette.success
          : row.status === 'failed'
            ? palette.error
            : row.status === 'denied'
              ? palette.dim
              : palette.amber
      return (
        <Box flexDirection="column">
          <Box>
            <Text color={color}>{icon} </Text>
            <Text color={palette.ink}>{row.tool}</Text>
            {row.target ? <Text color={palette.dim}> {row.target}</Text> : null}
          </Box>
          {row.detail ? (
            <Box paddingLeft={2}>
              <Text color={palette.dim}>⎿ {row.detail}</Text>
            </Box>
          ) : null}
        </Box>
      )
    }

    case 'error':
      return (
        <Box>
          <Text color={palette.error}>✕ </Text>
          <Text color={palette.error}>{row.text}</Text>
        </Box>
      )

    case 'notice':
      return (
        <Box>
          <Text color={palette.dim}>{row.text}</Text>
        </Box>
      )
  }
}
