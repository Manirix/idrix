---
name: design-md
description: Read and write DESIGN.md brand/design spec files. Use when DESIGN.md exists or should be created.
allowed-tools: [read_file, write_file]
---

# Design MD

Work with `DESIGN.md` brand specifications (the open Google Stitch design-spec format), which users can author and maintain.

## When to Use

- A `DESIGN.md` file exists in the project — read and obey it.
- The user asks to create or update a design spec.
- Starting a UI task in a project that has one.

## Workflow

1. **Locate**: `DESIGN.md` at project root, or specified path.
2. **Read**: Load brand tokens, color palette, typography, spacing, component styles, voice.
3. **Obey**: All subsequent UI work references these values. Never invent new tokens without updating the file.
4. **Write**: If the user wants changes, edit the file first, then apply.

## Required Sections (minimum)

- **Colors**: exact hex values, with usage guidance (background, text, accent, states).
- **Typography**: font families, sizes, weights, line heights.
- **Spacing**: token scale or base unit.
- **Components**: radii, shadows, borders, states.
- **Voice**: tone and word choices for copy.

## Format Notes

- `DESIGN.md` is an open specification — follow the format semantics of the file itself.
- Idrix writes its own DESIGN.md following the open spec; do not copy any proprietary text.

## Output

- Read task: state which token fields were applied.
- Write task: save updated file and state the changes.
