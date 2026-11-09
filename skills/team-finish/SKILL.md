---
name: team-finish
description: Finalize the work. Tests pass → offer merge / PR / keep / discard. Clean up worktree.
allowed-tools: [bash, read_file]
---

# Team Finish

After verification passes, finalize the work.

## Workflow

1. **Confirm verification** — Re-run team-verify. All checks must pass.
2. **Offer finish options** — Show the user:
   - **Merge** — Merge the branch into main.
   - **PR** — Open a pull request.
   - **Keep** — Keep the branch for later.
   - **Discard** — Discard the worktree and branch.
3. **Clean up** — If merging or PRing, remove the worktree.
4. **Log** — Append the final state to `.idrix/plans/<name>.log`.

## Output

```
Work complete.
- Verification: PASS
- Options: merge / PR / keep / discard
- Your choice: <user's choice>
```

## Cleanup Commands

```bash
# Remove worktree
git worktree remove <path>

# Delete branch (after merge)
git branch -d <branch-name>
```