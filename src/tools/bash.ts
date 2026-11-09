import { z } from 'zod'
import { spawn } from 'node:child_process'

import { defaultShell, killProcessTree } from '../core/shell.js'
import { ToolError, textResult, type ToolDefinition } from './types.js'

/**
 * The `bash` tool (TOOL-2).
 *
 * Runs a command in the project root with a timeout, streams output, and kills
 * the whole process tree when the run is cancelled or times out.
 *
 * On Windows the command runs through PowerShell; on macOS/Linux through
 * /bin/sh. The tool name stays `bash` because that is what models expect.
 */

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 600_000
const MAX_OUTPUT_BYTES = 100_000

export const bashTool: ToolDefinition<{
  command: string
  timeout?: number
  description?: string
}> = {
  name: 'bash',
  description:
    'Run a shell command in the project root and return its output. ' +
    'Use it to run tests, builds, git, and other CLI tools. ' +
    'The shell is PowerShell on Windows and /bin/sh on macOS and Linux. ' +
    'The command runs for a limited time and the process tree is killed on cancel.',
  inputSchema: z.object({
    command: z.string().describe('The command to run'),
    timeout: z
      .number()
      .int()
      .min(1)
      .max(MAX_TIMEOUT_MS)
      .optional()
      .describe(`Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS})`),
    description: z.string().optional().describe('Short description of what the command does'),
  }),
  readOnly: false,
  target: (i) => i.command,
  execute: (input, ctx) => {
    const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
    const shell = defaultShell()

    return new Promise((resolve, reject) => {
      let child: ReturnType<typeof spawn>
      try {
        child = spawn(shell.command, [...shell.args, input.command], {
          cwd: ctx.root,
          // On POSIX, detached makes the child a process-group leader so we can
          // kill the whole tree with a negative PID.
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env, NO_COLOR: '1' },
        })
      } catch (err) {
        reject(
          new ToolError(
            `Could not start shell (${shell.command}): ${err instanceof Error ? err.message : String(err)}`,
          ),
        )
        return
      }

      let stdout = ''
      let stderr = ''
      let settled = false
      let timedOut = false
      let cancelled = false

      const append = (chunk: string, isErr: boolean): void => {
        const text = chunk.toString()
        if (isErr) stderr += text
        else stdout += text
        ctx.onOutput?.(text)
      }

      child.stdout?.on('data', (c: Buffer) => append(c.toString(), false))
      child.stderr?.on('data', (c: Buffer) => append(c.toString(), true))

      const timer = setTimeout(() => {
        timedOut = true
        stop()
      }, timeout)

      const onAbort = (): void => {
        cancelled = true
        stop()
      }
      ctx.signal?.addEventListener('abort', onAbort, { once: true })

      function stop(): void {
        if (child.pid !== undefined) {
          try {
            killProcessTree(child.pid)
          } catch {
            /* best effort */
          }
        }
      }

      function cleanup(): void {
        clearTimeout(timer)
        ctx.signal?.removeEventListener('abort', onAbort)
      }

      child.on('error', (err) => {
        if (settled) return
        settled = true
        cleanup()
        reject(new ToolError(`Command failed to start: ${err.message}`))
      })

      child.on('close', (code, signal) => {
        if (settled) return
        settled = true
        cleanup()

        const out = truncate(stdout)
        const err = truncate(stderr)
        const parts: string[] = []
        if (out) parts.push(out)
        if (err) parts.push(`[stderr]\n${err}`)

        if (cancelled) {
          resolve(textResult(`Command cancelled by user.\n${parts.join('\n')}`.trimEnd()))
          return
        }
        if (timedOut) {
          resolve(
            textResult(
              `Command timed out after ${timeout}ms and was killed.\n${parts.join('\n')}`.trimEnd(),
            ),
          )
          return
        }

        const status =
          code !== null ? `exit code ${code}` : `terminated by signal ${signal ?? 'unknown'}`
        parts.push(`[${status}]`)
        resolve(textResult(parts.join('\n')))
      })
    })
  },
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_BYTES) return text
  const head = text.slice(0, MAX_OUTPUT_BYTES)
  return `${head}\n… (output truncated, ${text.length - MAX_OUTPUT_BYTES} more characters)`
}
