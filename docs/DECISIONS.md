# Idrix — Decisions

A running log of the choices made while building Idrix, and why.

Each entry follows the format: **Context → Decision → Consequence.**
The plan says: *"If something is missing, make the smallest reasonable choice,
write it down in docs/DECISIONS.md, and continue."*

---

## D-001 — Source documents are named `PRD (2).md` and `IMPLEMENTATION_PLAN.md`

**Context.** The plan refers to `docs/PRD.md` and `docs/IMPLEMENTATION_PLAN.md`,
but the repository ships `PRD (2).md` and `IMPLEMENTATION_PLAN.md` at the root.

**Decision.** Move both documents to `docs/` as `docs/PRD.md` and
`docs/IMPLEMENTATION_PLAN.md`, matching the plan's own references. Keep the
original files untouched until the move is done.

**Consequence.** The plan's `docs/` paths now resolve. No content changed.

---

## D-002 — Node 20+ is the floor, but the toolchain runs on Node 22/24

**Context.** The plan requires Node 20+. The development machine runs Node 24.14.

**Decision.** `package.json` declares `"engines": { "node": ">=20" }`. CI pins
Node 20 (the floor) so the minimum supported version is exercised. tsup targets
`node20`.

**Consequence.** No use of APIs newer than Node 20 in shipped code.

---

## D-003 — The AI SDK is v7 and its streaming API changed

**Context.** The plan names the Vercel AI SDK but not a version. The current
release is `ai@7.0.148`. In v7, `fullStream` is deprecated in favour of
`stream`, and a tool message carries its result inside a `content` array of
`{ type: 'tool-result', toolCallId, toolName, output }` parts.

**Decision.** Use `ai@^7.0.0` and the v7 API: `streamText`, `stream`,
`stepCountIs`, and the array-shaped `tool` role message. API shapes were
verified against the installed `node_modules/ai/dist/index.d.ts` rather than
from memory.

**Consequence.** `src/core/agent.ts` drives the loop manually instead of using
the SDK's `stopWhen` auto-execution, because Idrix must check permissions
before anything runs.

---

## D-004 — The SDK's `execute` hook is never used

**Context.** The AI SDK can execute tools itself. Doing so would bypass Idrix's
permission engine, which the project rules make non-negotiable.

**Decision.** Tools are registered with `tool({ description, inputSchema })` and
**no** `execute`. The agent loop receives the `tool-call` part, runs the
permission check, then executes the tool itself and appends a `role: 'tool'`
message with the result.

**Consequence.** Full control over permission checks, denial handling and
redaction. The SDK never runs anything on its own.

---

## D-005 — Plan mode removes tools rather than denying them

**Context.** The PRD requires that in plan mode "write/bash are absent, not just
denied" (plan §3.2).

**Decision.** `toolsForMode('plan')` returns only the read-only tool list.
The SDK never sees `write_file`, `edit_file` or `bash` in plan mode, so the
model cannot even construct a call to them. The agent additionally refuses any
tool outside the current mode's list.

**Consequence.** `src/core/modes.ts` is the single place that decides the tool
list; `src/core/permissions.ts` is only consulted for tools that are present.

---

## D-006 — Permissions: deny → ask → allow → default

**Context.** The plan gives the rule format and the resolution order.

**Decision.** Implement exactly that order. The default for an unlisted tool is
`ask`, except for a fixed read-only allowlist (`read_file`, `list_dir`, `glob`,
`grep`, `web_search`, `web_fetch`) which is always allowed — "reading is free".

**Consequence.** A tool that is not mentioned anywhere still requires approval,
so the safe default is preserved when a user adds new tools later.

---

## D-007 — Skills, plugins and MCP may only narrow permissions

**Context.** A non-negotiable rule: untrusted content can never widen
permissions.

**Decision.** `narrowPermissionSets(current, requested)` intersects the
requested allow/ask rules with what the user already has and unions the deny
rules. A skill asking to allow `bash(*)` against a user config that asks for
`bash(*)` leaves the result as `ask`. This is covered by a test.

**Consequence.** Phase 4's skill loader and Phase 6's MCP client will call this
function and nothing else.

---

## D-008 — Secret redaction happens at the tool boundary and on session write

**Context.** "Secrets are never logged, never written to session files, and are
redacted from tool output."

**Decision.** Two layers:
1. `redactSecrets()` replaces known environment-variable values and
   pattern-matched credential shapes with `[REDACTED]`.
2. It is applied to every tool result before it reaches the model, to error
   messages, and to every session message before it is appended to the JSONL.

**Consequence.** A key that leaks into a file the agent reads is masked before
the model ever sees it. Pattern matching is heuristic, so it errs toward
masking rather than leaking.

---

## D-009 — Atomic writes use a temp file in the same directory, then rename

**Context.** CORE-3: "Interrupt mid-edit leaves file either fully old or fully
new." The plan requires "write temp then rename".

**Decision.** `writeFileAtomic` writes to `.<name>.idrix-tmp-<pid>-<ts>` in the
*same directory* as the target (so the rename stays on one filesystem and is
atomic), fsyncs, then renames over the target. On failure the temp file is
removed.

**Consequence.** A Ctrl+C during a write cannot leave a half-written file. The
temp file is in the same directory, not the system temp dir, because a
cross-device rename is not atomic.

---

## D-010 — The `bash` tool runs through PowerShell on Windows

