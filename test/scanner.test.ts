import { describe, expect, it } from 'vitest'
import { scanFile } from '../src/security/scanner.js'

describe('scanFile', () => {
  it('reports SQL injection on string-concatenated queries', () => {
    const out = scanFile('app.js', `const name = req.body.name\nconst q = "SELECT * FROM users WHERE name = '" + name + "'" --\n`)
    expect(out.find((f) => f.rule === 'SQLI')?.severity).toBe('high')
  })

  it('does not flag parameterized queries with placeholders', () => {
    const out = scanFile('app.js', `db.query("SELECT * FROM users WHERE id = ?", [id])\n`)
    expect(out.find((f) => f.rule === 'SQLI')).toBeUndefined()
  })

  it('flags command injection via exec($)', () => {
    const out = scanFile('app.js', `exec("curl " + userInput)\n`)
    expect(out.some((f) => f.rule === 'COMMAND_INJECTION')).toBe(true)
  })

  it('flags eval on untrusted input', () => {
    const out = scanFile('app.js', `eval(userInput)\n`)
    expect(out.some((f) => f.rule === 'EVAL_INJECTION')).toBe(true)
  })

  it('flags weak crypto imports', () => {
    const out = scanFile('crypto.ts', `import md5 from 'md5'\ndecrypt(input, key)\n`)
    expect(out.some((f) => f.rule === 'WEAK_CRYPTO')).toBe(true)
  })

  it('does not flag parameterized crypto hash usage', () => {
    const out = scanFile('crypto.ts', `import sha256 from 'node:crypto'\nhash = sha256(input)\n`)
    expect(out.find((f) => f.rule === 'WEAK_CRYPTO')).toBeUndefined()
  })

  it('reports hardcoded GitHub token', () => {
    const out = scanFile('auth.js', `const gh = 'ghp_1234567890abcdef1234567890abcdef12'\n`)
    expect(out.some((f) => f.rule === 'HARDCODED_SECRET' && /GitHub/.test(f.message))).toBe(true)
  })

  it('does not flag obvious placeholder values like your_api_key_here', () => {
    const out = scanFile('secrets.env', `API_KEY=your_api_key_here\nAPI_KEY=changeme1234\n`)
    const flagged = out.filter((f) => f.rule === 'HARDCODED_SECRET')
    expect(flagged.length).toBe(1) // only changeme1234 is flagged, not placeholder
  })

  it('returns nothing for ordinary code', () => {
    const out = scanFile('main.js', `console.log("hello world")\nconst x = 42\n`)
    expect(out.length).toBe(0)
  })

  it('assigns 1-indexed line numbers', () => {
    const out = scanFile('a.js', `eval('x')\nconst y = 1\n`)
    const sqli = out.find((f) => f.rule === 'EVAL_INJECTION')
    expect(sqli?.line).toBe(1)
  })
})
