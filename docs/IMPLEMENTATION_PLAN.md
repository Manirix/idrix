# Idrix — Implementation Plan

**Version:** 0.1 · **Date:** 2026-10-21 · Companion to `PRD.md`. Requirement IDs (CORE-1, DES-4, …) refer to the PRD.

Build in phases. **Do not start a phase until the previous phase's acceptance checks pass.** Each phase ends with something you can run.

---

## 1. Tech stack

| Area | Choice | Why |
|---|---|---|
| Language | TypeScript (strict), Node.js 20+ | Cross-platform via npm; same language for CLI + tools |
| Models | Vercel AI SDK (`ai`) + provider packages (`@ai-sdk/google`, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`, etc.) | One interface for every provider; streaming + tool calls |
| Terminal UI | `ink` (React for CLI) + `ink-text-input` | Component-based TUI matching the mockups |
| Schemas | `zod` | Tool input validation, config validation |
| MCP | `@modelcontextprotocol/sdk` | Official client |
| Browser | `playwright` (Chromium, installed on demand) | Screenshots for design critique and references |
| Build | `tsup` | Single bundle for npm |
| Tests | `vitest` | Fast unit/integration tests |
| Lint/format | ESLint + Prettier | |
| Git ops | `simple-git` or shell git | Worktrees, diffs |
| Diff | `diff` package | Edit previews |
| Parsing | `gray-matter` (SKILL.md frontmatter), `yaml` | |
| Keychain | `keytar` optional; fallback file with 0600 | |

> Check each package's current version and API before use; AI SDK APIs change between major versions.

---

## 2. Repository layout

```
idrix/
├─ package.json            # name: "idrixai", bin: { "idrix": "dist/cli.js" }
├─ tsconfig.json
├─ tsup.config.ts
├─ LICENSE                 # MIT
├─ THIRD_PARTY_NOTICES.md  # Superpowers (MIT), security-review (MIT), others
├─ README.md               # includes "unrelated to iDrix Technology S.A." note
├─ IDRIX.md                # project memory for developing Idrix itself
├─ src/
│  ├─ cli.ts               # entry: parse args, headless (-p), subcommands
│  ├─ app.tsx              # Ink root, screen router
│  ├─ ui/
│  │  ├─ theme.ts          # palette from PRD §3
│  │  ├─ Launch.tsx        # logo + Tips to start + Recent sessions
│  │  ├─ Chat.tsx          # message list, streaming, tool-call rows
│  │  ├─ PromptBox.tsx
│  │  ├─ StatusBar.tsx     # BUILD/PLAN pill, hints
│  │  ├─ Permission.tsx    # approval menus
│  │  ├─ PlanApproval.tsx
│  │  ├─ DiffView.tsx
│  │  └─ logo.ts           # terminal-rendered wordmark
│  ├─ core/
│  │  ├─ agent.ts          # agent loop
│  │  ├─ modes.ts          # plan/build tool filters
│  │  ├─ permissions.ts    # allow/ask/deny engine
│  │  ├─ context.ts        # system prompt assembly, compaction
│  │  ├─ session.ts        # JSONL history, resume
│  │  ├─ checkpoints.ts    # file snapshots, /undo
│  │  ├─ subagent.ts       # task tool runner
│  │  └─ config.ts         # load/merge config (global + project)
│  ├─ providers/
│  │  ├─ registry.ts       # providers, model roles
│  │  ├─ capabilities.ts   # tools/vision/context flags
│  │  ├─ fallback.ts       # 429 backoff + fallback chain
│  │  └─ presets.ts        # free-tier presets
│  ├─ tools/
│  │  ├─ index.ts          # registry + zod schemas
│  │  ├─ fs.ts             # read/write/edit/list/glob/grep
│  │  ├─ bash.ts
│  │  ├─ web.ts            # search + fetch
│  │  ├─ screenshot.ts
│  │  ├─ todo.ts
│  │  └─ ask.ts
│  ├─ skills/
│  │  ├─ loader.ts         # discover, progressive load
│  │  ├─ install.ts        # add/search with approval + pin
│  │  └─ sandbox.ts        # skills cannot widen permissions
│  ├─ mcp/
│  │  └─ client.ts
│  ├─ design/
│  │  ├─ brief.ts
│  │  ├─ research.ts       # reference collection
│  │  ├─ extract.ts        # vision → tokens/layout notes
│  │  ├─ linter.ts         # 14 banned patterns
│  │  ├─ critique.ts       # render → critique → fix loop
│  │  └─ imageToUi.ts
│  ├─ team/
│  │  ├─ workflow.ts       # brainstorm→…→finish state machine
│  │  ├─ roles.ts          # subagent role definitions
│  │  └─ worktree.ts
│  ├─ security/
│  │  ├─ review.ts         # diff-aware /security-review
│  │  ├─ audit.ts          # /audit with permission + scope guard
│  │  ├─ scope.ts          # local-only target guard
│  │  └─ filters.ts
│  └─ setup/
│     └─ projectSetup.ts   # /setup
├─ skills/                 # bundled skills (markdown)
│  ├─ design-taste/SKILL.md
│  ├─ frontend-design/SKILL.md
│  ├─ design-md/SKILL.md
│  ├─ image-prompt-enhance/SKILL.md
│  ├─ ui-ux-review/SKILL.md
│  ├─ code-review/SKILL.md
│  ├─ testing/SKILL.md
│  ├─ security-audit/SKILL.md
│  ├─ project-setup/SKILL.md
│  └─ team-{brainstorm,worktree,plan,execute,tdd,review,debug,verify,finish}/SKILL.md
├─ assets/                 # logo SVGs
├─ test/                   # vitest + fixtures (seeded-vuln app, sample repos)
└─ scripts/install.sh, install.ps1
```

Runtime folders:
- Global: `~/.idrix/{config.json, credentials, sessions/, skills/, commands/, mcp.json}`
- Project: `.idrix/{settings.json, skills/, commands/, mcp.json, plans/, specs/, refs/, design/, history/}` and `IDRIX.md`

---

## 3. Key designs

### 3.1 Config (`~/.idrix/config.json`)
```json
{
  "providers": {
    "openrouter": { "type": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY" },
    "gemini":     { "type": "google",     "apiKeyEnv": "GEMINI_API_KEY" },
    "deepseek":   { "type": "openai-compatible", "baseURL": "https://api.deepseek.com/v1", "apiKeyEnv": "DEEPSEEK_API_KEY" }
  },
  "roles": {
    "code":    { "provider": "deepseek",   "model": "deepseek-chat" },
    "vision":  { "provider": "gemini",     "model": "gemini-flash-latest" },
    "planner": { "provider": "openrouter", "model": "<free-or-cheap-model>" },
    "fast":    { "provider": "gemini",     "model": "gemini-flash-latest" }
  },
  "fallback": ["code", "planner"],
  "limits": { "maxStepsPerTurn": 40, "tokenBudgetPerTask": 400000 },
  "design": { "autoResearch": true, "sources": ["21st-dev"], "refCount": 4, "critiqueRounds": 3 },
  "security": { "auditRequiresConfirmation": true }
}
```
Model names above are placeholders; confirm current model IDs from each provider when implementing.

### 3.2 Agent loop (core/agent.ts)
```
run(userInput, session):
  ctx = buildContext(session, IDRIX.md, skillIndex, mode)
  loop up to maxSteps:
    stream = model.stream(ctx, tools = toolsFor(mode))
    render text tokens
    if no tool calls: break                       # done
    for call in toolCalls (parallel if independent & read-only):
      decision = permissions.check(call, mode)    # allow | ask | deny
      if ask: result = await ui.confirm(call)
      if denied: feed "denied by user" + reason
      else:
        checkpoint.snapshot(call) if it writes files
        output = tools.execute(call, signal)
        output = redactSecrets(output)
      append tool result to ctx
    if ctx too large: compact(ctx)
  return final text
```
Rules:
- Malformed tool call → return a clear error to the model and retry (max 2).
- Abort signal propagates to tools; `bash` kills the process tree.
- Plan mode: `toolsFor('plan')` returns only read-only tools + `ask_user`; write/bash are absent, not just denied.

### 3.3 Permissions
Rule format in `.idrix/settings.json`:
```json
{ "permissions": {
    "allow": ["read_file", "list_dir", "grep", "bash(npm test*)", "bash(npm run *)"],
    "ask":   ["write_file", "edit_file", "bash(*)"],
    "deny":  ["bash(rm -rf *)", "read_file(.env*)"] } }
```
Order: deny → ask → allow → default ask. Skills/plugins/MCP can only **narrow**, never widen (SKILL-6).

### 3.4 Skills (SKILL.md)
```markdown
---
name: design-taste
description: Use for any UI/website/app design task. Enforces the anti-"AI look" rules and requires a design brief, real references and a render-critique loop.
allowed-tools: [read_file, write_file, edit_file, screenshot, web_fetch]
---
# Design taste
...instructions...
```
Loader: scan folders → keep `{name, description, path}` in the system prompt (~1 line each). When the model calls `use_skill(name)` or user types `/name`, inject the full body (+ referenced files on demand).

### 3.5 Design engine pipeline
```
onUITask(task):
  brief   = design/brief.write(task)            # shown to user, saved
  refs    = design/research.collect(brief)      # search sources → 3–4 screenshots → .idrix/refs
  notes   = design/extract.run(refs)            # vision role → layout/type/spacing/palette/motion notes
  tokens  = design/tokens.derive(brief, notes)  # original palette/type scale
  code    = build(brief, notes, tokens)         # agent writes files
  repeat up to critiqueRounds:
    lint  = design/linter.scan(files)           # 14 patterns; fail → fix
    shots = screenshot(desktop, mobile)
    crit  = vision.critique(shots, brief)       # contrast, hierarchy, rhythm, motion, boredom
    if lint.ok and crit.ok: break
    fix(lint, crit)
  report()
```
**Linter (design/linter.ts)** — regex/AST rules over `.css .scss .tsx .jsx .html .vue .svelte`:
- `linear-gradient|radial-gradient|conic-gradient` (flag; allow only if brief explicitly justifies)
- `backdrop-filter|backdrop-blur`
- glow: `box-shadow` with large blur + saturated colour, `drop-shadow` neon
- emoji unicode ranges inside JSX text/icon positions
- repeated identical card blocks (3 siblings with same class set)
- `blur-3xl` / absolutely positioned blurred circles
- banned copy list (Elevate, Unleash, Seamless, Revolutionize, Cutting-edge, All-in-one, Lorem ipsum)
- default font stack with no `font-family` decision
- `rounded-2xl` + `shadow-lg` on > N elements
- pages with no `transition|animation|IntersectionObserver|motion` usage
Return `{hits:[{rule,file,line}], score:"0/14"}`.

**Image to UI (design/imageToUi.ts):** vision role extracts a JSON structure `{layout tree, typography, spacing scale, radii, palette, components}` → write `theme/tokens.*` first → build screens → render → vision compares render vs source → report match %, fix diffs, up to N rounds.

### 3.6 Team workflow (team/workflow.ts)
State machine: `brainstorm → (approve spec) → worktree → plan → (approve plan) → execute[task_i: implement → spec-review → quality-review] → review → verify → finish`.
- Each stage loads its `team-*` skill and, where relevant, runs in a subagent with the role's tool limits (PRD §5.8).
- Artifacts: `.idrix/specs/*.md`, `.idrix/plans/*.md`.
- User gates: approve spec, approve plan, approve finish option (merge/PR/keep/discard).
- Free-model mode: smaller tasks, more review passes, cheaper model for reviewers via `roles`.

### 3.7 Security (security/*)
- `review.ts`: get `git diff` (staged + unstaged, or vs base branch) → prompt from `security-audit` skill with the vulnerability classes in PRD §5.9 → collect findings JSON `{severity, file, line, issue, exploit, fix, confidence}` → apply `filters.md` exclusions → render.
- `audit.ts`: `confirm("Run a security audit?")` → static scan + dependency audit (`npm audit --json` etc.) + secrets scan + local dynamic probes.
- `scope.ts`: `assertLocal(target)` allows only `localhost`, `127.0.0.0/8`, `::1`, and ports the **audit itself started**. Anything else throws; tested.
- Untrusted-input rule: file contents, web pages, skill text are wrapped in an "untrusted data" delimiter in prompts, and tool calls triggered after reading them still go through permissions.

### 3.8 Project setup (setup/projectSetup.ts)
Detect stack → build recommendation list `{type: mcp|skill|hook|subagent|command, name, reason, files}` → show checklist → on approval write only to `.idrix/` and `IDRIX.md` → print created files.

### 3.9 Install scripts
- `scripts/install.sh`: detect OS/arch, check Node ≥ 20 (offer to install via `fnm`/package manager), `npm i -g idrixai`, print next step `idrix init`.
- `scripts/install.ps1`: same for Windows (`winget install OpenJS.NodeJS.LTS` if missing).
- Both must be readable and short so users can inspect before piping to a shell.

---

## 4. Phases

Each phase lists **Build**, **Done when** (acceptance checks), and the PRD IDs it covers. Rough solo estimate in weeks (part-time), shown as a guide only.

### Phase 0 — Setup (≈ 0.5 wk)
**Build:** repo, TypeScript, tsup, vitest, ESLint, CI (GitHub Actions on ubuntu + windows + macos), README skeleton with iDrix disclaimer, LICENSE, THIRD_PARTY_NOTICES stub, theme constants, logo SVGs in `assets/`.
**Done when:** `npm run build && node dist/cli.js --version` works on all three OS in CI.
**Also:** verify GitHub name/org and `idrixai` availability before first publish.

### Phase 1 — Core loop + basic tools, one provider (≈ 2 wk) — CORE-1/2/3, TOOL-1/2, PROV-1 (one)
**Build:** config loader, one provider (OpenRouter or Gemini), streaming agent loop, tools `read_file write_file edit_file list_dir glob grep bash`, minimal Ink UI (prompt box, streamed messages, tool rows), confirmation for writes/commands, abort handling.
**Done when:**
- "Create `hello.ts` that prints hi and run it" works end to end.
- Ctrl+C mid-write leaves no half-written file.
- Windows, macOS, Linux CI smoke test passes.

### Phase 2 — Modes, permissions, history (≈ 1.5 wk) — MODE-1..4, HIST-1..3
**Build:** plan/build modes with `shift+tab`, permissions engine + settings file, session JSONL + `/resume`, file checkpoints + `/undo` + `/history`, diff view, `IDRIX.md` + `/init`, status bar.
**Done when:** plan mode cannot write (tool absent); "don't ask again for npm" persists; `/undo` works after restart; resume restores todo list.

### Phase 3 — Multi-provider, roles, fallback (≈ 1.5 wk) — PROV-1..7, CORE-5
**Build:** provider registry for Gemini, DeepSeek, Kimi, OpenRouter, OpenAI-compatible, Ollama; roles; capability flags; 429 backoff + fallback chain; `idrix init` wizard with free presets; keys in keychain/0600 file; context compaction; `/cost`.
**Done when:** switching the `code` role between two providers needs only a config edit; forced 429 triggers fallback; keys never appear in logs (test greps session files).

### Phase 4 — Skills system + first bundled skills (≈ 1.5 wk) — SKILL-1..6, CMD-1
**Build:** loader with progressive disclosure, precedence, `/skills` list, `idrix skills add/search` with review screen + pinning, permission sandbox, custom slash commands, write first bundled skills (`design-taste`, `frontend-design`, `code-review`, `testing`, `design-md`, `image-prompt-enhance`, `ui-ux-review`).
**Done when:** 30 dummy skills add < 3k tokens of context; malicious-skill test (tries to allow `bash(*)`) is blocked; installing from a git URL shows files and asks.

### Phase 5 — Web tools + screenshots (≈ 1 wk) — TOOL-3/4/5
**Build:** `web_search` (free backend, configurable), `web_fetch` → markdown, Playwright screenshot tool (install on demand), secret redaction.
**Done when:** screenshot of a local dev server at 1280×800 and 390×844 returned to the vision role.

### Phase 6 — MCP client (≈ 1 wk) — MCP-1..3
**Build:** stdio + HTTP MCP client, config files, namespacing, per-server permissions, `idrix mcp add/list`, 21st.dev preset.
**Done when:** filesystem MCP server tools callable; first use of a new server prompts.

### Phase 7 — Design engine (≈ 3 wk) — DES-1..10
**Build:** brief, research (via MCP/web), extract (vision), tokens file, linter (14 patterns), render-critique loop, interactivity checks, real-copy check, `DESIGN.md` support, image-to-UI with compare score, bundled `impeccable`/`design-motion-principles` decision (licence check) or own versions.
**Done when:**
- Bakery landing-page task produces brief → 4 refs → build → `0/14` lint → critique fixes, with no gradients and working scroll/hover motion.
- Image-to-UI on 3 sample screenshots reaches ≥ 85% layout match.
- Seeded "gradient + glow + emoji" page is caught by the linter.

### Phase 8 — Subagents + dev-team workflow (≈ 3 wk) — TEAM-1..5, CORE-6
**Build:** `task` subagent tool (fresh context, tool limits, summary return), roles, `team-*` skills (adapted from Superpowers with attribution), worktree helper, spec/plan files, parallel dispatch with conflict guard, auto-suggest for large tasks, `/team`.
**Done when:** "clinic booking system" runs brainstorm → spec approval → worktree → plan approval → subagent tasks with two reviews each → tests → finish menu; main context stays small.

### Phase 9 — Security + setup (≈ 2 wk) — SEC-1..5, SETUP-1..3
**Build:** `/security-review` (diff-aware + filters), `/audit` (permission, static + deps + secrets + local probes, `SECURITY_REPORT.md`, fix-and-retest), scope guard, injection tests; `/setup` project recommender.
**Done when:** seeded vulnerable app (SQLi, weak JWT secret, IDOR, missing rate-limit, hardcoded key) is fully reported; target `example.com` refused; `/setup` writes only to `.idrix/` and `IDRIX.md`.

### Phase 10 — Plugins, hooks, polish, release (≈ 2 wk) — PLUG-1, HOOK-1, INST-1..5
**Build:** plugin bundles, hooks, install scripts, `idrix update`, docs site/README, example skills, `THIRD_PARTY_NOTICES.md`, error messages, `NO_COLOR`, 80-col layout, final Windows pass, publish `idrixai` to npm, tag v1.0.
**Done when:** fresh VM on each OS → one-line install → `idrix init` → first task in under 2 minutes.

**Total:** roughly 19 weeks part-time solo; faster if some phases are driven by Idrix itself once Phase 3 works (dogfooding).

---

## 5. Testing strategy
- **Unit (vitest):** permissions engine, config merge, skill loader, linter rules, scope guard, secret redaction, compaction.
- **Integration:** agent loop against a **mock provider** that replays recorded tool-call transcripts (no network, no cost).
- **Fixtures:** `test/fixtures/vuln-app` (seeded vulnerabilities), `test/fixtures/ai-look-page` (violates all 14 patterns), `test/fixtures/sample-repos/*` (5 stacks for `/setup`), `test/fixtures/images/*` (3 UI screenshots).
- **E2E smoke:** scripted `idrix -p` runs with a cheap real model, nightly only.
- **Cross-platform CI:** ubuntu, macos, windows on every PR.
- **Security tests:** prompt-injection file, malicious skill, non-local audit target, key-leak grep.
- **Golden screenshots:** TUI snapshots of Launch/Plan/Permission screens to keep them matching the mockups.

---

## 6. Dogfooding order
1. After Phase 3 you can use Idrix to build Idrix.
2. After Phase 7 use it for real client sites.
3. After Phase 9 run `/audit` on Idrix itself.

---

## 7. Risks to watch while building
- Don't let the plan grow: finish each phase before starting the next.
- Free models differ widely: keep a test matrix of 3 models (one strong, one free, one local).
- Keep tool outputs small (truncate, paginate) or small-context models fall over.
- Never merge a skill/plugin feature without the sandbox test.
- Re-check licences before bundling any third-party skill text.

---

## 8. Definition of Done for v1.0
- All **P0** requirements in the PRD pass their acceptance criteria.
- CI green on Windows, macOS, Linux.
- Fresh-install test passes on each OS.
- Security audit refuses non-local targets (tested).
- README, `THIRD_PARTY_NOTICES.md`, LICENSE and iDrix disclaimer present.
- Logo and mockup screens match the shipped UI.
