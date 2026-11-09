---
name: team-execute
description: Run the approved plan. Fresh subagent per task with tool limits. Spec review then quality review after each task.
allowed-tools: [task, read_file, write_file, bash]
---

# Team Execute

Run the approved plan. Each task runs in a fresh subagent with its own context and tool limits.

## Workflow

1. **Read the plan** — Load `.idrix/plans/<name>.md`.
2. **Dispatch tasks** — For each task:
   - Spawn a fresh subagent with the task's tool limits.
   - Pass the task spec, the relevant files, and the verification steps.
   - The subagent returns only a summary. Main context stays small.
3. **Spec review** — After each task, review the diff against the spec. Does the implementation match?
4. **Quality review** — After each task, run code review. Check for bugs, style, test gaps.
5. **Parallel dispatch** — Independent tasks can run concurrently. Guard against file conflicts.
6. **Log results** — Append to `.idrix/plans/<name>.log`.

## Subagent Tool Limits

| Role            | Tools allowed                |
|-----------------|------------------------------|
| Product manager | read, web                    |
| Architect       | read, web                    |
| Designer        | read, write (design files), screenshot, web |
| Frontend dev    | read, write, bash            |
| Backend dev     | read, write, bash            |
| QA engineer     | read, write (tests), bash    |
| Code reviewer   | read, bash (read-only)       |
| Security reviewer | read, bash (read-only), local test tools |
| DevOps          | read, write, bash            |

## Output

```
Task <n>/<m>: <name> — PASS/FAIL
Spec review: <pass/fail>
Quality review: <pass/fail>
```