import type { z } from 'zod'
import { tool } from 'ai'

import { ToolError, type ToolContext, type ToolDefinition, type ToolResult } from './types.js'
import {
  editFileTool,
  globTool,
  grepTool,
  listDirTool,
  readFileTool,
  writeFileTool,
} from './fs.js'
import { bashTool } from './bash.js'

export { ToolError }
export type { ToolContext, ToolDefinition, ToolResult }

/**
 * The built-in tool registry.
 *
 * Phase 1 ships the file tools and bash. Later phases add web_search, web_fetch,
 * screenshot, todo, ask_user and task.
 */
export const BUILTIN_TOOLS: ToolDefinition<never>[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  globTool,
  grepTool,
  bashTool,
] as unknown as ToolDefinition<never>[]

export function allToolDefinitions(): ToolDefinition<never>[] {
  return BUILTIN_TOOLS
}

export function findTool(name: string): ToolDefinition<never> | undefined {
  return BUILTIN_TOOLS.find((t) => t.name === name)
}

/** The names of the built-in tools, in registry order. */
export function toolNames(): string[] {
  return BUILTIN_TOOLS.map((t) => t.name)
}

/**
 * Convert our tool definitions into the AI SDK's ToolSet.
 *
 * The SDK `execute` is deliberately NOT used: Idrix runs its own permission
 * check before executing anything, so the SDK must only produce the tool call.
 * The agent loop executes the tool itself and appends the result.
 */
export function toSdkToolSet(
  names: string[],
): Record<string, ReturnType<typeof tool>> {
  const set: Record<string, ReturnType<typeof tool>> = {}
  for (const name of names) {
    const def = findTool(name)
    if (!def) continue
    set[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema as z.ZodType<never>,
    })
  }
  return set
}

/** Convert a tool result into the string the model sees. */
export function toolResultToText(result: ToolResult): string {
  if (result.type === 'text') return result.text
  if (result.type === 'error') return `Error: ${result.error}`
  return JSON.stringify(result.value)
}
