import { describe, expect, it } from 'vitest'
import { assertLocal } from '../src/security/scope.js'

describe('assertLocal', () => {
  it('allows localhost', () => {
    expect(() => assertLocal('localhost')).not.toThrow()
  })

  it('allows IPv4 literal in 127.0.0.0/8', () => {
    expect(() => assertLocal('127.0.0.1')).not.toThrow()
    expect(() => assertLocal('127.0.0.0')).not.toThrow()
    expect(() => assertLocal('127.255.255.255')).not.toThrow()
  })

  it('allows ::1', () => {
    expect(() => assertLocal('::1')).not.toThrow()
  })

  it('refuses example.com with exact message', () => {
    expect(() => assertLocal('example.com')).toThrow(/Refused to scan example\.com/)
  })

  it('refuses non-internal IPs', () => {
    expect(() => assertLocal('192.168.1.5')).toThrow(/Refused to scan 192\.168\.1\.5/)
    expect(() => assertLocal('10.0.0.5')).toThrow(/Refused to scan 10\.0\.0\.5/)
    expect(() => assertLocal('172.16.0.1')).toThrow(/Refused to scan 172\.16\.0\.1/)
  })

  it('accepts https://localhost too', () => {
    expect(() => assertLocal('https://localhost')).not.toThrow()
  })
})
