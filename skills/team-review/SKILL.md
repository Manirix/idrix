---
name: team-review
description: Review the completed work against the plan. Severity-ranked findings. Critical issues block.
allowed-tools: [read_file, bash, grep]
---

# Team Review

After all tasks are done, review the complete work against the original plan.

## Workflow

1. **Read the plan** — Load `.idrix/plans/<name>.md`.
2. **Check each task** — Did every task produce the expected outcome?
3. **Check acceptance criteria** — Are all criteria met?
4. **Severity ranking** — Rank findings as critical, high, medium, low.
5. **Block on critical** — If any critical issues exist, fix them before proceeding.

## Severity Levels

| Level    | Definition                                |
|----------|-------------------------------------------|
| CRITICAL | Feature broken or security vulnerability  |
| HIGH     | Major bug or missing acceptance criterion |
| MEDIUM   | Minor issue, should fix                   |
| LOW      | Style, polish, nice-to-have               |

## Output

```
Review complete.
- Critical: <n>
- High: <n>
- Medium: <n>
- Low: <n>
- Recommendation: <approve / fix-critical-then-approve>
```