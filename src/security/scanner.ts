/**
 * Static vulnerability scanner. Pure functions over file content — no I/O.
 *
 * A "finding" is one rule hit on a line:
 *   { severity: 'critical'|'high'|'medium'|'low',
 *     line,             1-indexed line number within the file
 *     rule,             short id like 'SQLI' or 'HARDCODED_SECRET'
 *     message,           human-readable why
 *     exploit,          concrete attacker scenario
 *     fix,              suggested fix
 *     confidence: 'High'|'Medium'|'Low' }
 *
 * Rules mirror docs/PRD.md §5.6 and the SKILL.md list of vulnerability classes.
 * Conservative by design: flags only clear attack patterns, never reports noise
 * as critical. Path-scanning helpers live here too (see scanDirectory).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Confidence = 'High' | 'Medium' | 'Low'

export interface SecurityFinding {
  severity: Severity
  line: number
  rule: string
  message: string
  exploit: string
  fix: string
  confidence: Confidence
}

// --- helpers -------------------------------------------------------------

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

const SECRET_PATTERNS: ReadonlyArray<{ re: RegExp; message: string; exploit: string; fix: string; confidence: Confidence }> = [
  {
    re: /\b((?:[A-Za-z0-9_]*(?:api[_-]?key|secret|password|passwd|pwd|token|access[_-]?key|private[_-]?key|client[_-]?secret|auth)[A-Za-z0-9_]*)\s*[:=]\s*)(["']?)([^\s"',;]{8,})\2/gi,
    message: 'Hardcoded secret assigned to a named credential field',
    exploit: 'An attacker reads the source; the secret becomes a live API key to any service the key controls.',
    fix: 'Move the value into an environment variable or a secrets manager; never commit real values.',
    confidence: 'High',
  },
  {
    re: /\b(Bearer\s+)([A-Za-z0-9._-]{16,})/g,
    message: 'Hardcoded bearer token',
    exploit: 'The bearer token gives a remote caller the same identity as whoever owns the key.',
    fix: 'Load the bearer token from env/keychain; rotate every 30 days.',
    confidence: 'High',
  },
  { re: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, message: 'GitHub token hardcoded', exploit: 'GitHub token lets an attacker push/delete; rotation required.', fix: 'Load from env or secrets manager.', confidence: 'High' },
  { re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g, message: 'Slack token hardcoded', exploit: 'Slack bot token can post arbitrary messages and read channels.', fix: 'Load from env or secrets manager.', confidence: 'High' },
  {
    re: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)([\s\S]*?)(-----END [A-Z ]*PRIVATE KEY-----)/g,
    message: 'Private key block committed to source',
    exploit: 'Anyone with repo access gets the key for any service it was issued to.',
    fix: 'Remove the key from the repo; load it from a KMS/keychain at runtime.',
    confidence: 'High',
  },
]

function looksLikePlaceholder(value: string): boolean {
  const v = value.trim()
  if (v.length < 8) return false
  return /^(true|false|null|none|undefined|changeme|placeholder|example|your[_-]?\w+|xxx+\*+)$/i.test(v)
}

function isRedactableSecret(text: string): boolean {
  if (!looksLikePlaceholder(text)) return true
  return false
}

// --- per-rule detectors ----------------------------------------------------

function scanSqlInjection(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  // Parameterized query with placeholders: NOT flagged.
  if (/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE.*\?\s*$|SQL\s*:.*\$\d/.test(line) && !/\+\s*\(?["'].*\)?/.test(line) && !/\+\s*\(?['"].*\)?/.test(line)) {
    return findings
  }
  // String-concatenated SQL with '--' style comment termination or single quote -> double quote.
  if (/(SELECT|INSERT|UPDATE|DELETE).*["']\s*\+|\+.*["']\s*\.(SELECT|INSERT|UPDATE|DELETE|FROM)/.test(line) || /\bFROM\b.*--.*\$\{?["']/.test(line) || /\bWHERE\b.*'[^']*'\s*\+/.test(line) || /--\s*\$?\s*['"].*\+/.test(line)) {
    findings.push({
      severity: 'high',
      line: lineNo,
      rule: 'SQLI',
      message: 'Possible SQL injection via string concatenation',
      exploit: `Attacker supplies ${line.slice(0, 48)}… as a user value to break out of the query and read/modify the database.`,
      fix: 'Use parameterized queries ($1, ?) or a prepared statement library; never concatenate user input into SQL.',
      confidence: 'High',
    })
  }
  return findings
}

function scanCommandInjection(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const hits = line.match(/exec\(\s*\$?\w+|subprocess\.\w+\([^)]*shell\s*=\s*True|os\.popen|os\.system|commands\.get\(.*[^)]*shell\s*=/)
  if (hits) {
    findings.push({
      severity: 'high',
      line: lineNo,
      rule: 'COMMAND_INJECTION',
      message: 'Possible command injection via dynamic exec',
      exploit: `An attacker controls the argument passed to this function and can run arbitrary commands on the host.`,
      fix: 'Use an argument-list approach (execvp / subprocess with list args); never pass strings containing user data to shell=True.',
      confidence: 'High',
    })
  }
  return findings
}

function scanEvalInjection(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  if (/\beval\s*\(|exec\s*\(/.test(line)) {
    findings.push({
      severity: 'high',
      line: lineNo,
      rule: 'EVAL_INJECTION',
      message: 'Use of eval/exec on untrusted input',
      exploit: `An attacker who can control the string passed to eval can execute arbitrary JavaScript/Python/etc.`,
      fix: 'Remove eval/exec; parse structured data with json.loads instead.',
      confidence: 'High',
    })
  }
  return findings
}

function scanTOCTOU(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  // Keep this heuristic conservative: flag direct read/write pairs on the same path
  // in the same function without an atomic rename in between. Just a heuristic marker;
  // flagged at medium confidence because TOCTOU needs cross-file analysis.
  const matches = line.match(/(open|readFileSync|readFile)\s*\(\s*[^,)]+\s*,[^)]*\)/g) || line.match(/writeFileSync\s*\(\s*[^,)]+\s*,[^)]*\)/g)
  if (matches && /(open|readFileSync|readFile)\s*\(\s*[^,)]+\s*,[^)]*\).*writeFileSync\s*\(\s*[^,)]+\s*,[^)]*\)/.test(line)) {
    findings.push({
      severity: 'medium',
      line: lineNo,
      rule: 'TOCTOU',
      message: 'Possible time-of-check / time-of-use race',
      exploit: `Between the check and use of the same path, another process can swap the file, causing unexpected behaviour or privilege escalation.`,
      fix: 'Use atomic writes (writeFile + rename) or stat at point of use only.',
      confidence: 'Medium',
    })
  }
  return findings
}

function scanWeakCrypto(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  if (/(\bmd5\b|\bsha1\b)\s*\(|CryptoJS\.MD5|\bsha1\(|DES\s*\(|cryptoRandomInt|Math\.random/.test(line)) {
    findings.push({
      severity: 'medium',
      line: lineNo,
      rule: 'WEAK_CRYPTO',
      message: 'Weak cryptographic primitive used',
      exploit: 'MD5/SHA1 are broken; DES is obsolete; Math.random is predictable for secrets.',
      fix: "Use node:crypto.createHash('sha256'), a modern KDF, and crypto.randomInt for any secret generation.",
      confidence: 'High',
    })
  }
  return findings
}

function scanExfiltration(lineNo: number, line: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  // Flag accidental logging of full URLs or tokens inside a logger call.
  if (/logger\.?\w*\(.*https?:\/\/[^\s"']+.*\)/.test(line) || /console\.log\(.*https?:\/\/[^\s"'`]+\b\w+\b/.test(line)) {
    findings.push({
      severity: 'low',
      line: lineNo,
      rule: 'EXFIL',
      message: 'Potential data exfiltration via logging',
      exploit: 'A URL inside a log line leaks internal hostnames, ports or credentials.',
      fix: 'Never log URLs or secrets; strip hostnames from logs.',
      confidence: 'Low',
    })
  }
  return findings
}

function scanHardcodedSecret(lineNo: number, line: string): SecurityFinding[] {
  for (const p of SECRET_PATTERNS) {
    const m = p.re.exec(line)
    if (m && isRedactableSecret(m[m.length - 1])) {
      return [{
        severity: 'high',
        line: lineNo,
        rule: 'HARDCODED_SECRET',
        message: p.message,
        exploit: p.exploit,
        fix: p.fix,
        confidence: p.confidence,
      }]
    }
  }
  return []
}

// --- scanner --------------------------------------------------------------

/**
 * Scan a single file's content line-by-line for known patterns.
 * Returns findings with 1-indexed line numbers.
 */
