# Idrix — Product Requirements Document (PRD)

**Version:** 0.1 (draft) · **Date:** 2026-10-21 · **Owner:** Idriss Manica Sesay
**Status:** Planning complete, build not started

> Idrix is a free, open-source, terminal-based AI coding agent that works with any model provider, ships with a built-in "dev team" workflow, and produces websites and apps that do **not** look AI-generated.

---

## 1. Overview

### 1.1 Problem
- Paid AI coding tools (Claude Code, Codex) hit usage limits, which stops work mid-project.
- Many free/cheap models exist (Gemini, DeepSeek, Kimi, OpenRouter free tier) but no single tool uses them well with a polished, agentic workflow.
- Every AI-built website looks the same: purple-blue gradients, glow, identical card grids, filler copy. Clients can tell, and it hurts the people who build for clients (e.g. freelance web designers).
- AI tools jump straight to code. Big projects need planning, tests, review and security checks, the way a real dev team works.

### 1.2 Solution
Idrix is a cross-platform CLI (`idrix`) that:
1. Runs a full agentic loop (gather context → act → verify) on **any** model provider through the user's own API keys.
2. Has **plan mode** and **build mode**, permissions, file history and session history.
3. Has a built-in **design engine** that researches real references, extracts layout/type/motion, builds an original design, then renders and critiques its own result, with a banned list of "AI look" patterns.
4. Has a built-in **dev-team workflow** (brainstorm → plan → isolated build with subagents → TDD → review → verify).
5. Has a **project setup** command and a **security review / audit** (opt-in, on the user's own code only).
6. Supports **skills**, **MCP servers** and **plugins** so the community can extend it.

### 1.3 Who it is for
- **Primary:** Idriss and developers like him: students and freelancers (e.g. in Freetown) who build websites/apps for small-business clients, have limited budget, and want professional results.
- **Secondary:** Any developer who wants a free, provider-agnostic terminal agent.

### 1.4 Goals
| # | Goal | How we know |
|---|------|-------------|
| G1 | Free to run: works fully with free/cheap provider keys | A complete landing-page task finishes on a free model tier |
| G2 | Output that does not look AI-generated | Design check passes 0/14 banned patterns; human reviewers rate "not AI-looking" |
| G3 | Works like a real dev team on big tasks | Large task runs brainstorm → plan → build → review → verify without hand-holding |
| G4 | One-command install on macOS, Linux, Windows | Fresh machine → `idrix` running in under 2 minutes |
| G5 | Safe by default | No write/command without permission; audit never touches things the user does not own |

### 1.5 Non-goals (v1)
- No hosted service, accounts, or telemetry. Everything runs locally.
- No GUI/IDE extension (terminal only; IDE bridge is a later idea).
- Not a model. Idrix calls models the user already has access to.
- No copying of any other product's source code, prompts or branding (see §11).

---

## 2. Product principles
1. **Think before doing.** Plan first; ask only when a wrong guess is expensive.
2. **Real, not generic.** Design decisions come from research and a brief, not defaults.
3. **Never locked in.** Every model role (code, vision, planner) can use a different provider.
4. **Permission is explicit.** Reading is free; writing, commands, network and security testing are gated.
5. **Free first.** Defaults assume free-tier limits (small context, rate limits, no vision on some models).
6. **Everything is a file.** Skills, plans, memory, config are plain markdown/JSON users can edit.

---

## 3. Brand and visual identity
- **Name:** Idrix (command `idrix`; npm package `idrixai`, pending availability check)
- **Logo:** custom rounded wordmark "idrix": cream letters, amber spark on the first i, amber crossed x. Files: `idrix-wordmark-for-dark-bg.svg`, `idrix-wordmark-for-light-bg.svg`. Icon tile (ix monogram) only for favicon/avatar.
- **Palette:** background `#121211`, ink `#d9d5c9`, accent amber `#e8b04a` (light-bg amber `#c98a1d`), success `#86c27f`, error `#e0705f`, info `#7fb0d9`, violet (image refs) `#b79ad6`, dim `#77746a`, line `#2c2b27`.
- **Style:** flat, no gradients, no glow. Monospace terminal UI, rounded boxes, `●` bullets for steps, `⎿` for sub-steps, `›` prompt.
- **Disclaimer:** README must state Idrix is unrelated to iDrix Technology S.A. (Ecuador), which exists as a separate company.

---

## 4. User experience (screens)
Mockups exist: `idrix-1.png` … `idrix-5.png`.

| Screen | Contents |
|---|---|
| **New chat / launch** | Logo, version, "welcome back", **Tips to start**, **Recent sessions** (`/resume`), prompt box, mode + status bar. Nothing else (no model/skills/MCP lists). |
| **Build session** | Prompt, design brief, research step, anti-generic check, writes, dev server, render & critique, done. |
| **Plan mode** | Read-only numbered plan, approval menu (build / auto-accept edits / edit plan / keep planning). |
| **Permission prompt** | Command shown, choices: yes / yes-don't-ask-again-for-this-project / no-and-tell-idrix. |
| **Image to UI** | `[Image #1]` input, "Reading image" extraction (layout, type, spacing, palette), write, compare score. |
| **Security audit** | Opt-in prompt with scope/checks/live-test rules, results by severity, fix-all menu. |

Status bar always shows: mode pill (`BUILD` amber / `PLAN` blue), `shift+tab` hint, short command hints, cost indicator (`free` or token cost).

---

## 5. Functional requirements

Priority: **P0** = v1 must, **P1** = v1 should, **P2** = later.

### 5.1 Core agent
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| CORE-1 | Agent loop: gather context → act with tools → verify → repeat until done or stopped | P0 | Given "add a /health route", agent reads project, edits file, runs test/build, reports result |
| CORE-2 | Streaming output with live tool-call display | P0 | Tokens and tool calls render as they arrive |
| CORE-3 | Interrupt (Esc/Ctrl+C) stops cleanly without corrupting files | P0 | Interrupt mid-edit leaves file either fully old or fully new |
| CORE-4 | Headless mode: `idrix -p "prompt"` prints result and exits | P1 | Works in scripts/CI; exit code reflects success |
| CORE-5 | Context management: auto-compact old turns when near context limit; per-model context size from config | P0 | 2-hour session on a 32k model keeps working |
| CORE-6 | Todo/task list tool the model updates during long tasks | P1 | User sees progress list |
| CORE-7 | Project memory file `IDRIX.md` (always-loaded project notes); `/init` creates it | P1 | File content appears in system context |

### 5.2 Modes, permissions, history
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| MODE-1 | **Plan mode**: read-only tools only; produces plan; waits for approval | P0 | Write/bash attempts are blocked and reported |
| MODE-2 | **Build mode**: full tools, permission gated | P0 | Toggle with `shift+tab` |
| MODE-3 | Permission rules: allow / ask / deny per tool, per command pattern, per project | P0 | "don't ask again for npm in this project" persists in `.idrix/settings.json` |
| MODE-4 | Auto-accept-edits option for file edits only | P1 | Edits skip prompt; shell still asks |
| HIST-1 | Session history saved locally; `/resume` lists and restores | P0 | Restores messages and todo state |
| HIST-2 | **File history / undo**: snapshot each file before Idrix edits it; `/undo` restores the last change; `/history` lists | P0 | Undo works after process restart |
| HIST-3 | Diff view before applying large edits | P1 | Colored unified diff in prompt |

### 5.3 Providers and models
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| PROV-1 | Provider registry: OpenRouter, Google Gemini, DeepSeek, Moonshot/Kimi, OpenAI, Anthropic, any OpenAI-compatible URL, local (Ollama/LM Studio) | P0 | Add a provider by editing config or `idrix providers add` |
| PROV-2 | **Model roles**: `code`, `vision`, `planner`, `fast` each map to a provider/model | P0 | Vision role used only for image tasks |
| PROV-3 | Free-tier presets (e.g. OpenRouter free models, Gemini free tier) with known limits | P1 | `idrix init` offers a free setup |
| PROV-4 | Rate-limit/429 handling: backoff, then fall back to next configured model | P0 | Run continues when primary model is throttled |
| PROV-5 | API keys stored in OS keychain or `~/.idrix/credentials` (0600); never logged | P0 | Keys never appear in session files or output |
| PROV-6 | Capability flags per model (tools, vision, streaming, context size) with graceful degradation | P0 | Model without tool-calling uses a text-protocol fallback or is rejected with a clear message |
| PROV-7 | Token/cost display per session | P1 | `/cost` |

### 5.4 Tools (built-in)
`read_file`, `write_file`, `edit_file` (exact string replace), `list_dir`, `glob`, `grep`, `bash` (with timeout and background option), `web_search`, `web_fetch`, `screenshot` (headless browser), `ask_user`, `todo`, `task` (subagent).

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| TOOL-1 | File tools respect project root and ignore rules (`.gitignore`, `.idrixignore`) | P0 | Can't read outside root without permission |
| TOOL-2 | `bash` runs in project cwd, streams output, enforces timeout, kills process tree on cancel | P0 | Works on Windows (PowerShell/cmd), macOS, Linux |
| TOOL-3 | `web_search` uses a free search backend (configurable); `web_fetch` converts pages to markdown | P0 | Works without a paid key |
| TOOL-4 | `screenshot` via Playwright at configurable viewports (desktop 1280×800, mobile 390×844) | P0 | Returns image to vision model |
| TOOL-5 | Secret redaction on tool output before it goes to the model | P1 | `.env` values masked |

### 5.5 Skills (reusable markdown capabilities)
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| SKILL-1 | A skill is a folder with `SKILL.md` (YAML frontmatter `name`, `description`, optional `triggers`, `allowed-tools`) plus optional files | P0 | Format documented |
| SKILL-2 | **Progressive loading**: only names + descriptions in context; full body loaded when the model picks the skill or the user runs `/skill-name` | P0 | Context stays small with 30+ skills |
| SKILL-3 | Skill locations: bundled, `~/.idrix/skills`, project `.idrix/skills`; project overrides user overrides bundled | P0 | Precedence tested |
| SKILL-4 | `idrix skills add <git-url or path>`: **shows the skill, its files and any commands it asks for, and requires approval**; pins commit hash | P0 | Never auto-installs unreviewed skills from the web |
| SKILL-5 | `idrix skills search <query>` searches known registries/GitHub and lists results with license | P1 | Results never auto-install |
| SKILL-6 | Skills may not widen permissions: a skill cannot allow tools the user denied | P0 | Test: malicious skill tries `bash curl | sh` → still asks |

**Bundled skills (v1):**

| Skill | Purpose | Source / licence note |
|---|---|---|
| `design-taste` | Anti-"AI look" rulebook, 14 banned patterns, what to do instead | Own writing |
| `impeccable` | High-bar frontend design guidance | Public skill (pbakaus/impeccable): **check licence before bundling; else install-on-demand or write own** |
| `frontend-design` | Layout, typography, spacing, component craft | Own writing |
| `design-motion-principles` | Easing, timing, staging, scroll/hover/page-transition motion | Public versions exist: **check licence; else own** |
| `design-md` | Read/write `DESIGN.md` brand spec (Google Stitch open spec) | Follow open spec |
| `image-prompt-enhance` | Turns vague image requests into detailed prompts | Own writing |
| `ui-ux-review` | Critique of rendered pages against the brief | Own writing |
| `code-review` | Review a diff/branch for bugs, style, tests | Own writing |
| `testing` | Write and run tests; fix failures | Own writing |
| `security-audit` | See §5.9 | Adapted from MIT-licensed security reviewer with attribution |
| `team-*` (dev-team set) | See §5.8 | Adapted from MIT-licensed Superpowers with attribution |
| `project-setup` | See §5.10 | Own implementation of the idea |

### 5.6 Design engine (automatic, the main differentiator)
Triggered automatically for any UI task (website, landing page, web app, mobile app, desktop app UI).

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| DES-1 | **Design brief** written before code: audience, tone, must-haves, constraints, 2 layout directions when the task is big | P0 | Brief shown; saved to `.idrix/design/brief.md` |
| DES-2 | **Auto research:** without being asked, search configured sources (21st.dev via MCP, component galleries, design galleries), pick 3–4 references, save screenshots to `.idrix/refs/` | P0 | References listed with source URLs |
| DES-3 | **Extract, don't copy:** vision model describes layout, type pairing, spacing, palette, motion per reference; Idrix builds an **original** design | P0 | Output is not a 1:1 clone; a similarity warning appears if it is |
| DES-4 | **Anti-generic linter:** static scan of CSS/TSX/HTML for the 14 banned patterns (§5.6.1); build blocks until fixed or user overrides | P0 | Scan reports `0 / 14` on success |
| DES-5 | **Render & critique loop:** screenshots at desktop and mobile, model critiques vs brief (contrast, hierarchy, rhythm, spacing, motion, empty/boring sections), fixes, repeats up to N times | P0 | Visible fixes logged |
| DES-6 | Interactive by default: scroll reveals, hover/focus states, meaningful motion, respects `prefers-reduced-motion` | P0 | Checked by critique |
| DES-7 | Real copy: no lorem ipsum or generic marketing filler; asks for or invents business-specific copy and flags what the user must replace | P1 | No placeholder text left |
| DES-8 | **Image to UI:** user supplies image(s); vision extracts structure, tokens (colors/type/spacing/radius), then code; compare render vs source; report match scores; iterate | P0 | Visual diff score reported; tokens in a single theme file |
| DES-9 | Design tokens in one file (`theme/tokens.*`) so the whole look can be retuned | P1 | Changing a token updates the app |
| DES-10 | `DESIGN.md` support: if present, obey; offer to generate one | P1 | Read at start of UI tasks |

#### 5.6.1 Banned "AI look" patterns (default list; user-editable)
1. Purple/blue/pink default gradients (backgrounds, text, buttons)
2. Any gradient used as decoration without a design reason
3. Glassmorphism / `backdrop-blur` cards everywhere
4. Neon glow shadows and glowing borders
5. Emoji used as icons or section markers
6. Identical three-column icon + title + text card grids
7. Floating blobs/orbs/blurred circles as decoration
8. Centered hero with gradient headline and two stacked CTA buttons by default
9. "New" / "Introducing" pill badge above hero headline by default
10. Marketing filler: "Elevate", "Unleash", "Seamless", "Revolutionize", "Cutting-edge", "All-in-one"
11. Lorem ipsum or "Your text here"
12. Default Inter + default framework-blue buttons with no type or colour decision
13. Everything `rounded-2xl` with the same soft shadow
14. Text-only pages with no interaction, imagery or rhythm

### 5.7 Extensibility
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| MCP-1 | MCP client (stdio and HTTP/SSE) configured in `.idrix/mcp.json` and `~/.idrix/mcp.json`; tools namespaced `mcp__server__tool` | P0 | Connect a filesystem server and call a tool |
| MCP-2 | Per-server permission rules; first use of a new server asks | P0 | |
| MCP-3 | Preconfigured optional entries: 21st.dev MCP, Playwright MCP, filesystem | P1 | `idrix mcp add 21st-dev` |
| PLUG-1 | **Plugin** = folder bundling skills + slash commands + subagent definitions + MCP config + hooks; installed with the same approval flow as skills | P1 | `idrix plugin add <git-url>` |
| CMD-1 | Custom slash commands as markdown files in `.idrix/commands/` | P1 | `/review-pr` runs the file as a prompt |
| HOOK-1 | Hooks: run shell commands on events (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`) that can block or modify | P2 | Type-check after every edit |

### 5.8 Dev-team workflow ("Idrix Team") — Superpowers-style
Turns Idrix from a single assistant into a coordinated team for non-trivial work. Inspired by the open-source **Superpowers** methodology (MIT, Jesse Vincent / Prime Radiant); implemented as bundled `team-*` skills plus subagents, with attribution and license notice included.

**Workflow (automatic for large tasks, or `/team <task>`):**
1. **Brainstorm** (`team-brainstorm`): ask clarifying questions one at a time, propose 2–3 approaches, write a design/spec for approval before any code.
2. **Isolate** (`team-worktree`): create a git worktree/branch, run setup, confirm a clean test baseline.
3. **Plan** (`team-plan`): break the approved design into small tasks (2–5 min each) with exact file paths, code outline and verification steps.
4. **Execute** (`team-execute`): fresh subagent per task; after each task a spec-compliance review then a code-quality review; parallel dispatch for independent tasks.
5. **TDD** (`team-tdd`): red → green → refactor; no production code without a failing test first (exceptions need user OK).
6. **Review** (`team-review`): review against the plan, severity-ranked; critical issues block.
7. **Debug** (`team-debug`): systematic root-cause process (reproduce → isolate → hypothesise → verify), no guess-fixes.
8. **Verify** (`team-verify`): evidence before claiming done (run tests/build, show output).
9. **Finish** (`team-finish`): tests pass → offer merge / PR / keep / discard; clean up worktree.

**Roles (subagents, each with its own tool limits and fresh context):**
| Role | Does | Tools |
|---|---|---|
| Product manager | Brainstorm, requirements, acceptance criteria | read, web |
| Architect | Plan, data model, API shape | read, web |
| Designer | Design engine pipeline | read, write (design files), screenshot, web |
| Frontend dev | UI code | read, write, bash |
| Backend dev | API, data, auth | read, write, bash |
| QA engineer | Tests, edge cases | read, write (tests), bash |
| Code reviewer | Diff review | read, bash (read-only) |
| Security reviewer | §5.9 | read, bash (read-only), local test tools |
| DevOps | Build, deploy config, CI | read, write, bash |

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| TEAM-1 | `task` tool spawns a subagent with its own context and tool limits; returns only a summary | P0 | Main context does not grow with subagent's internal steps |
| TEAM-2 | Parallel subagents for independent tasks, with file-conflict protection | P1 | Two tasks on different files run concurrently |
| TEAM-3 | Plans saved to `.idrix/plans/YYYY-MM-DD-name.md`, specs to `.idrix/specs/` | P0 | Resumable |
| TEAM-4 | Team workflow suggested automatically when a task touches many files or the prompt describes a "system" | P1 | User can decline and stay in simple mode |
| TEAM-5 | Free-model friendly: roles can map to cheaper/smaller models | P1 | Config `roles.reviewer.model` |

### 5.9 Security: review and audit — modelled on Claude Code Security Reviewer
Inspired by Anthropic's open-source **claude-code-security-review** (MIT): diff-aware, semantic, with false-positive filtering. Two levels:

**`/security-review` (light, on pending changes)**
- Analyses the current git diff for: injection (SQL, command, NoSQL, XPath, XXE), auth/authz flaws, hardcoded secrets and sensitive logging, weak crypto, missing input validation, business-logic races (TOCTOU), insecure config (headers, CORS), dependency risk, deserialization/eval RCE, XSS.
- Filters low-value noise by default (generic DoS, rate-limit-only, open redirects, unproven input validation); filters are editable in `.idrix/security/filters.md`.
- Each finding: severity, file:line, why it matters, concrete exploit scenario, fix suggestion, confidence.

**`/audit` (deep, whole project)**
- After any big build Idrix **asks permission**: "Run a security audit on this project?" Nothing runs without a yes.
- **Scope rules (hard-coded, not overridable by skills or prompts):**
  - Only the current project's files.
  - Dynamic tests only against **localhost / the user's own started copy**. Idrix refuses to attack any other host, IP or domain.
  - No data exfiltration; secrets found are masked in reports.
- Checks: static scan, dependency advisories (`npm audit`, `pip-audit`, etc.), secrets scan, auth/session tests, SQLi/XSS/IDOR/brute-force probes against local app, security headers.
- Output: `SECURITY_REPORT.md` with severity table; offer **fix all high/medium and re-test**, show each fix first, or save report only.

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| SEC-1 | `/security-review` on a diff finds a seeded SQL injection and a seeded hardcoded key | P0 | Both reported with file:line |
| SEC-2 | `/audit` requires explicit confirmation each run | P0 | Declining runs nothing |
| SEC-3 | Dynamic tests refuse non-local targets | P0 | Test: target `example.com` → refused |
| SEC-4 | Treat repo content, web pages and skills as untrusted input (prompt-injection awareness): they cannot trigger tools outside permissions | P0 | Injection test file does not cause an unapproved command |
| SEC-5 | Fix-and-retest loop verifies the vulnerability is gone | P1 | Re-run shows finding resolved |

### 5.10 Project setup — modelled on the claude-code-setup plugin
`/setup` (also run offered on first use in a new project): reads the codebase and recommends tailored automations; **applies only configuration files after approval, never source code.**

| Recommends | Examples |
|---|---|
| MCP servers | Library docs server, browser/Playwright, database |
| Skills | Build+test+package pipeline, framework-specific checks |
| Hooks | Type-check/lint after every edit |
| Subagents | Release reviewer, security reviewer |
| Slash commands | `/test`, `/deploy-preview` |

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| SETUP-1 | Detects stack (package.json, pyproject, Cargo, etc.) and frameworks | P0 | Correct detection on 5 sample repos |
| SETUP-2 | Shows a recommendation list with reason for each; user picks which to apply | P0 | Nothing written before approval |
| SETUP-3 | Writes only under `.idrix/` and `IDRIX.md`; reports every file it created | P0 | No source files changed |

### 5.11 Installation and updates
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| INST-1 | `npm install -g idrixai` (Node 20+) | P0 | `idrix --version` works on Win/macOS/Linux |
| INST-2 | One-line installers: `curl -fsSL <url>/install.sh \| sh` and PowerShell `irm <url>/install.ps1 \| iex` that install Node if missing, then the package | P1 | Fresh VM test |
| INST-3 | Standalone binaries (no Node needed) | P2 | Release artifacts |
| INST-4 | `idrix update` and update notice | P1 | |
| INST-5 | First-run wizard `idrix init`: pick provider, paste key, test connection, choose free preset | P0 | End-to-end first prompt in < 2 min |

---

## 6. Non-functional requirements
- **Platforms:** Windows 10+, macOS 12+, major Linux. Windows path and shell differences handled in one place.
- **Performance:** startup < 500 ms to prompt; first token streamed as soon as provider returns it.
- **Reliability:** no partial file writes (write temp then rename); crash-safe session log (append-only JSONL).
- **Privacy:** no telemetry. Only the user's chosen provider receives prompts. Provider list shown in `idrix privacy`.
- **Cost control:** token budget per task, warning at thresholds, `/cost`.
- **Accessibility of the CLI:** works in 80-column terminals, respects `NO_COLOR`, works over SSH.
- **Licensing:** Idrix under MIT (or Apache-2.0). Bundled third-party content keeps its licence and attribution in `THIRD_PARTY_NOTICES.md`.
- **Free-model reality:** weaker models need smaller steps; the agent must tolerate malformed tool calls (repair/retry up to 2 times).

---

## 7. Success metrics (v1)
- A new user finishes install + first prompt in under 2 minutes.
- 8 of 10 test UI tasks pass the 14-pattern linter on the first render.
- In a blind comparison of 10 generated sites vs a generic AI baseline, reviewers pick Idrix output as "more human-made" in at least 7 of 10.
- A "clinic booking system" style task completes the full team workflow with all tests passing.
- Security audit finds all seeded vulnerabilities in the test project and refuses non-local targets.

---

## 8. Release plan
| Release | Contents |
|---|---|
| **v0.1 (alpha)** | CORE, MODE, HIST, PROV (2 providers), TOOL, basic TUI, install via npm |
| **v0.2** | Skills system, bundled design skills, DES-1/4/5, screenshot tool |
| **v0.3** | Design engine complete (research, image-to-UI), MCP client |
| **v0.4** | Team workflow, subagents, plan/spec files |
| **v0.5** | `/security-review`, `/audit`, `/setup`, plugins |
| **v1.0** | Hardening, docs, installers, tests, public launch |

---

## 9. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Free models are weaker and may not support tool calling or vision | Poor results | Capability flags, text-protocol fallback, separate vision role, smaller steps, fallback chain |
| Free-tier rate limits | Interrupted work | Backoff, auto-fallback model, resumable sessions |
| Auto-fetching skills/web content could carry prompt injection or malicious instructions | Security | Approval + pinning for skills; untrusted-content handling; permission rules cannot be widened by content |
| Security audit misused against third-party systems | Legal/ethical | Hard-coded local-only scope; refusal tests |
| Design references copied too closely | Copyright, quality | Extract-don't-copy rule, similarity warning, licence checks for component code |
| Scope is very large for a solo student | Never ships | Strict phase order; ship v0.1 first |
| Name clash (iDrix Technology S.A.; Idris language) | Confusion | Disclaimer; distinctive spelling; check GitHub/npm before publishing |
| Windows shell differences | Broken tools | Dedicated shell adapter + CI on Windows |

---

## 10. Open questions
1. GitHub username/org for the project and final npm name (`idrixai` free on npm at time of check; GitHub not yet checked).
2. Licence choice: MIT or Apache-2.0.
3. Which free search backend for `web_search` (options: self-hostable metasearch, free-tier API).
4. Which design sources to enable by default (21st.dev MCP confirmed wanted; others to be chosen).
5. Whether to bundle `impeccable` and `design-motion-principles` or install on demand (needs licence check).
6. Whether v1 includes hooks and plugins or defers them.

---

## 11. Legal and attribution
- Idrix is an **independent implementation**. It does not copy source code, system prompts, assets or branding from Claude Code or any other product. Product ideas (modes, skills, MCP, subagents) are general patterns.
- **Superpowers** (MIT) and **claude-code-security-review** (MIT): if prompts or text are adapted, keep the MIT notice and credit the authors in `THIRD_PARTY_NOTICES.md`.
- **MCP** is an open protocol; use the official SDK.
- Third-party skills (impeccable, motion principles, etc.): confirm licence before bundling; otherwise offer install-on-demand or write original equivalents.
- Reference screenshots from websites are used for analysis only; generated designs must be original.

---

## 12. Sources reviewed
- Superpowers methodology (workflow stages and skills), MIT, by Jesse Vincent / Prime Radiant
- Anthropic `claude-code-security-review` README (features, vulnerability classes, false-positive filtering, MIT) and `/security-review` command
- `claude-code-setup` plugin description (recommends MCP servers, skills, hooks, subagents, slash commands; writes config only)
- DESIGN.md open specification (Google Stitch)
- Public design skills: Impeccable, design-motion-principles, "anti-AI-slop" design skills
