import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

import { resolveApiKey, type IdrixConfig, type ProviderConfig } from '../core/config.js'

/**
 * Provider registry (Phase 1 ships OpenRouter + Gemini + OpenAI-compatible;
 * the remaining providers arrive in Phase 3).
 *
 * API keys come from the environment (or the config's `apiKey`), never from
 * source, and are never logged (PROV-5).
 */

export interface ResolvedModel {
  model: LanguageModel
  providerName: string
  modelId: string
}

export class MissingApiKeyError extends Error {
  constructor(providerName: string, envVar: string | undefined) {
    super(
      envVar
        ? `No API key found for provider "${providerName}". Set the ${envVar} environment variable.`
        : `No API key found for provider "${providerName}". Add an apiKeyEnv to its config entry.`,
    )
    this.name = 'MissingApiKeyError'
  }
}

export class UnknownProviderError extends Error {
  constructor(providerName: string, known: string[]) {
    super(
      `Unknown provider "${providerName}". Known providers: ${known.join(', ') || '(none configured)'}.`,
    )
    this.name = 'UnknownProviderError'
  }
}

/** Build a LanguageModel for a provider/model pair. */
export function createModel(
  config: IdrixConfig,
  providerName: string,
  modelId: string,
): ResolvedModel {
  const provider: ProviderConfig | undefined = config.providers[providerName]
  if (!provider) {
    throw new UnknownProviderError(providerName, Object.keys(config.providers))
  }
  const apiKey = resolveApiKey(provider)

  switch (provider.type) {
    case 'openrouter': {
      if (!apiKey) throw new MissingApiKeyError(providerName, provider.apiKeyEnv)
      const openrouter = createOpenRouter({ apiKey })
      return { model: openrouter(modelId), providerName, modelId }
    }

    case 'google': {
      if (!apiKey) throw new MissingApiKeyError(providerName, provider.apiKeyEnv)
      const google = createGoogleGenerativeAI({ apiKey })
      return { model: google(modelId), providerName, modelId }
    }

    case 'openai-compatible':
    case 'openai':
    case 'ollama': {
      const baseURL = provider.baseURL ?? defaultBaseUrl(provider.type)
      const compatible = createOpenAICompatible({
        name: providerName,
        baseURL,
        apiKey: apiKey ?? '',
        ...(apiKey ? {} : { headers: {} }),
      })
      return { model: compatible(modelId), providerName, modelId }
    }

    case 'anthropic': {
      throw new Error(
        `Provider "${providerName}" is not supported yet. It arrives with the multi-provider phase.`,
      )
    }

    default: {
      const exhaustive: never = provider.type
      throw new Error(`Unsupported provider type: ${String(exhaustive)}`)
    }
  }
}

function defaultBaseUrl(type: ProviderConfig['type']): string {
  switch (type) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'ollama':
      return 'http://localhost:11434/v1'
    default:
      return 'http://localhost:8080/v1'
  }
}

/**
 * Resolve the model for a role (e.g. "code", "planner", "fast").
 * Roles map to a provider + model in the config.
 */
export function resolveRole(
  config: IdrixConfig,
  role: string,
): ResolvedModel {
  const roleConfig = config.roles[role]
  if (!roleConfig) {
    throw new Error(
      `Unknown role "${role}". Configured roles: ${Object.keys(config.roles).join(', ') || '(none)'}.`,
    )
  }
  return createModel(config, roleConfig.provider, roleConfig.model)
}