export function scanFile(path: string, content: string): SecurityFinding[] {
  const lines = content.split('\n')
  const findings: SecurityFinding[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    findings.push(...scanSqlInjection(i + 1, line))
    findings.push(...scanCommandInjection(i + 1, line))
    findings.push(...scanEvalInjection(i + 1, line))
    findings.push(...scanTOCTOU(i + 1, line))
    findings.push(...scanWeakCrypto(i + 1, line))
    findings.push(...scanExfiltration(i + 1, line))
    findings.push(...scanHardcodedSecret(i + 1, line))
  }
  return findings
}

/**
 * Walk a directory recursively, skipping node_modules, dist, .git, build artifacts,
 * and files with no extension (except js/ts/tsx/json/html/md/css/scss/yaml/yml).
 */
export function scanDirectory(root: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const skip = new Set(['node_modules', 'dist', '.git', 'build', '.cache', 'coverage'])
  function walk(dir: string) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(dir, name)
      try {
        const st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (skip.has(name)) continue
        walk(full)
      } else if (st.isFile()) {
        if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts') || name.endsWith('.tsx') ||
            name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.md') ||
            name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.yaml') || name.endsWith('.yml')) {
          try {
            const text = readFileSync(full, 'utf8')
            findings.push(...scanFile(full, text))
          } catch {
            // ignore unreadable binary-ish files
          }
        }
      }
    }
  }
  walk(root)
  return findings
}
