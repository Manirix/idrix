import { z } from 'zod'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Idrix configuration.
 *
 * Two layers, merged in this order (later wins):
 *   1. global  ~/.idrix/config.json
 *   2. project .idrix/settings.json   (cwd)
 *
 * Provider API keys are NEVER stored here — only the *name* of the env var
 * that holds the key (PROV-5). The key itself lives in the environment or in
 * ~/.idrix/credentials (Phase 3).
 */

export const providerSchema = z.object({
  type: z.enum([
    'openrouter',
    'google',
    'openai-compatible',
    'openai',
    'anthropic',
    'ollama',
  ]),
  apiKeyEnv: z.string().optional(),
  baseURL: z.string().optional(),
  /** Static key. Discouraged; env var is preferred. Never logged. */
  apiKey: z.string().optional(),
})

export type ProviderConfig = z.infer<typeof providerSchema>

export const roleSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

export type RoleConfig = z.infer<typeof roleSchema>

export const configSchema = z.object({
  providers: z.record(z.string(), providerSchema).default({}),
  roles: z
    .record(z.string(), roleSchema)
    .default({
      code: { provider: 'openrouter', model: 'openrouter/free' },
      planner: { provider: 'openrouter', model: 'openrouter/free' },
      fast: { provider: 'openrouter', model: 'openrouter/free' },
    }),
  fallback: z.array(z.string()).default([]),
  limits: z
    .object({
      maxStepsPerTurn: z.number().int().positive().default(40),
      tokenBudgetPerTask: z.number().int().positive().default(400_000),
    })
    .default({ maxStepsPerTurn: 40, tokenBudgetPerTask: 400_000 }),
  permissions: z
    .object({
      allow: z.array(z.string()).default([]),
      ask: z.array(z.string()).default([]),
      deny: z.array(z.string()).default([]),
    })
    .default({ allow: [], ask: [], deny: [] }),
})

export type IdrixConfig = z.infer<typeof configSchema>

export const DEFAULT_CONFIG: IdrixConfig = configSchema.parse({})

/** Home directory for global Idrix state: ~/.idrix */
export function globalDir(): string {
  return join(homedir(), '.idrix')
}

export function globalConfigPath(): string {
  return join(globalDir(), 'config.json')
}

/** Project-local Idrix directory: <cwd>/.idrix */
export function projectDir(cwd: string): string {
  return join(cwd, '.idrix')
}

export function projectSettingsPath(cwd: string): string {
  return join(projectDir(cwd), 'settings.json')
}

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (err) {
    throw new Error(
      `Idrix: could not parse ${path}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Deep merge plain objects; arrays and scalars are replaced, not concatenated. */
export function mergeConfig<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T))
  }
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeConfig(current, value)
        : value
  }
  return out as T
}

/**
 * Load and merge global + project configuration.
 * Invalid config throws with a path so the user can fix it.
 */
export function loadConfig(cwd: string = process.cwd()): IdrixConfig {
  const global = readJsonFile(globalConfigPath())
  const project = readJsonFile(projectSettingsPath(cwd))
  const merged = mergeConfig(global, project)

  const parsed = configSchema.safeParse(merged)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`Idrix: invalid configuration — ${issues}`)
  }
  return parsed.data
}

/**
 * Resolve an API key for a provider.
 * Order: explicit config value → environment variable named by `apiKeyEnv`.
 * Returns undefined when no key is available (local providers may not need one).
 */
export function resolveApiKey(provider: ProviderConfig): string | undefined {
  if (provider.apiKey) return provider.apiKey
  if (provider.apiKeyEnv) {
    const fromEnv = process.env[provider.apiKeyEnv]
    if (fromEnv && fromEnv.trim() !== '') return fromEnv.trim()
  }
  return undefined
}
