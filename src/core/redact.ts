/**
 * Secret redaction (TOOL-5).
 *
 * Everything that leaves Idrix toward the model — tool output, command stdout,
 * file contents, error messages — passes through `redactSecrets` first.
 *
 * Two sources of truth:
 *   1. Values of known API-key environment variables currently set.
 *   2. Heuristic patterns for common credential shapes.
 *
 * Redacted values are replaced with a stable placeholder so the model can still
 * reason about the *shape* of a value (e.g. "a 40-char token") without seeing it.
 */

export const REDACTED = '[REDACTED]'

/** Environment variables whose values are always treated as secrets. */
const SECRET_ENV_NAMES = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'DEEPSEEK_API_KEY',
  'MOONSHOT_API_KEY',
  'KIMI_API_KEY',
  'XAI_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'COHERE_API_KEY',
  'AZURE_API_KEY',
  'IDRIX_API_KEY',
]

/** Assignment patterns that look like credentials in file contents. */
const PATTERNS: Array<{ re: RegExp; group: number }> = [
  // api_key = "value"  /  API_KEY: 'value'  /  token=value
  {
    re: /\b((?:[A-Za-z0-9_]*(?:api[_-]?key|secret|password|passwd|pwd|token|access[_-]?key|private[_-]?key|client[_-]?secret|auth)[A-Za-z0-9_]*)\s*[:=]\s*)(["']?)([^\s"',;]{8,})\2/gi,
    group: 3,
  },
  // Bearer tokens
  { re: /\b(Bearer\s+)([A-Za-z0-9._-]{16,})/g, group: 2 },
  // AWS-style access key ids
  { re: /\b((?:AKIA|ASIA)[0-9A-Z]{16})\b/g, group: 1 },
  // GitHub tokens
  { re: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, group: 1 },
  // Slack tokens
  { re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g, group: 1 },
  // Private key blocks
  { re: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)([\s\S]*?)(-----END [A-Z ]*PRIVATE KEY-----)/g, group: 2 },
]

/** Values that are too short or too common to be a real secret. */
function isRedactableValue(value: string): boolean {
  const v = value.trim()
  if (v.length < 8) return false
  if (/^(true|false|null|none|undefined|changeme|placeholder|example|your[_-]?\w+|xxx+|\*+)$/i.test(v)) {
    return false
  }
  return true
}

let cachedEnvValues: string[] | null = null

function envSecretValues(): string[] {
  if (cachedEnvValues) return cachedEnvValues
  const values: string[] = []
  for (const name of SECRET_ENV_NAMES) {
    const v = process.env[name]
    if (v && v.trim().length >= 8) values.push(v.trim())
  }
  // Also catch any env var whose name looks secret-ish.
  for (const [name, v] of Object.entries(process.env)) {
    if (!name || !v) continue
    if (!/(api[_-]?key|secret|token|password|credential)/i.test(name)) continue
    if (SECRET_ENV_NAMES.includes(name)) continue
    if (v.trim().length >= 8) values.push(v.trim())
  }
  cachedEnvValues = values.sort((a, b) => b.length - a.length)
  return cachedEnvValues
}

/** Test hook: forget cached env secret values. */
export function resetSecretCache(): void {
  cachedEnvValues = null
}

/**
 * Redact secrets from a string.
 * Returns the input with secrets replaced by [REDACTED].
 */
export function redactSecrets(input: string): string {
  if (input === '') return input
  let out = input

  // 1. Exact known env values.
  for (const secret of envSecretValues()) {
    if (!isRedactableValue(secret)) continue
    out = out.split(secret).join(REDACTED)
  }

  // 2. Pattern matches.
  for (const { re, group } of PATTERNS) {
    out = out.replace(re, (...args: unknown[]) => {
      const m = args as unknown[]
      const whole = m[0] as string
      const value = m[group] as string | undefined
      if (!value || !isRedactableValue(value)) return whole
      const prefix = whole.slice(0, whole.indexOf(value))
      return prefix + REDACTED
    })
  }

  return out
}

/** Redact any value that may contain secrets, recursing into objects/arrays. */
export function redactValue<T>(value: T): T {
  if (typeof value === 'string') return redactSecrets(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => redactValue(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v)
    }
    return out as unknown as T
  }
  return value
}

/** True when the text looks like it contains a live credential. */
export function containsSecret(input: string): boolean {
  return redactSecrets(input) !== input
}
