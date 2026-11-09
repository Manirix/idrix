import type { z } from 'zod'

/**
 * Tool registry types.
 *
 * Every tool declares:
 *   - `name`          — the name the model calls
 *   - `description`   — shown to the model
 *   - `inputSchema`   — zod schema for the arguments
 *   - `execute`       — runs the tool
 *   - `readOnly`      — true for tools that never mutate the filesystem or run commands
 *   - `target`        — extracts the "target" string used for permission matching
 */

export interface ToolContext {
  /** Absolute project root; all file paths resolve inside it. */
  root: string
  /** Abort signal, propagated into long-running tools. */
  signal?: AbortSignal
  /** Called when the tool wants to stream output (bash). */
  onOutput?: (chunk: string) => void
  /** Snapshot a file before mutating it, so /undo can restore it. */
  checkpoint?: (filePath: string) => void
}

export interface ToolDefinition<I = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<I>
  execute: (input: I, ctx: ToolContext) => Promise<ToolResult> | ToolResult
  /** True when the tool only reads. Plan mode allows only read-only tools. */
  readOnly: boolean
  /**
   * Extract the permission-matching target from the input (a file path, a command,
   * a URL). Return undefined when the tool has no meaningful target.
   */
  target?: (input: I) => string | undefined
}

export type ToolResult =
  | { type: 'text'; text: string }
  | { type: 'json'; value: unknown }
  | { type: 'error'; error: string }

export function textResult(text: string): ToolResult {
  return { type: 'text', text }
}

export function jsonResult(value: unknown): ToolResult {
  return { type: 'json', value }
}

export function errorResult(error: string): ToolResult {
  return { type: 'error', error }
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolError'
  }
}
