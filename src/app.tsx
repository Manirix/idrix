import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import { palette } from './ui/theme.js'
import { Launch } from './ui/Launch.js'
import { Chat, type ChatRow } from './ui/Chat.js'
import { PromptBox } from './ui/PromptBox.js'
import { StatusBar } from './ui/StatusBar.js'
import { Permission, type PermissionChoice, type PermissionRequestView } from './ui/Permission.js'

import { loadConfig, type IdrixConfig } from './core/config.js'
import { toolsForMode, type Mode } from './core/modes.js'
import { buildSystemPrompt } from './core/context.js'
import { checkPermission, type PermissionConfig } from './core/permissions.js'
import { runAgent, type ToolCallRequest, type ToolExecutionOutcome } from './core/agent.js'
import { Session, listSessions } from './core/session.js'
import { FileCheckpointStore } from './core/checkpoints.js'
import { resolveRole } from './providers/registry.js'
import { findTool, toSdkToolSet, toolResultToText } from './tools/index.js'
import { redactSecrets } from './core/redact.js'

export interface AppProps {
  root: string
  version: string
  /** Headless mode: run one prompt, print the result and exit. */
  headlessPrompt?: string
}

/** Pending permission request, resolved by the Permission component. */
interface PendingPermission {
  request: PermissionRequestView
  resolve: (choice: PermissionChoice, reason?: string) => void
}

