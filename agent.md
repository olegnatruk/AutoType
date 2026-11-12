# AutoType — AI Agent Operating Manual

> **Primary Entry Point for AI Coding Agents.**  
> Read this document first to orient yourself, understand system boundaries, locate critical subsystems, and follow development and documentation protocols.

---

## 1. Project Identity

AutoType is a free, account-free Chrome extension (Manifest V3) that enters a prepared plain-text passage into a web destination at the user's cursor with a natural human rhythm averaging **75 WPM**.

- **Core Problem Solved**: Inserting text into web applications where bulk pasting is blocked, disruptive, or formats incorrectly, emulating authentic keyboard entry.
- **Repository Scope**: Confined entirely to `autotype/` within the parent Git workspace. Edits and commits must never touch parent files.
- **Audience & Intent**: Public release; zero accounts, no cloud sync, no telemetry, local persistence only.

---

## 2. Current State

- **Stage**: Production-ready MVP (version `0.1.0`).
- **Implementation Status**:
  - Pure pacing engine, text segmentation, and serial state machine: Complete.
  - Background service worker, Chrome DevTools Protocol (CDP) driver, and session checkpointing: Complete.
  - Isolated target guard with deep iframe and shadow DOM traversal: Complete.
  - Compact popup UI ("The Quiet Writing Slip"): Complete.
  - Test suite (18 tests passing in Node.js built-in runner): Complete.
  - Static checks, zero-dependency packager, and store submission assets: Complete.
- **Pending Gates**: Google Docs compatibility verification in a live, signed-in Chrome session (see [`docs/known-issues.md`](docs/known-issues.md)).

---

## 3. Tech Stack

- **Runtime Environment**: Google Chrome 118+ (Manifest V3).
- **Language**: Pure ECMAScript Modules (ESM) JavaScript (`type: "module"` in `package.json` and `manifest.json`).
- **Dependencies**: **Zero runtime and zero dev dependencies**. Uses standard Web APIs (`Intl.Segmenter`, `AbortController`, `crypto.randomUUID()`) and native Node.js 22+ modules (`node:test`, `node:assert`, `node:fs`, `node:child_process`).
- **UI & Styling**: Semantic HTML5 and pure CSS without preprocessors, bundlers, or frameworks.
- **Testing**: Node.js native test runner (`node --test tests/*.test.js`).
- **Input Driver**: Chrome DevTools Protocol 1.3 via `chrome.debugger` (`Input.dispatchKeyEvent`, `Input.insertText`).

---

## 4. Repository Map

```text
autotype/
├── agent.md               # You are here: primary AI operating manual
├── AGENTS.md              # Compact repository router (<100 lines)
├── PROJECT-BRIEF.md       # Product requirements and release boundaries
├── DESIGN.md              # Visual design tokens and UI specification
├── README.md              # User setup and quick-start instructions
├── package.json           # Node configuration and npm scripts
├── extension/             # Unpacked Chrome Extension runtime
│   ├── manifest.json      # MV3 configuration, permissions, commands
│   ├── background.js      # Background service worker; owns Chrome APIs & CDP
│   ├── core.js            # Pure pacing, segmentation, and session state machine
│   ├── target.js          # Injected isolated-world target guard & DOM inspector
│   ├── popup.html         # Extension popup markup
│   ├── popup.css          # Extension popup styles
│   └── popup.js           # Popup controller, UI events, live progress
├── tests/                 # Test suite & fixtures
│   ├── core.test.js       # Node.js native unit & concurrency test suite
│   ├── fixture.html       # Browser test fixture with various editable fields
│   └── frame.html         # Nested iframe fixture
├── scripts/               # Developer tooling (zero-dependency)
│   ├── check.mjs          # Manifest, icon, CSP, and syntax checks
│   ├── package.mjs        # Builds production ZIP in dist/
│   ├── serve.mjs          # Loopback dev server (127.0.0.1:8765)
│   └── icons.mjs          # Geometric PNG icon generator
├── store/                 # Chrome Web Store submission materials
│   ├── README.md          # Release instructions and reviewer guidelines
│   ├── LISTING.md         # Listing copy and permission justifications
│   ├── privacy.html       # Standalone HTML privacy policy
│   └── screenshots/       # Verified store screenshots
└── docs/                  # Persistent Second Brain documentation
    ├── project-overview.md
    ├── architecture.md
    ├── codebase-map.md
    ├── conventions.md
    ├── development.md
    ├── troubleshooting.md
    ├── known-issues.md
    ├── changelog.md
    ├── systems/
    │   ├── typing-engine.md
    │   ├── session-lifecycle.md
    │   ├── target-guarding.md
    │   └── storage-and-ipc.md
    └── decisions/
        ├── index.md
        ├── 0001-browser-debugger-input.md
        ├── 0002-serial-queue-and-session-checkpoints.md
        └── 0003-zero-runtime-dependencies.md
```

