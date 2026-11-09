---
name: frontend-design
description: Layout, typography, spacing, and component craft for user-facing UI. Use when building or reviewing any interface.
allowed-tools: [read_file, write_file, edit_file, bash]
---

# Frontend Design

Guide for laying out interfaces that feel intentional rather than default. Use when building or reviewing any user-facing UI code (HTML, CSS, React, Tailwind, native).

## Layout Rules

1. **Grid over flow**: Use CSS Grid or a framework grid for layout. Avoid default `flex` stacking for complex layouts. Use named grid areas when mapping a page skeleton.
2. **Hierarchy**: Single dominant heading per section. Visual hierarchy should come from size, weight, and spacing — not color alone.
3. **Whitespace is a design element**: Sections breathe. Dense walls of text are a design failure, not a styling choice. Use generous padding between sections.
4. **Rhythm**: Consistent vertical spacing scale (e.g., 4/8/16/32/64) — never ad-hoc `padding: 13px`.

## Typography

1. **Type scale**: Pick 2-3 sizes beyond body (display, heading, small label). Don't use body size for headings.
2. **Line length**: Prose 60-90 characters. Use line-height ~1.6 for body text.
3. **Pairing**: One serif + one sans serif at most, or two close families. Never default stack alone unless deliberate.
4. **Weights**: Use font weight contrast before font size contrast when possible (700 vs 400) for crisp hierarchy.

## Spacing & Components

1. **Consistent spacing tokens**: Follow a declared scale. Same element type always uses the same spacing.
2. **Buttons**: One primary action per view. Primary button: solid fill, high contrast, 8px radius. Secondary: outline or ghost. Never two stacked primary CTAs (that's banned pattern #8).
3. **Cards**: Card boundaries must justify themselves. If the content doesn't need grouping, don't use cards — use spacing.

## Quality Checklist

Before shipping UI code, verify:
- [ ] Grid-based layout, not stacking hack
- [ ] Visual hierarchy exists without relying on hue alone
- [ ] Spacing follows a scale, not ad-hoc values
- [ ] Type scale has distinct sizes for display/head/body
- [ ] One primary action per screen
- [ ] No decorative gradients/glows/glassmorphism (see design-taste)

## Output

When writing or reviewing UI code, state the design decisions made (type scale, spacing tokens, component spacing) so reviewers can trace intent.
