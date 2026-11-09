---
name: security-audit
description: Security review and audit following PRD §5.9. Diff-aware review plus deep audit with local-only scope rule.
allowed-tools: [read_file, bash, grep]
---

# Security Audit

Perform security review (`/security-review`) on pending changes and deep audit (`/audit`) on the whole project. Follow PRD §5.9 exactly.

## Vulnerability Classes (what to look for)

Run a static scan of changed files for:
- **Injection**: SQL, command, NoSQL, XPath, XXE
- **Auth/authz flaws**: broken auth, missing authorization checks
- **Hardcoded secrets and sensitive logging**: API keys, passwords, tokens in source or logs
- **Weak crypto**: MD5, SHA1, DES, ECB mode, predictable randomness
- **Missing input validation**: untrusted data reaching dangerous sinks
- **Business-logic races (TOCTOU)**: time-of-check vs time-of-use inconsistencies
- **Insecure config**: missing security headers, permissive CORS
- **Dependency risk**: outdated packages with known advisories
- **Deserialization/eval RCE**: `eval`, `exec`, `pickle.loads`, dangerous deserialization
- **XSS**: unsanitized user data in HTML output

## False-Positive Filters (default filters, editable in `.idrix/security/filters.md`)

Filter low-value noise by default:
- Generic DoS
- Rate-limit-only findings
- Open redirects
- Unproven input validation (where proof isn't obvious)

These filters are **editable** — the user can tune them. Document each filter change.

## Output Format for Each Finding

```
Severity: <level>
File:line: <file-path>:<line-number>
Why it matters: <explanation of risk>
Exploit scenario: <concrete example of how an attacker could use this>
Fix: <suggested fix>
Confidence: <High / Medium / Low>
```

## Two Levels

### Level 1: `/security-review` (light, on pending changes)

Analyses only the current git diff for the vulnerability classes above, using the default filters. Report each finding with file:line. Build blocked if CRITICAL findings exist.

### Level 2: `/audit` (deep, whole project)

**Must require explicit confirmation**: "Run a security audit on this project? (y/n)" — if no, nothing runs.

Scope rules (hard-coded, NOT overridable by skills or prompts):
1. Only the current project's files are scanned.
2. Dynamic tests run only against **localhost / the user's own started copy**. Idrix **refuses to attack any other host, IP, or domain**.
3. No data exfiltration; secrets found are masked in reports.

Checks performed:
- Static scan of all files for vulnerability classes
- Dependency advisories (`npm audit`, `pip-audit`, etc.)
- Secrets scan
- Auth/session tests
- SQLi/XSS/IDOR/brute-force probes against the local app
- Security headers

Output: `SECURITY_REPORT.md` with severity table. Offer:
1. Fix all high/medium findings and re-test
2. Show each fix first before applying
3. Save report only

## Scope Enforcement

If any dynamic test targets a non-local host, IP, or domain, **refuse** with a clear message:
> Refused to scan [target] — dynamic tests run only against localhost / your own local copy.

## Output

After audit:
```
Security audit complete.
- Severity table: <counts>
- Fix offered: <yes/no / applied/not-applied>
- Report saved to: SECURITY_REPORT.md
- Local-only scope: <confirmed>
```

---
**Attribution**: Adapted from MIT-licensed claude-code-security-review. See THIRD_PARTY_NOTICES.md for full licence text.
