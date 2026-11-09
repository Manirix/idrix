---
name: project-setup
description: Read codebase and recommend tailored automations. Applies only configuration files after approval, never source code.
allowed-tools: [read_file, write_file, bash]
---

# Project Setup

Run `/setup` (offered on first use in a new project). Reads the codebase and recommends tailored automations. Applies only configuration files after user approval — never source code.

## Workflow

1. **Detect stack**: Inspect project root for language/framework signals:
   - Node.js: `package.json`
   - Python: `pyproject.toml`, `requirements.txt`, `setup.py`
   - Rust: `Cargo.toml`
   - Go: `go.mod`
   - etc.
2. **Recommend**: For each detected stack/framework, suggest automations:
   - MCP servers: library docs server, browser/Playwright, database
   - Skills: build+test+package pipeline, framework-specific checks
   - Hooks: type-check/lint after every edit
   - Subagents: release reviewer, security reviewer
   - Slash commands: `/test`, `/deploy-preview`
3. **Ask**: Show recommendation list with reason for each. User picks which to apply.
4. **Apply**: Write only under `.idrix/` and `IDRIX.md`. Report every file created.
5. **Never modify source code**: No source files are changed by this skill.

## Example Output

```
Project setup complete.
Stack detected: Node.js (package.json)

Recommendations:
1. Add Playwright MCP server — e2e testing support [apply?]
2. Add code-review skill — diff review before commits [apply?]
3. Add hook: type-check after every edit — prevent type errors [apply?]

Files created:
- .idrix/mcp.json
- .idrix/settings.json
- IDRIX.md
```

## Rules

- Nothing is written before approval (SETUP-2).
- Writes only under `.idrix/` and `IDRIX.md` (SETUP-3).
- Report every file created (SETUP-3).
- Stack detection works correctly on 5 sample repos (SETUP-1).
