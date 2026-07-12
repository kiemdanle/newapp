# AGENTS.md
- Always remember: codex and Z.ai GLM 5 will fully review your output and give me the coding quality inspect once you're done any step
## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

<!-- CODEGRAPH_START -->

## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.
### **MANDATORY: Default to CodeGraph first for symbol/structure questions**

For ANY question about symbols, structure, callers/callees, or "where does X live / how does Y work", you MUST call a `codegraph_*` tool BEFORE running `find`, `grep`, `ls`, `Glob`, or spawning an exploration subagent. The default first move is `codegraph_context` (or `codegraph_search` for a single named lookup). Native `grep`/`find` are ONLY acceptable for: (a) literal text inside strings/comments/log messages, (b) files codegraph cannot parse (markdown, JSON, env, configs), or (c) confirming one specific detail in a file you already have open. If you catch yourself reaching for `find`/`grep` to locate a module, file, class, function, route, type, or to trace usage — STOP and use codegraph instead.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question                                      | Tool                |
| --------------------------------------------- | ------------------- |
| "Where is X defined?" / "Find symbol named X" | `codegraph_search`  |
| "What calls function Y?"                      | `codegraph_callers` |
| "What does Y call?"                           | `codegraph_callees` |
| "What would break if I changed Z?"            | `codegraph_impact`  |
| "Show me Y's signature / source / docstring"  | `codegraph_node`    |
| "Give me focused context for a task/area"     | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/"                | `codegraph_files`   |
| "Is the index healthy?"                       | `codegraph_status`  |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture / trace questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: _"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"_

<!-- CODEGRAPH_END -->

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Project Instructions

## Use Context7 by Default

Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

## Android Build And Install Policy

- Do not use Expo CLI, EAS, Expo Go, or Expo dev workflows to build or install the mobile app.
- Build Android APKs directly on this computer with the local Gradle/Android toolchain.
- Install and communicate with the phone via `adb`.
- Preferred debug build command:
  `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
- Preferred install command:
  `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

---
---

## Expyrico Colour Requirements

The required app and website palette is documented in `docs/design/expyrico-colour-palette.md`.

- Use Fresh Sage `#4BAE8A` for logo, headers, active states, and Good status.
- Use Deep Sage `#3A8F6F` for pressed states and text on light backgrounds.
- Use Mint Mist `#D6F0E6` for soft panels and success highlights.
- Use Warm White `#FAFAF8` for main backgrounds and cards.
- Use Honey `#F5A623` for CTAs, badges, highlights, and Expiring soon status.
- Use Soft Butter `#FEEFC3` for expiring-soon status backgrounds.
- Use Stone `#F0F0ED` for section backgrounds and dividers.
- Use Pebble `#8C8C85` for secondary text and icons.
- Use Almost Black `#2C2C28` for primary text.
- Use Alert Red `#E0442A` only for Expired/destructive status. Never use it for branding.
- Do not introduce alternate brand palettes for app themes. Theme/style variants may alter shape, elevation, spacing, or typography, but colors must resolve to the Expyrico palette.

## Security Mandates

### Environment & Secrets

- NEVER commit .env files, API keys, tokens, or credentials
- Use environment variables for ALL sensitive data
- Validate env vars at startup; fail fast if missing critical vars

### Input Validation & Sanitization

- Validate ALL user inputs on BOTH client and server
- Use zod for schema validation
- Sanitize inputs before database operations
- Implement Content Security Policy (CSP) headers

### Authentication & Authorization

- Implement proper JWT handling with short expiration times
- Use HTTP-only, Secure, SameSite cookies for tokens
- Implement RBAC consistently
- Validate permissions on EVERY API route/server action
- Implement rate limiting on all API endpoints

### Wallet & Transaction Security

- Always check for race conditions in concurrent transaction exploit / balance race during topup
- Always check for TOCTOU vulnerabilities when spending pink coin for ordering services

### Form Security

- Always implement Google reCAPTCHA v3 on pages where client can submit input (register, login, contact, forgot password)
