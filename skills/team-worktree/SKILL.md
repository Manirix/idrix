---
name: team-worktree
description: Create an isolated git worktree for the build. Confirm clean test baseline before any code is written.
allowed-tools: [bash, read_file]
---

# Team Worktree

Isolate the build in a git worktree so the main branch stays clean.

## Workflow

1. **Create a branch** — `git checkout -b <branch-name>` in a new worktree.
2. **Run setup** — Install dependencies, build, run tests. Confirm a clean baseline.
3. **Confirm baseline** — Show the user: "Tests pass at baseline. Proceed?"
4. **Write the worktree config** — Save branch name and worktree path to `.idrix/plans/worktree.json`.

## Worktree Commands

```bash
# Create a worktree
git worktree add ../idrix-<name> -b <branch-name>

# Confirm baseline
cd ../idrix-<name>
npm test
```

## Output

```
Worktree created at <path>
Branch: <branch-name>
Baseline tests: PASS
```