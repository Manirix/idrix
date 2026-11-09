---
name: code-review
description: Review changed code against the plan. Check for bugs, style violations, test gaps, security issues, and verification steps.
allowed-tools: [read_file, bash, grep]
---

# Code Review

Review the current diff against the approved plan. Ensure every task produced the expected outcome, and the work passes both spec-compliance and quality standards.

## Review Checklist

1. **Spec compliance**: Read the plan (see team-plan workflow). Verify each task's acceptance criteria:
   - Did we touch the exact file paths the task specified?
   - Is the code outline as described (function signatures, data shapes)?
   - Did we run the verification steps and get PASS?
2. **Security review**: Run `/security-review` on the diff (if there are writes or new files).
3. **Code quality**:
   - Bugs: Run tests, if any. If no tests, at least sanity-check what the code does.
   - Style: Follow frontend-design rules (tokens, spacing).
   - Coverage: If tests were written, ensure they're present and pass.
4. **Verification evidence**: Show the actual output from:
   - Tests (if any) — copy the log
   - Build/run command (if any)
   - Smoke test output (if any)
   - Code review findings (if any)
5. **Edge cases**: If any were mentioned in spec, test at least one.

## Output

For each task reviewed:

```
Task X/Y: <task-name>
- Spec compliance: PASS/FAIL
- Security review: PASS/FAIL
- Code quality: PASS/FAIL
- Verification evidence: PASS/FAIL
- Overall: PASS/FAIL
```

If any task fails, fix it before proceeding. If critical issues are found (security vulnerability, missing acceptance criterion), block and wait for fixes.

## Severity Levels

| Level    | Definition                                |
|----------|-------------------------------------------|
| CRITICAL | Feature broken or security vulnerability  |
| HIGH     | Major bug or missing acceptance criterion |
| MEDIUM   | Minor issue, should fix                   |
| LOW      | Style, polish, nice-to-have               |

## Fix Loop

If a review fails:
1. Identify what broke.
2. Fix.
3. Re-run review on the new diff.
4. If still failing, escalate or stop until fixed.

## End of Review

When all tasks pass:
```
Code review complete.
- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- Recommendation: APPROVE
```

---
**Note:** If you don't have tests, write at least a minimal test before reviewing.
