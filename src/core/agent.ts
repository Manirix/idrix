import { stepCountIs, streamText, type LanguageModel, type ModelMessage, type ToolSet } from 'ai'

import { toolResultToText, type ToolResult } from '../tools/index.js'

/**
 * The Idrix agent loop (CORE-1, CORE-2).
 *
 * One turn = one call to the model. The model may ask for tools; we execute
 * them (after the permission engine has approved them) and feed the results
 * back. The loop repeats until the model answers with text only, the step
 * limit is reached, or the user aborts.
 *
 * The SDK's own `execute` hook is deliberately not used: Idrix must check
 * permissions before *anything* runs, so the SDK only ever produces the tool
 * call and we execute it ourselves.
 */

export interface ToolCallRequest {
  toolCallId: string
  toolName: string
  input: unknown
}

export interface ToolExecutionOutcome {
  toolCallId: string
  toolName: string
  input: unknown
  result: ToolResult
  /** True when the user (or a deny rule) blocked the call. */
  denied: boolean
  /** Present when the tool failed; the model is told about it. */
  error?: string
}

export interface AgentEvents {
  /** Called for each streamed text delta. */
  onTextDelta?: (delta: string) => void
  /** Called once the model's text for a step is complete. */
  onTextComplete?: (text: string) => void
  /** Called when the model requests a tool. */
  onToolCall?: (call: ToolCallRequest) => void
  /** Called after a tool has run. */
  onToolResult?: (outcome: ToolExecutionOutcome) => void
  /** Called when a step finishes (1-based index). */
  onStepEnd?: (step: number) => void
}

export interface AgentOptions {
  model: LanguageModel
  /** SDK tool set, built from our tool definitions (no `execute`). */
  tools: ToolSet
  /** Conversation so far. Mutated in place as the loop progresses. */
  messages: ModelMessage[]
  /** Maximum number of model calls in one turn. */
  maxSteps: number
  /** Aborts the model call and every running tool. */
  signal?: AbortSignal
  /** Runs a tool. The caller is responsible for permission checks. */
  executeTool: (call: ToolCallRequest) => Promise<ToolExecutionOutcome>
  events?: AgentEvents
}

export interface AgentResult {
  /** The final assistant text. */
  text: string
  /** Number of model calls made. */
  steps: number
  /** True when the loop stopped because the user aborted. */
  aborted: boolean
  /** True when the loop stopped at the step limit. */
  hitStepLimit: boolean
  /** Non-fatal problems worth surfacing (e.g. a malformed tool call). */
  warnings: string[]
}

/** PRD §6: malformed tool calls retried 2x. Kept as comment only. */

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const { model, tools, messages, maxSteps, signal, executeTool, events } = options

  const warnings: string[] = []
  let steps = 0
  let lastText = ''
  let aborted = false

  for (let round = 0; round < maxSteps; round++) {
    if (signal?.aborted) {
      aborted = true
      break
    }

    steps = round + 1
    events?.onStepEnd?.(steps)

    const result = streamText({
      model,
      messages,
      tools,
      stopWhen: stepCountIs(1),
      abortSignal: signal,
    })

    let stepText = ''
    const toolCalls: ToolCallRequest[] = []

    try {
      for await (const part of result.stream) {
        switch (part.type) {
          case 'text-delta': {
            const delta = part.text
            stepText += delta
            events?.onTextDelta?.(delta)
            break
          }
          case 'tool-call': {
            const call: ToolCallRequest = {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            }
            toolCalls.push(call)
            events?.onToolCall?.(call)
            break
          }
          case 'error': {
            warnings.push(describeError(part.error))
            break
          }
          default:
            break
        }
      }
    } catch (err) {
      if (signal?.aborted) {
        aborted = true
        break
      }
      throw err
    }

    if (stepText !== '') {
      lastText = stepText
      events?.onTextComplete?.(stepText)
    }

    if (toolCalls.length === 0) {
      // The model answered with text only — the turn is done.
      return { text: lastText, steps, aborted: false, hitStepLimit: false, warnings }
    }

    // Preserve the assistant message containing the tool calls.
    messages.push({
      role: 'assistant',
      content: toolCalls.map((c) => ({
        type: 'tool-call' as const,
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        input: c.input,
      })),
    })

    const outcomes = await Promise.all(
      toolCalls.map(async (call) => {
        const outcome = await executeTool(call)
        events?.onToolResult?.(outcome)
        return outcome
      }),
    )

    // Feed the results back to the model.
    messages.push({
      role: 'tool',
      content: outcomes.map((o) => ({
        type: 'tool-result' as const,
        toolCallId: o.toolCallId,
        toolName: o.toolName,
        output: { type: 'text' as const, value: toolResultToText(o.result) },
      })),
    })

    if (signal?.aborted) {
      aborted = true
      break
    }
  }

  return {
    text: lastText,
    steps,
    aborted,
    hitStepLimit: !aborted && steps >= maxSteps,
    warnings,
  }
}

/** Human-readable description of a model/provider error. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}
