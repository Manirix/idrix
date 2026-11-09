import { describe, expect, it } from 'vitest'
import type { ModelMessage } from 'ai'

import { runAgent } from '../src/core/agent.js'
import { MockLanguageModel } from './mock-provider.js'

/**
 * Agent-loop integration tests against a mock provider.
 * No network, no API key, no cost.
 */

describe('runAgent', () => {
  it('returns the model text when the model answers directly', async () => {
    const model = new MockLanguageModel([{ type: 'text', text: 'Hello there.' }])
    const messages: ModelMessage[] = [{ role: 'user', content: 'hi' }]

    const result = await runAgent({
      model,
      tools: {},
      messages,
      maxSteps: 5,
      executeTool: async () => {
        throw new Error('should not be called')
      },
    })

    expect(result.text).toBe('Hello there.')
    expect(result.steps).toBe(1)
    expect(result.aborted).toBe(false)
  })

  it('executes a requested tool and feeds the result back to the model', async () => {
    const model = new MockLanguageModel([
      { type: 'tool', toolName: 'read_file', input: { path: 'a.ts' } },
      { type: 'text', text: 'The file says hello.' },
    ])

    const messages: ModelMessage[] = [{ role: 'user', content: 'read a.ts' }]
    const seen: string[] = []

    const result = await runAgent({
      model,
      tools: {},
      messages,
      maxSteps: 5,
      executeTool: async (call) => {
        seen.push(call.toolName)
        return {
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.input,
          result: { type: 'text', text: 'file content here' },
          denied: false,
        }
      },
    })

    expect(seen).toEqual(['read_file'])
    expect(result.text).toBe('The file says hello.')
    expect(result.steps).toBe(2)

    // The conversation must contain the tool call and its result.
    const roles = messages.map((m) => m.role)
    expect(roles).toContain('assistant')
    expect(roles).toContain('tool')

    const toolMessage = messages.find((m) => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    const content = toolMessage!.content as Array<{ output: { value: string } }>
    expect(content[0]?.output.value).toBe('file content here')
  })

  it('passes a denial back to the model instead of running the tool', async () => {
    const model = new MockLanguageModel([
      { type: 'tool', toolName: 'write_file', input: { path: 'x.ts', content: 'y' } },
      { type: 'text', text: 'Understood, I will not write.' },
    ])

    const messages: ModelMessage[] = [{ role: 'user', content: 'write x.ts' }]
    const executed: boolean[] = []

    const result = await runAgent({
      model,
      tools: {},
      messages,
      maxSteps: 5,
      executeTool: async (call) => {
        // The permission engine said no before we got here, so the tool is
        // never executed; we just report the denial back to the model.
        if (call.toolName === 'write_file') {
          const error = 'The user declined this action.'
          return {
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            result: { type: 'error', error },
            denied: true,
            error,
          }
        }
        executed.push(true)
        return {
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.input,
          result: { type: 'text', text: 'ok' },
          denied: false,
        }
      },
    })

    expect(executed).toEqual([])
    expect(result.text).toBe('Understood, I will not write.')
  })

  it('stops at the step limit', async () => {
    const model = new MockLanguageModel([
      { type: 'tool', toolName: 'read_file', input: { path: 'a' } },
      { type: 'tool', toolName: 'read_file', input: { path: 'b' } },
      { type: 'tool', toolName: 'read_file', input: { path: 'c' } },
    ])

    const messages: ModelMessage[] = [{ role: 'user', content: 'loop' }]

    const result = await runAgent({
      model,
      tools: {},
      messages,
      maxSteps: 2,
      executeTool: async (call) => ({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
        result: { type: 'text', text: 'ok' },
        denied: false,
      }),
    })

    expect(result.hitStepLimit).toBe(true)
    expect(result.steps).toBe(2)
  })

  it('aborts cleanly when the signal is already aborted', async () => {
    const model = new MockLanguageModel([{ type: 'text', text: 'never' }])
    const controller = new AbortController()
    controller.abort()

    const result = await runAgent({
      model,
      tools: {},
      messages: [{ role: 'user', content: 'hi' }],
      maxSteps: 5,
      signal: controller.signal,
      executeTool: async () => {
        throw new Error('should not be called')
      },
    })

    expect(result.aborted).toBe(true)
    expect(result.steps).toBe(0)
  })

  it('streams text deltas to the caller', async () => {
    const model = new MockLanguageModel([{ type: 'text', text: 'streamed' }])
    const deltas: string[] = []

    await runAgent({
      model,
      tools: {},
      messages: [{ role: 'user', content: 'hi' }],
      maxSteps: 5,
      executeTool: async () => {
        throw new Error('should not be called')
      },
      events: {
        onTextDelta: (d) => deltas.push(d),
      },
    })

    expect(deltas.join('')).toBe('streamed')
  })
})
