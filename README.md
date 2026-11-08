# Idrix

> **Disclaimer:** Idrix is an independent project and is **unrelated to iDrix Technology S.A.** (Ecuador), which exists as a separate company.

Idrix is a free, open-source, terminal-based AI coding agent for macOS, Linux and Windows. It works with any model provider through the user's own API keys, has plan mode and build mode, a built-in design engine that makes websites NOT look AI-generated, a built-in dev-team workflow (brainstorm → plan → subagent build → TDD → review → verify), a project setup command, and a security review/audit. It is installed with one command and run as `idrix`.

## Install

```sh
npm install -g idrixai
```

Requires Node.js 20 or newer. On a fresh machine, install Node first (see `scripts/install.sh` / `scripts/install.ps1`).

## Quick start

```sh
cd my-project
idrix            # launch the interactive TUI
idrix -p "Create hello.ts that prints hi"   # headless mode
```

## Commands

| Command | Description |
|---|---|
| `idrix` | Launch the interactive TUI |
| `idrix -p "prompt"` | Headless mode: print result and exit |
| `idrix init` | Configure providers / roles (free presets) |
| `idrix skills search <query>` | Search skill registries |
| `idrix mcp add <url>` | Add an MCP server |
| `idrix setup` | Detect stack and recommend automations |
| `idrix /security-review` | Diff-aware light security review |
| `idrix /audit` | Full static + dynamic security audit |
| `idrix mode plan` | Toggle plan (read-only tools) / build |
| `idrix undo` | Restore last file checkpoint |
| `idrix resume` | Resume a previous session |

## Design

Idrix ships with a built-in design engine. For any UI task it writes a design brief, researches real references, extracts layout/type/spacing/palette/motion notes, builds an original design, then renders and critiques its own result against a banned list of 14 "AI look" patterns (gradients, glow, emoji-as-icons, filler copy, card grids, etc.).

## License

Idrix is MIT-licensed. Third-party content keeps its own licence and attribution in `THIRD_PARTY_NOTICES.md`.