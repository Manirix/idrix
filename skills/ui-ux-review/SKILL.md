---
name: ui-ux-review
description: Critique of rendered pages against the brief. Checks anti-generic patterns, accessibility, and usability.
allowed-tools: [read_file, bash, grep, screenshot]
---

# UI/UX Review

Critique rendered pages against the original design brief. Ensures the output does not fall into AI-generated visual traps and meets accessibility and usability standards.

## Workflow

1. **Read the brief**: Load `.idrix/design/brief.md` or the initial design brief. If missing, scope the task yourself and note it.
2. **Inspect the rendered page**: Screenshot desktop and mobile. Open in browser or capture via Playwright.
3. **Check banned patterns**: Scan the rendered HTML/CSS for any of the 14 banned "AI look" patterns from design-taste (§5.6.1). Common ones: gradient backgrounds, `rounded-2xl` everywhere, emoji icons, filler copy.
4. **Usability checks**:
   - Are interactive elements clearly distinguishable?
   - Is focus visible (focus-visible or outline)?
   - Does text have sufficient contrast?
   - Are form fields labeled?
   - Is navigation intuitive?
5. **Accessibility**: Check heading hierarchy, alt text, ARIA labels, `prefers-reduced-motion` handling.
6. **Responsiveness**: Verify mobile layout does not break. Check columns stack, text scales.
7. **Fix**: Update the code or design brief to address each issue. Retest after fixes.

## Output

Summarize findings in this format:

```
UI/UX Review
- Banned patterns found: <n> (list them if any)
- Contrast issues: <n>
- Accessibility findings: <summary>
- Responsiveness: <pass/fail>
- Fixes applied: <brief summary>
```

If any banned pattern is detected, state: "Build blocked until patterns are fixed or user overrides." Then proceed to step 7.