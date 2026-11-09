import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from 'ai'

/**
 * A mock language model for agent-loop tests.
 *
 * It replays a scripted list of steps and needs no network, no API key and no
 * cost. Each step is either:
 *   { type: 'text', text }                 → the model answers with text
 *   { type: 'tool', toolName, input }      → the model requests a tool
 *
 * The mock implements the LanguageModelV4 interface (the version AI SDK v7
 * drives natively), so `streamText` consumes the stream as-is.
 */

export interface MockStep {
  type: 'text' | 'tool'
  text?: string
  toolName?: string
  input?: unknown
}

export interface MockModelCall {
  prompt: LanguageModelV4Prompt
  tools: unknown
}

export class MockLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4'
  readonly provider = 'mock'
  readonly modelId = 'mock-model'
  readonly supportedUrls: Record<string, RegExp[]> = {}

  /** Every call the model received, in order. */
  readonly calls: MockModelCall[] = []

  private stepIndex = 0

  constructor(private readonly steps: MockStep[]) {}

  doStream(options: LanguageModelV4CallOptions): LanguageModelV4StreamResult {
    this.calls.push({ prompt: options.prompt, tools: options.tools })

    const step = this.steps[this.stepIndex] ?? { type: 'text', text: 'done' }
    this.stepIndex += 1

    const parts = buildParts(step, this.stepIndex)

    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      start(controller) {
        for (const part of parts) controller.enqueue(part)
        controller.close()
      },
    })

    return { stream, request: {}, response: { headers: {} } }
  }

  doGenerate(options: LanguageModelV4CallOptions): LanguageModelV4GenerateResult {
    this.calls.push({ prompt: options.prompt, tools: options.tools })

    const step = this.steps[this.stepIndex] ?? { type: 'text', text: 'done' }
    this.stepIndex += 1

    const parts = buildParts(step, this.stepIndex)
    const content = parts
      .filter(
        (p): p is Extract<LanguageModelV4StreamPart, { type: 'text-delta' }> =>
          p.type === 'text-delta',
      )
      .map((p) => ({ type: 'text' as const, text: p.delta }))

    return {
      content,
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    }
  }
}

/** Build the stream parts for one scripted step. */
function buildParts(step: MockStep, index: number): LanguageModelV4StreamPart[] {
  const parts: LanguageModelV4StreamPart[] = [
    { type: 'stream-start', warnings: [] },
  ]

  if (step.type === 'text') {
    parts.push(
      { type: 'text-start', id: 'txt-1' },
      { type: 'text-delta', id: 'txt-1', delta: step.text ?? '' },
      { type: 'text-end', id: 'txt-1' },
    )
  } else {
    const toolCallId = `call-${index}`
    parts.push(
      { type: 'tool-input-start', id: toolCallId, toolName: step.toolName ?? 'read_file' },
      {
        type: 'tool-call',
        toolCallId,
        toolName: step.toolName ?? 'read_file',
        // The V4 wire format carries the input as a JSON string; the SDK
        // parses it back into an object before handing it to the caller.
        input: JSON.stringify(step.input ?? {}),
        providerExecuted: false,
      },
    )
  }

  parts.push({
    type: 'finish',
    finishReason: {
      unified: step.type === 'tool' ? 'tool-calls' : 'stop',
      raw: undefined,
    },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    },
  })

  return parts
}

/** Convenience: build a mock that answers with the given texts in order. */
export function mockModel(...texts: string[]): MockLanguageModel {
  return new MockLanguageModel(texts.map((text) => ({ type: 'text', text })))
}
