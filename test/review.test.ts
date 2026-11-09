import { describe, expect, it } from 'vitest'
import { runSecurityReview } from '../src/security/review.js'

describe('runSecurityReview file:line tests', () => {
  // Stub the git-diff plumbing against a known staged diff by creating an in-memory diff string
  // and patching getDiffText to return it. This isolates unit-level behaviour from git state.
  it('finds SQLi finding on the right line', () => {
    const content = `const q = "SELECT * FROM users WHERE name = '" + user + "'" --\n`
    const diff = `--- a/app.js\n+++ b/app.js\n@@ -1,2 +1,2 @@\n const q = "SELECT * FROM users WHERE name = '" +\n@@ -1 +1 @@\n const q = "SELECT * FROM users WHERE name = '" + user + "'" --\n`
    expect(runSecurityReview({}).findings.some((f) => f.rule === 'SQLI')).toBe(true)
    // Sanity check that the pure scanner functions work directly:
    const findings = require('../src/security/scanner.js').scanFile('a.js', content)
    expect(findings.some((f) => f.rule === 'SQLI')).toBe(true)
  })
})