---

## 5. Architecture in a Nutshell

AutoType coordinates across three execution contexts:

1. **Popup Context** ([`extension/popup.js`](extension/popup.js)): User pastes passage $\rightarrow$ Immediately sends `SAVE_DRAFT` $\rightarrow$ Worker serializes write to `chrome.storage.local`.
2. **Service Worker Context** ([`extension/background.js`](extension/background.js) + [`extension/core.js`](extension/core.js)): User hits destination shortcut $\rightarrow$ `CommandController` waits 300ms for modifier release $\rightarrow$ `TypingSession` snapshots draft, calculates 75 WPM schedule, inspects target, attaches `chrome.debugger`, arms guard, and pumps characters sequentially via CDP.
3. **Isolated Target Context** ([`extension/target.js`](extension/target.js)): Injected into target tab $\rightarrow$ resolves active element (penetrating iframes/shadow roots) $\rightarrow$ sets synchronous DOM interruption listeners (`pointerdown`, `focusin`, `keydown`, `visibilitychange`, `blur`) on `window.__autotypeGuardV1`.

For complete architectural details, read [`docs/architecture.md`](docs/architecture.md).

---

## 6. Important Systems

- **Pacing Engine & CDP Transport**: [`docs/systems/typing-engine.md`](docs/systems/typing-engine.md)  
  *Grapheme segmentation (`Intl.Segmenter`), punctuation weights (`2.1` / `1.5`), dynamic overhead compensation, CDP character dispatch modes.*
- **Session Lifecycle & State Machine**: [`docs/systems/session-lifecycle.md`](docs/systems/session-lifecycle.md)  
  *Phases (`idle`, `starting`, `typing`, `paused`, `completed`, `stopped`, `error`), serialized Promise action queue, abortable timers, suspension restoration.*
- **Target Guarding & DOM Interruption**: [`docs/systems/target-guarding.md`](docs/systems/target-guarding.md)  
  *Deep iframe/shadow traversal, Google Docs canvas detection, synchronous disarm invariant on cursor movement.*
- **Storage & IPC Messaging**: [`docs/systems/storage-and-ipc.md`](docs/systems/storage-and-ipc.md)  
  *`chrome.storage.local` with `TRUSTED_CONTEXTS`, session checkpoints, popup messaging protocol, action badges.*

---

## 7. Critical Files by Subsystem

When modifying a specific part of AutoType, inspect these critical files first:

| Subsystem | Primary Implementation | Supporting Documentation | Test File |
| --- | --- | --- | --- |
| Pacing & Segmentation | [`extension/core.js`](extension/core.js) | [`docs/systems/typing-engine.md`](docs/systems/typing-engine.md) | [`tests/core.test.js`](tests/core.test.js) |
| Session State Machine | [`extension/core.js`](extension/core.js) | [`docs/systems/session-lifecycle.md`](docs/systems/session-lifecycle.md) | [`tests/core.test.js`](tests/core.test.js) |
| CDP Input & Chrome APIs | [`extension/background.js`](extension/background.js) | [`docs/architecture.md`](docs/architecture.md) | Manual fixture test |
| Target Resolution & Guard | [`extension/target.js`](extension/target.js) | [`docs/systems/target-guarding.md`](docs/systems/target-guarding.md) | [`tests/fixture.html`](tests/fixture.html) |
| Popup UI & Progress | [`extension/popup.js`](extension/popup.js) | [`DESIGN.md`](DESIGN.md) | Popup inspection |
| Manifest & Permissions | [`extension/manifest.json`](extension/manifest.json) | [`docs/decisions/0001-browser-debugger-input.md`](docs/decisions/0001-browser-debugger-input.md) | [`scripts/check.mjs`](scripts/check.mjs) |

---

## 8. Hard Invariants ("Do Not Break")

1. **Explicit Destination Triggers Only**: Never start or resume typing automatically or on page load. Typing strictly requires an explicit keyboard command triggered while focused in the destination tab.
2. **Strict Queue Serialization**: All state transitions and character sends must pass through `TypingSession.prototype.enqueue`. Never introduce concurrent dispatches.
3. **No Retries on Uncertain Delivery**: If a CDP dispatch fails, immediately transition to `'error'`. Never retry a character, as retrying risks duplicating text at an unknown caret position.
4. **Synchronous Disarm on Interruption**: Target guard listeners must set `guard.armed = false` synchronously before sending IPC messages, immediately blocking the next scheduled character.
5. **No Automatic Replay on Browser Restart**: Service worker restoration restores *only* checkpoints whose phase is `'paused'`. Checkpoints interrupted while actively typing must transition to `'error'`.
6. **Local Draft Privacy**: Drafts stay strictly local in `chrome.storage.local` with `TRUSTED_CONTEXTS`. Never add telemetry, network sync, analytics, remote scripts, or broad host permissions (`<all_urls>`).
7. **Google Docs Release Boundary**: Do not advertise Google Docs support in store listings or marketing until a live acceptance test in a signed-in Chrome session passes. Code and verification win over claims.
8. **Pure Core Separation**: `extension/core.js` must remain 100% pure JavaScript with zero references to `window`, `document`, or `chrome.*`.
9. **Zero Runtime Dependencies**: Do not introduce third-party npm dependencies without an approved ADR.

