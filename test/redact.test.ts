import { describe, expect, it, beforeEach } from 'vitest'

import { containsSecret, redactSecrets, resetSecretCache } from '../src/core/redact.js'

describe('redactSecrets', () => {
  beforeEach(() => {
    resetSecretCache()
  })

  it('redacts a known API key from the environment', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-abcdef1234567890abcdef'
    resetSecretCache()
    const text = 'Authorization: Bearer sk-or-v1-abcdef1234567890abcdef'
    const out = redactSecrets(text)
    expect(out).not.toContain('sk-or-v1-abcdef1234567890abcdef')
    expect(out).toContain('[REDACTED]')
    delete process.env.OPENROUTER_API_KEY
  })

  it('redacts an assignment-style secret', () => {
    const text = 'const apiKey = "super-secret-value-1234"'
    const out = redactSecrets(text)
    expect(out).not.toContain('super-secret-value-1234')
  })

  it('redacts .env style assignments', () => {
    const text = 'DATABASE_PASSWORD=hunter2hunter2hunter2'
    expect(redactSecrets(text)).not.toContain('hunter2hunter2hunter2')
  })

  it('leaves ordinary text alone', () => {
    const text = 'const total = 42; // a normal comment'
    expect(redactSecrets(text)).toBe(text)
  })

  it('does not redact placeholder values', () => {
    const text = 'API_KEY=your_api_key_here'
    expect(redactSecrets(text)).toBe(text)
  })

  it('redacts a private key block', () => {
    const text = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEowIBAAKCAQEA1234567890',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n')
    const out = redactSecrets(text)
    expect(out).not.toContain('MIIEowIBAAKCAQEA1234567890')
  })

  it('containsSecret detects whether redaction changed the text', () => {
    expect(containsSecret('API_KEY=abcdefghijklmnop')).toBe(true)
    expect(containsSecret('nothing here')).toBe(false)
  })
})
