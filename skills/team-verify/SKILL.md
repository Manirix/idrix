---
name: team-verify
description: Evidence before claiming done. Run tests, build, smoke checks. Show real output.
allowed-tools: [bash, read_file]
---

# Team Verify

Never claim done without evidence. Run the checks, show the output.

## Checklist

1. **Tests pass** — `npm test` (or equivalent). Show the output.
2. **Build succeeds** — `npm run build` (or equivalent). Show the output.
3. **Lint passes** — `npm run lint` (or equivalent). Show the output.
4. **Smoke test** — Run the app or a representative command. Show the output.
5. **Type check** — `npm run typecheck` (or equivalent). Show the output.

## Output Format

```
Verification complete.
- Tests: <PASS/FAIL> — <output>
- Build: <PASS/FAIL> — <output>
- Lint: <PASS/FAIL> — <output>
- Smoke: <PASS/FAIL> — <output>
- Type check: <PASS/FAIL> — <output>
- Overall: <PASS/FAIL>
```

## Rule

If any check fails, the work is NOT done. Fix and re-verify.