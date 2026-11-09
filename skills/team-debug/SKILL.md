---
name: team-debug
description: Systematic root-cause debugging. Reproduce → isolate → hypothesize → verify. No guess-fixes.
allowed-tools: [read_file, bash, grep]
---

# Team Debug

Debug systematically. Never guess and patch.

## The Four Steps

1. **Reproduce** — Get a reliable reproduction. Write a test that fails.
2. **Isolate** — Narrow down to the smallest failing case. Binary search the code.
3. **Hypothesize** — Form a specific, testable hypothesis about the root cause.
4. **Verify** — Test the hypothesis. If confirmed, fix. If not, form a new one.

## Rules

- No "maybe it's this" fixes without evidence.
- Every fix must have a test that fails before and passes after.
- Document the root cause in the plan log.

## Output

```
Debug complete.
- Reproduction: <test case>
- Root cause: <explanation>
- Fix: <what was changed>
- Verification: <test passes>
```