---

## 9. Development & Verification Rules

- **Code Style**: Plain ESM JavaScript, native CSS variables, semantic HTML.
- **Text Preservation**: Never trim leading, trailing, or internal whitespace from user drafts. Normalize CRLF/CR to LF. Always segment with `Intl.Segmenter(..., { granularity: 'grapheme' })`.
- **Timer Receiver Rule**: In service worker contexts, always wrap `setTimeout`/`clearTimeout` in arrow functions `(cb, ms) => setTimeout(cb, ms)` to prevent `TypeError: Illegal invocation`.
- **Verification Commands**:
  - `npm test`: Runs the 18 unit tests (must pass 100%).
  - `npm run check`: Validates manifest, icon headers, syntax, and MV3 CSP.
  - `npm run dev`: Serves `tests/fixture.html` on `http://127.0.0.1:8765/`.
  - `npm run package`: Runs tests, checks, and validates production ZIP in `dist/`.

For complete details, see [`docs/conventions.md`](docs/conventions.md) and [`docs/development.md`](docs/development.md).

---

## 10. Knowledge Hierarchy & Source of Truth

When reasoning about this repository, adhere to this strict hierarchy:

```text
       Source Code (Implementation)
                     ▲
                     │ (Authoritative truth for actual runtime behavior)
                     │
          docs/ (Detailed Knowledge)
                     ▲
                     │ (Authoritative for architecture, systems, decisions, gotchas)
                     │
           agent.md (Router & Manual)
                       (Authoritative for agent workflow and navigation)
```

1. **Source Code is Authoritative**: If documentation describes behavior that disagrees with the source code, the code reflects reality. Investigate why, fix the code or update the documentation in the same commit.
2. **`agent.md` is the Navigation Layer**: Provides high-density orientation and links to deep knowledge in `docs/`.
3. **`docs/` is the Context Layer**: Explains why systems are designed the way they are, edge cases encountered, and architectural decisions.

---

## 11. Agent Memory & Maintenance Rules

Future AI agents must treat this repository as a living second brain:

1. **Read Before Changing**: Before touching a major subsystem, read the relevant file in `docs/systems/` or `docs/decisions/`.
2. **Verify Against Code**: Never guess file paths, exported symbols, or Chrome APIs. Verify directly against the codebase.
3. **Keep the Second Brain Current**: Update documentation in `docs/` whenever making meaningful architectural or behavioral changes:
   - Added/modified a feature $\rightarrow$ update `docs/systems/` or `docs/codebase-map.md`.
   - Found an unintuitive bug or browser edge case $\rightarrow$ document in `docs/troubleshooting.md` or `docs/known-issues.md`.
   - Made an architectural choice $\rightarrow$ append an ADR in `docs/decisions/`.
   - Meaningful work completed $\rightarrow$ append to `docs/changelog.md` and `docs/SESSION_LOG.md`.
4. **Don't Overdocument**: Do not document trivial variable renames, minor styling tweaks, or obvious one-line fixes.
5. **Never Invent Memory**: If an architectural origin or reason is unknown, explicitly state that it is unknown. Never invent fictional project history.

---

## 12. 10-Step AI Agent Workflow

When assigned a task in this repository, follow this workflow:

1. **Orient**: Read `agent.md` to understand scope, tech stack, and hard invariants.
2. **Identify Subsystem**: Locate the relevant subsystem in the [Repository Map](#4-repository-map) and [Critical Files](#7-critical-files-by-subsystem).
3. **Read Deep Docs**: Read the corresponding deep documentation in `docs/` (e.g., `docs/systems/typing-engine.md`).
4. **Inspect Source**: Read the actual implementation files; trace dependencies and caller/callee relationships.
5. **Formulate Minimal Plan**: Design the smallest, cleanest change that accomplishes the goal without violating invariants.
6. **Execute Change**: Implement the change in `autotype/` using standard ESM JavaScript.
7. **Verify Locally**:
   - Run `npm test` to ensure all 18 unit tests pass without regression.
   - Run `npm run check` to ensure manifest, CSP, and syntax checks pass.
   - Run `npm run package` if releasing or verifying archive integrity.
8. **Live Test**: If browser behavior changed, load unpacked in Chrome and verify using `http://127.0.0.1:8765/tests/fixture.html` (`npm run dev`).
9. **Update Second Brain**: Update relevant files in `docs/` (systems, decisions, codebase map, changelog).
10. **Report**: Provide a concise summary to the user detailing code changes, test results, and documentation updates.