**Context.** TOOL-2 requires `bash` to work on Windows, macOS and Linux.
Windows 10+ ships PowerShell, not bash.

**Decision.** One OS adapter (`src/core/shell.ts`) decides the shell:
PowerShell on Windows, `/bin/sh` on macOS/Linux. The tool keeps the name `bash`
because that is what models expect to call. All OS differences — process-tree
killing, path handling — live in that one module.

**Consequence.** CI runs the bash-tool tests on all three operating systems so
the adapter is exercised everywhere.

---

## D-011 — Kill the process tree, not just the process

**Context.** TO-2: "kills process tree on cancel".

**Decision.** On Windows: `taskkill /pid <pid> /T /F`. On macOS/Linux: the
child is spawned `detached`, making it a process-group leader, and the group is
killed with `process.kill(-pid, 'SIGKILL')`.

**Consequence.** A `npm test` that spawns children dies completely on Ctrl+C
rather than leaving orphans.

---

## D-012 — `.gitignore` and `.idrixignore` are honoured by the file tools

**Context.** TOOL-1: "File tools respect project root and ignore rules
(`.gitignore`, `.idrixignore`)".

**Decision.** A small gitignore matcher (`IgnoreRules`) supports `*`, `**`, `?`,
negation `!` and the directory-only `/` suffix. It is applied to `read_file`,
`list_dir`, `glob` and `grep`. Writes to an ignored path are allowed (with
permission) because the user may explicitly want to create such a file.

**Consequence.** `node_modules` and build output are invisible to the agent by
default, keeping tool output small.

---

## D-013 — The mock provider implements `doStream` directly

**Context.** The plan requires agent-loop tests with "a mock provider that
replays recorded tool-call transcripts" and no network or API key.

**Decision.** `test/mock-provider.ts` implements the `LanguageModel` interface's
`doStream` and yields stream parts directly. It is a script of steps
(`{ type: 'text' }` or `{ type: 'tool' }`), so a test can express exactly what
the model does on each turn.

**Consequence.** The agent loop is tested end to end — tool call, execution,
result fed back, second turn — with zero network access and zero cost.

---

## D-014 — Sessions live in `~/.idrix/sessions/<id>.jsonl`

**Context.** The plan's layout says `~/.idrix/{config.json, credentials,
sessions/, skills/, commands/, mcp.json}`.

**Decision.** One append-only JSONL file per session. The session id is
`YYYY-MM-DDTHH-mm-ss-<random>`. Every line is one message. A partially written
last line (after a crash) is skipped on read rather than failing the session.

**Consequence.** Append-only means a crash can lose the last message but never
corrupt the rest.

---

## D-015 — Checkpoints are stored under `<root>/.idrix/history/<session>/`

**Context.** HIST-2: "Undo works after process restart."

**Decision.** Each edit snapshots the file's previous content into
`.idrix/history/<sessionId>/<n>-<encodedPath>.snap`. The snapshot is written
atomically. `restore()` rewrites the old content, or deletes the file when it
did not exist before.

**Consequence.** `/undo` works across restarts because the state is on disk, not
in memory.

---

## D-016 — The AI SDK `stream` part is used, not `fullStream`

**Context.** In AI SDK v7 `fullStream` is deprecated in favour of `stream`.

**Decision.** The agent loop consumes `result.stream` and switches on
`part.type` for `text-delta`, `tool-call` and `error`.

**Consequence.** No deprecation warnings, and the loop only handles the parts it
needs.

---

## D-017 — Phase 1 ships OpenRouter, Gemini and OpenAI-compatible providers

**Context.** Phase 1 says "one provider (OpenRouter or Gemini)"; PROV-1 requires
the registry to hold several.

**Decision.** Implement the registry so it supports all three families now
(`openrouter`, `google`, `openai-compatible`/`openai`/`ollama`), and ship
OpenRouter as the default. The extra families cost almost nothing once the
registry exists, and Phase 3 then only adds presets, fallback and roles.

**Consequence.** No code change is needed in Phase 3 to add Kimi/DeepSeek —
they are `openai-compatible` entries in the config.

---

## D-018 — `idrixai` on npm and the GitHub org are not yet verified

**Context.** The plan's Phase 0 "Also" note says to verify the GitHub name/org
and `idrixai` availability before the first publish. PRD §10 lists this as an
open question.

**Decision.** Use `idrixai` as the package name (as the plan specifies) and do
not publish anything in Phase 0 or Phase 1. Verification is a human step that
needs the user's npm login and GitHub org.

**Consequence.** The package is unpublished and unclaimed. This must be done
before Phase 10.

---

## D-019 — The logo is an original geometric wordmark

**Context.** The PRD specifies a custom rounded wordmark with cream letters, an
amber spark on the first `i` and an amber crossed `x`. It must not resemble any
other product's branding.

**Decision.** Draw it from scratch as SVG geometry (rounded stems, a bowl for
the `d`, a shoulder for the `r`) in `assets/idrix-wordmark-for-{dark,light}-bg.svg`.
The terminal rendering in `src/ui/logo.ts` is a separate, simpler mark.

**Consequence.** The assets are original and carry no third-party licence.

---

## D-020 — Ink 8 requires React 19

**Context.** `ink@8` declares a peer dependency on `react >= 19.3.0`; React 18
fails to install.

**Decision.** React 19 with `@types/react@^19`.

**Consequence.** The project requires React 19 as a runtime dependency for the
TUI. This is the version Ink 8 targets.
