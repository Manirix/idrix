import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MockLanguageModel } from './mock-provider.js'
import {
  bashTool,
  editFileTool,
  writeFileTool,
} from '../src/tools/fs.js'
import { runAgent, type ToolExecutionOutcome } from '../src/core/agent.js'

describe('acceptance: create hello.ts, edit, run', () => {
  it('rewrites hello.ts and echoes the bash output', async () => {
    const root = mkdtempSync(join(tmpdir(), 'idrix-p1-'))
    try {
      const model = new MockLanguageModel([
        {
          type: 'tool',
          toolName: 'write_file',
          input: { path: 'hello.ts', content: 'console.log("hi")\n' },
        },
        {
          type: 'tool',
          toolName: 'edit_file',
          input: {
            path: 'hello.ts',
            oldString: '"hi"',
            newString: '"hello"',
          },
        },
        {
          type: 'tool',
          toolName: 'bash',
          input: { command: 'echo idrix-works' },
        },
        { type: 'text', text: 'Prints hi at exit code 0.' },
      ])

      const messages: import('ai').ModelMessage[] = [{ role: 'user', content: 'print hi' }]

      const outcomes: ToolExecutionOutcome[] = []
      const outcome: ToolExecutionOutcome = await runAgent({
        model,
        tools: {},
        messages,
        maxSteps: 10,
        executeTool: (call): Promise<ToolExecutionOutcome> => {
          const def = call.input as Record<string, unknown>
          switch (call.toolName) {
            case 'write_file':
              return writeFileTool.execute(def, { root }).then((r) => record(call, r))
            case 'edit_file':
              return editFileTool.execute(def, { root }).then((r) => record(call, r))
            case 'bash':
              return bashTool.execute(def, { root }).then((r) => record(call, r))
            default:
              return recordFallback(call)
          }
        },
      })

      expect(outcome.text).toBe('Prints hi at exit code 0.')
      const contents = readFileSync(join(root, 'hello.ts'), 'utf8')
      expect(contents).toContain('console.log("hello")')

      for (const o of outcomes) {
        if (!o.result || typeof o.result.type !== 'string') {
          fail(`bad outcome from ${o.toolName}: ${JSON.stringify(o)}`)
        }
      }

      const toolResults = messages
        .filter((m) => m.role === 'tool')
        .map((m) => m.content as string)
      expect(toolResults.some((l) => l.includes('idrix-works'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

function record(call: import('ai').ToolCallRequest, result: import('../src/tools/types').ToolResult): Promise<ToolExecutionOutcome> {
  return Promise.resolve({ toolCallId: call.toolCallId, toolName: call.toolName, input: call.input, result, denied: false })
}

function recordFallback(call: import('ai').ToolCallRequest): Promise<ToolExecutionOutcome> {
  return Promise.resolve({
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
    result: { type: 'error', error: `Unknown tool: ${call.toolName}` },
    denied: false,
  })
}
