---
name: team-brainstorm
description: Ask clarifying questions one at a time. Propose 2–3 approaches. Write a design/spec for approval before any code.
allowed-tools: [read_file, web, ask_user]
---

# Team Brainstorm

Turns Idrix from a single assistant into a coordinated team. For non-trivial work, brainstorm first — ask clarifying questions, propose approaches, get spec approval before any code.

## Stage 1: Ask Questions One at a Time

Ask **one** clarifying question per turn. Do not ask multiple questions at once. Wait for the user's answer before asking the next.

## Stage 2: Propose 2–3 Approaches

After clarifying questions are answered, present **two or three** distinct approaches:

```
Approach A: <short name>
- Pros:
- Cons:
- Estimated effort:

Approach B: <short name>
- Pros:
- Cons:
- Estimated effort:

Approach C: <short name> (optional)
...
```

Each approach must include a different technical direction, not just minor variations.

## Stage 3: Approval Gate

After approaches are presented, ask the user to **pick one** or suggest changes. Get explicit approval on the chosen approach before writing any code.

## Stage 4: Write Spec for Approval

Draft a `.idrix/specs/<name>.md` containing:
- User context
- Chosen approach
- File-level design (paths, functions, data shapes)
- Acceptance criteria
- Test requirements

Then ask: "Approve this spec before coding?"

Only after user says yes does any coding begin.

## Output

```
Brainstorm complete.
- Questions answered: <n>
- Approaches proposed: <n>
- Chosen approach: <name>
- Spec written to: <path>
- Spec approved: <yes/no>
```

---
**Attribution**: Adapted from MIT-licensed Superpowers methodology (Jesse Vincent / Prime Radiant). See THIRD_PARTY_NOTICES.md for full licence text.
