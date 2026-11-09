---
name: team-plan
description: Break an approved spec into small tasks (2–5 min each) with exact file paths, code outline, and verification steps.
allowed-tools: [read_file, write_file]
---

# Team Plan

Turn the approved spec into a concrete, executable plan. Every task must be small enough to complete in 2–5 minutes.

## Workflow

1. **Read the spec** — Load `.idrix/specs/<name>.md`.
2. **Break into tasks** — Each task has:
   - Exact file paths to touch
   - Code outline (what functions, what signatures)
   - Verification steps (tests, build, smoke check)
   - Estimated time (2–5 min)
3. **Order tasks** — Dependencies first. Independent tasks can run in parallel.
4. **Write the plan** — Save to `.idrix/plans/YYYY-MM-DD-name.md`.
5. **Get approval** — Show the plan and ask: "Approve this plan?" User must say yes.

## Plan Format

```markdown
# Plan: <name>

## Tasks

### Task 1: <name>
- **Files**: <exact paths>
- **Outline**: <function signatures, data shapes>
- **Verify**: <test command, expected output>
- **Estimate**: <2–5 min>

### Task 2: ...
```

## Task Size Rule

A task that takes more than 5 minutes is too big. Split it. If you can't split it, the spec is too vague — go back to brainstorm.

## Output

```
Plan written to .idrix/plans/<date>-<name>.md
Approve? [y/n]
```