export function App(props: AppProps): React.JSX.Element {
  const { exit } = useApp()

  const [config, setConfig] = useState<IdrixConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('build')
  const [rows, setRows] = useState<ChatRow[]>([])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingPermission | null>(null)
  const [sessions] = useState(() => listSessions())

  const abortRef = useRef<AbortController | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const checkpointsRef = useRef<FileCheckpointStore | null>(null)
  const rowIdRef = useRef(0)

  const nextId = (): string => {
    rowIdRef.current += 1
    return `r${rowIdRef.current}`
  }

  useEffect(() => {
    try {
      setConfig(loadConfig(props.root))
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : String(err))
    }
  }, [props.root])

  // shift+tab toggles the mode (MODE-2).
  useInput((input, key) => {
    if (key.tab && key.shift) {
      setMode((m) => (m === 'plan' ? 'build' : 'plan'))
    }
    if (key.escape && busy) {
      abortRef.current?.abort()
    }
  })

  const projectName = useMemo(() => {
    const parts = props.root.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] ?? props.root
  }, [props.root])

  /** Ask the user to approve a tool call. */
  const requestPermission = useCallback(
    (request: PermissionRequestView): Promise<PermissionChoice> =>
      new Promise((resolve) => {
        setPending({
          request,
          resolve: (choice, reason) => {
            setPending(null)
            resolve(choice)
            void reason
          },
        })
      }),
    [],
  )

  /** Run one turn of the agent loop. */
  const runTurn = useCallback(
    async (userText: string) => {
      if (!config) return

      const session = sessionRef.current ?? Session.create(props.root, userText)
      sessionRef.current = session
      const checkpoints =
        checkpointsRef.current ?? new FileCheckpointStore(props.root, session.id)
      checkpointsRef.current = checkpoints

      const toolSet = toolsForMode(mode)
      const permissionConfig: PermissionConfig = {
        rules: config.permissions,
      }

      const controller = new AbortController()
      abortRef.current = controller

      const userRowId = nextId()
      setRows((prev) => [...prev, { kind: 'user', id: userRowId, text: userText }])
      session.append({ role: 'user', content: userText })

      const assistantRowId = nextId()
      setRows((prev) => [
        ...prev,
        { kind: 'assistant', id: assistantRowId, text: '', streaming: true },
      ])

      // Execute one tool call, after the permission engine has approved it.
      const executeTool = async (
        call: ToolCallRequest,
      ): Promise<ToolExecutionOutcome> => {
        const def = findTool(call.toolName)
        const toolRowId = nextId()

        if (!def) {
          setRows((prev) => [...prev, {
            kind: 'tool',
            id: toolRowId,
            tool: call.toolName,
            status: 'failed',
            detail: 'Unknown tool',
          }])
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: { type: 'error', error: `Unknown tool: ${call.toolName}` },
            denied: false,
            error: 'Unknown tool',
          }
        }

        // Plan mode: the tool is absent, not merely denied (MODE-1).
        if (!toolSet.readonly.includes(call.toolName)) {
          const message =
            mode === 'plan'
              ? `${call.toolName} is not available in PLAN mode (read-only).`
              : `${call.toolName} is not allowed in this project.`
          setRows((prev) => [...prev, {
            kind: 'tool',
            id: toolRowId,
            tool: call.toolName,
            status: 'denied',
            detail: message,
          }])
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: { type: 'error', error: message },
            denied: true,
            error: message,
          }
        }

        const input = (call.input ?? {}) as Record<string, unknown>
        const target = def.target ? def.target(input as never) : undefined

        const decision = checkPermission(
          { tool: call.toolName, target, description: def.description },
          permissionConfig,
        )

        if (decision === 'deny') {
          const message = `Blocked by the project's deny rules.`
          setRows((prev) => [...prev, {
            kind: 'tool',
            id: toolRowId,
            tool: call.toolName,
            target,
            status: 'denied',
            detail: message,
          }])
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: { type: 'error', error: message },
            denied: true,
            error: message,
          }
        }

        if (decision === 'ask') {
          const choice = await requestPermission({
            tool: call.toolName,
            target,
            description: def.description,
            allowPersist: true,
          })
          if (choice === 'no') {
            const message = 'The user declined this action.'
            setRows((prev) => [...prev, {
              kind: 'tool',
              id: toolRowId,
              tool: call.toolName,
              target,
              status: 'denied',
              detail: message,
            }])
            return {
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: call.input,
              result: { type: 'error', error: message },
              denied: true,
              error: message,
            }
          }
        }

        setRows((prev) => [...prev, {
          kind: 'tool',
          id: toolRowId,
          tool: call.toolName,
          target,
          status: 'running',
        }])

        try {
          const result = await def.execute(input as never, {
            root: props.root,
            signal: controller.signal,
            checkpoint: (filePath) => {
              checkpoints.snapshot(filePath)
            },
            onOutput: (chunk) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.id === toolRowId && r.kind === 'tool'
                    ? { ...r, detail: (r.detail ?? '') + chunk }
                    : r,
                ),
              )
            },
          })

          // Secrets never leave the machine (TOOL-5).
          const safe =
            result.type === 'text'
              ? { type: 'text' as const, text: redactSecrets(result.text) }
              : result.type === 'error'
                ? { type: 'error' as const, error: redactSecrets(result.error) }
                : {
                    type: 'json' as const,
                    value: JSON.parse(redactSecrets(JSON.stringify(result.value))),
                  }

          setRows((prev) => prev.map((r) =>
            r.id === toolRowId && r.kind === 'tool' ? { ...r, status: 'done' } : r,
          ))

          session.append({
            role: 'tool',
            content: toolResultToText(safe),
            tool: call.toolName,
          })

          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: safe,
            denied: false,
          }
        } catch (err) {
          const message = redactSecrets(
            err instanceof Error ? err.message : String(err),
          )
          setRows((prev) => prev.map((r) =>
            r.id === toolRowId && r.kind === 'tool'
              ? { ...r, status: 'failed', detail: message }
              : r,
          ))
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: { type: 'error', error: message },
            denied: false,
            error: message,
          }
        }
      }

      setBusy(true)
      try {
        const role = resolveRole(config, 'code')
        const toolNames = toolSet.readonly.filter((n) => findTool(n) !== undefined)
        const sdkTools = toSdkToolSet(toolNames)

        const system = buildSystemPrompt({ root: props.root, mode })
        const messages: import('ai').ModelMessage[] = [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ]

        const result = await runAgent({
          model: role.model,
          tools: sdkTools,
          messages,
          maxSteps: config.limits.maxStepsPerTurn,
          signal: controller.signal,
          executeTool,
          events: {
            onTextDelta: (delta) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.id === assistantRowId && r.kind === 'assistant'
                    ? { ...r, text: r.text + delta }
                    : r,
                ),
              )
            },
            onToolCall: (call) => {
              void call
              setRows((prev) =>
                prev.map((r) =>
                  r.id === assistantRowId && r.kind === 'assistant'
                    ? { ...r, streaming: false }
                    : r,
                ),
              )
            },
          },
        })

        setRows((prev) =>
          prev.map((r) =>
            r.id === assistantRowId && r.kind === 'assistant'
              ? { ...r, text: result.text, streaming: false }
              : r,
          ),
        )

        if (result.text) {
          session.append({ role: 'assistant', content: result.text })
        }
        if (result.aborted) {
          setRows((prev) => [...prev, {
            kind: 'notice',
            id: nextId(),
            text: 'Interrupted. No partial files were left behind.',
          }])
        }
        if (result.hitStepLimit) {
          setRows((prev) => [...prev, {
            kind: 'notice',
            id: nextId(),
            text: `Stopped after ${result.steps} steps (limit ${config.limits.maxStepsPerTurn}).`,
          }])
        }
      } catch (err) {
        const message = redactSecrets(
          err instanceof Error ? err.message : String(err),
        )
        setRows((prev) => [...prev, {
          kind: 'error',
          id: nextId(),
          text: message,
        }])
      } finally {
        setBusy(false)
        abortRef.current = null
      }
    },
    [config, mode, props.root, requestPermission],
  )

  // Headless mode: run one prompt and exit.
  useEffect(() => {
    if (!props.headlessPrompt || !config) return
    void runTurn(props.headlessPrompt).then(() => {
      exit()
    })
  }, [config, props.headlessPrompt, runTurn, exit])

  if (configError) {
    return (
      <Box flexDirection="column">
        <Text color={palette.error}>✕ {configError}</Text>
      </Box>
    )
  }

  if (!config) {
    return <Text color={palette.dim}>Loading…</Text>
  }

  return (
    <Box flexDirection="column">
      {rows.length === 0 ? (
        <Launch
          version={props.version}
          sessions={sessions}
          projectName={projectName}
        />
      ) : (
        <Chat rows={rows} />
      )}

      <Box marginTop={1}>
        {pending ? (
          <Permission
            request={pending.request}
            onDecision={(choice, reason) => pending.resolve(choice, reason)}
          />
        ) : (
          <PromptBox
            mode={mode}
            busy={busy}
            onSubmit={(text) => {
              void runTurn(text)
            }}
          />
        )}
      </Box>

      <StatusBar mode={mode} />
    </Box>
  )
}
