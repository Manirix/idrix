import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'idrix-audit-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('runAudit', () => {
  it('declines when confirm is false — runs nothing', () => {
    const { runAudit } = require('../src/security/audit.js') as typeof import('../src/security/audit.js')
    const report = runAudit({ root, confirm: false })
    expect(report.ran).toBe(false)
    expect(report.reportPath).toBe('')
  })

  it('static-scan finds a planted injection in temp files', () => {
    writeFileSync(join(root, 'app.js'), `const q = "SELECT * FROM users WHERE name = '" + user + "'"\n`, 'utf8')
    const { runAudit } = require('../src/security/audit.js') as typeof import('../src/security/audit.js')
    const report = runAudit({ root })
    expect(report.ran).toBe(true)
    expect(report.findings.some((f) => f.rule === 'SQLI')).toBe(true)
  })

  it('records refusal of dynamic probe targets', () => {
    const { runAudit } = require('../src/security/audit.js') as typeof import('../src/security/audit.js')
    const report = runAudit({ root })
    expect(report.refusedTargets.length).toBeGreaterThan(0)
  })

  it('writes SECURITY_REPORT.md with a severity table', () => {
    writeFileSync(join(root, 'app.js'), `eval(userInput)\n`, 'utf8')
    const { runAudit } = require('../src/security/audit.js') as typeof import('../src/security/audit.js')
    const report = runAudit({ root })
    expect(existsSync(report.reportPath)).toBe(true)
    const md = readFileSync(report.reportPath, 'utf8')
    expect(md).toContain('| critical |')
    expect(md).toContain('Severity Rule File:Line Issue Exploit Fix')
  })

  it('cannot create SECURITY_REPORT.md outside root', () => {
    writeFileSync(join(root, 'deep.js'), `const q = "SELECT * FROM t" + x\n`, 'utf8')
    const { runAudit } = require('../src/security/audit.js') as typeof import('../src/security/audit.js')
    const report = runAudit({ root })
    expect(report.ran).toBe(true)
    expect(existsSync(report.reportPath)).toBe(true)
    expect(report.reportPath.startsWith(root)).toBe(true)
  })
})
