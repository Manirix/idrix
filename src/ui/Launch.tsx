import React from 'react'
import { Box, Text } from 'ink'

import { palette } from './theme.js'
import { LOGO_LINES } from './logo.js'
import type { SessionSummary } from '../core/session.js'

/**
 * The launch screen (PRD §4 "New chat / launch").
 *
 * It shows ONLY: the Idrix logo and version, "Tips to start", "Recent sessions",
 * the prompt box and the status bar. No model list, no skills list, no MCP list.
 */

const TIPS = [
  'Describe what you want built — Idrix plans, then acts.',
  'Press shift+tab to switch between PLAN and BUILD.',
  'Idrix asks before writing files or running commands.',
  'Type /help to see every command.',
]

export function Launch(props: {
  version: string
  sessions: SessionSummary[]
  projectName: string
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginTop={1}>
        {LOGO_LINES.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        <Text color={palette.dim}>v{props.version}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={palette.amber}>Tips to start</Text>
        {TIPS.map((tip, i) => (
          <Box key={i} paddingLeft={1}>
            <Text color={palette.dim}>· </Text>
            <Text color={palette.ink}>{tip}</Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={palette.amber}>Recent sessions</Text>
        {props.sessions.length === 0 ? (
          <Box paddingLeft={1}>
            <Text color={palette.dim}>No sessions yet — /resume to pick one later.</Text>
          </Box>
        ) : (
          props.sessions.slice(0, 5).map((s) => (
            <Box key={s.id} paddingLeft={1}>
              <Text color={palette.dim}>· </Text>
              <Text color={palette.ink}>{s.title}</Text>
            </Box>
          ))
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={palette.dim}>{props.projectName}</Text>
      </Box>
    </Box>
  )
}
