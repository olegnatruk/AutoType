# Codebase Map

> Read this document when locating specific files, understanding module responsibilities, or checking caller/callee relationships before modifying code.

## Repository Directory Layout

```text
autotype/
├── extension/             # Chrome Extension (Manifest V3) runtime code
│   ├── manifest.json      # Extension manifest (MV3 declarations, permissions, commands)
│   ├── background.js      # Background service worker; owns Chrome APIs, driver, lifecycle
│   ├── core.js            # Pure business logic; session state machine, pacing, segmentation
│   ├── target.js          # Self-contained DOM target inspector serialized into web pages
│   ├── popup.html         # Extension popup HTML interface
│   ├── popup.css          # Styling for popup; defines tokens and layout
│   ├── popup.js           # Popup UI logic, user input handling, progress rendering
│   └── icons/             # Extension icons (16px, 32px, 48px, 128px)
├── tests/                 # Test suite and disposable browser fixtures
│   ├── core.test.js       # Node.js native unit & concurrency test suite
│   ├── fixture.html       # Browser test fixture with various editable fields
│   └── frame.html         # Nested iframe fixture for frame traversal tests
├── scripts/               # Build, packaging, verification, and developer tools
│   ├── check.mjs          # Static verification of manifest, syntax, icons, and CSP rules
│   ├── package.mjs        # Builds production ZIP in dist/ and validates archive
│   ├── serve.mjs          # Zero-dependency local dev server (127.0.0.1:8765)
│   └── icons.mjs          # Generates pure geometric PNG icons without dependencies
├── store/                 # Chrome Web Store release assets and copy
│   ├── README.md          # Release instructions and verification gates
│   ├── LISTING.md         # Store listing metadata, descriptions, permission rationale
│   ├── privacy.html       # Standalone HTML privacy policy for hosting
│   ├── screenshot.html    # Layout tool to generate compliant store screenshots
│   └── screenshots/       # 1280x800 store promo screenshots
├── docs/                  # Persistent Second Brain documentation
│   ├── project-overview.md
│   ├── architecture.md
│   ├── codebase-map.md
│   ├── conventions.md
│   ├── development.md
│   ├── systems/
│   │   ├── typing-engine.md
│   │   ├── session-lifecycle.md
│   │   ├── target-guarding.md
│   │   └── storage-and-ipc.md
│   ├── decisions/
│   │   ├── index.md
│   │   ├── 0001-browser-debugger-input.md
│   │   ├── 0002-serial-queue-and-session-checkpoints.md
│   │   └── 0003-zero-runtime-dependencies.md
│   ├── troubleshooting.md
│   ├── known-issues.md
│   └── changelog.md
├── agent.md               # AI Agent operating manual and knowledge router
├── AGENTS.md              # Compact repo router (<100 lines)
├── PROJECT-BRIEF.md       # Product requirements and release boundaries
├── PRODUCT.md             # Platform and tech stack constraints
├── DESIGN.md              # Visual design tokens and UI specification
├── README.md              # User installation and quick-start guide
└── package.json           # Node configuration and project npm scripts
```

---

## Detailed File Directory & Critical Files

### Runtime Extension (`extension/`)

#### `extension/manifest.json`
- **Purpose**: Defines the Chrome Extension configuration under Manifest V3.
- **Used by**: Chrome browser extension loader.
- **Key Declarations**:
  - `manifest_version`: `3`
  - `minimum_chrome_version`: `"118"` (required for debugger-driven service worker persistence).
  - `permissions`: `["debugger", "storage", "activeTab", "scripting"]`.
  - `background`: `{ "service_worker": "background.js", "type": "module" }`.
  - `action`: `{ "default_popup": "popup.html", "default_title": "AutoType" }`.
  - `commands`: `toggle-typing` (`Command+Shift+Y` / `Ctrl+Shift+Y`), `stop-typing` (`Command+Shift+X` / `Ctrl+Shift+X`).
- **Careful About**:
  - Do NOT declare `host_permissions` or `content_scripts`. The extension intentionally requests only targeted tabs via `activeTab`/`scripting`.
  - Keep `type: "module"` enabled for the background service worker.

#### `extension/core.js`
- **Purpose**: Pure, environment-agnostic domain logic. Contains text segmentation, schedule generation, session state machine, speed clamping, and command orchestration.
- **Used by**: `extension/background.js`, `tests/core.test.js`, `extension/popup.js`.
- **Exported Symbols**:
  - Constants: `DEFAULT_WPM` (75), `MIN_WPM` (20), `MAX_WPM` (200), `WPM_STEP` (5), `WPM` (75), `CHARACTER_MS` (160ms), `MAX_DRAFT_LENGTH` (200,000).
  - Functions: `clampWpm(wpm)`, `characterMs(wpm)`, `segmentText(text)`, `createSchedule(characters, random, wpm)`, `estimateDuration(text, wpm)`, `validateDraft(text)`, `wait(ms, signal)`.
  - Classes: `CommandController`, `TypingSession`.
- **Important Behavior**:
  - `clampWpm`: Restricts WPM to 20-200 and rounds to increments of 5 WPM.
  - `segmentText`: Normalizes `\r\n` and `\r` to `\n`, uses `Intl.Segmenter` with `granularity: 'grapheme'`.
  - `createSchedule`: Assigns punctuation weights (`2.1` for `[.!?\n]`, `1.5` for `[,;:]`, `1.0` otherwise) with random jitter `(0.75 + random() * 0.5)` normalized to match target total time at specified WPM.
  - `TypingSession`: Serializes all mutations through `this.queue = Promise.resolve()`. Implements `setWpm(wpm)` which rescales the active schedule dynamically. Implements `snapshot()`, `checkpoint()`, `restore()`, `toggle()`, `activate()`, `run()`, `pause()`, `interrupt()`, `stop()`, `disconnected()`.
  - `CommandController`: Delays `toggle-typing` by 300ms to allow physical modifier keys to be released before typing; allows instant cancellation by `stop-typing` or blur.
- **Careful About**:
  - Must remain strictly pure JavaScript: NO direct references to `window`, `document`, or `chrome.*` APIs.
  - Timers in `TypingSession.run` must be abortable via `AbortController`.
  - If a send fails in `run`, do NOT retry; immediately transition to `error`.

#### `extension/background.js`
- **Purpose**: Background service worker. Bridges pure logic in `core.js` with Chrome APIs (`chrome.debugger`, `chrome.storage`, `chrome.scripting`, `chrome.tabs`, `chrome.commands`, `chrome.windows`, `chrome.action`).
- **Used by**: Chrome runtime on browser lifecycle events.
- **Important Behavior**:
  - Restricts `chrome.storage.local` access to `TRUSTED_CONTEXTS`.
  - Injects `inspectTarget` from `target.js` into active tab via `chrome.scripting.executeScript`.
  - Bridges CDP commands (`Input.dispatchKeyEvent`, `Input.insertText`) via `driver.send`.
  - Manages badge text (`ON`, `Ⅱ`, `!`, `""`) and badge color.
  - Handles runtime messaging with security check (only exact `popup.html` URL and extension ID can issue commands).
  - Listens to window/tab changes to trigger auto-pause on focus loss.
- **Careful About**:
  - Service worker timer receiver gotcha: global `setTimeout` and `clearTimeout` must not be invoked with an unbound receiver (`Illegal invocation`).
  - Debugger detachment: `session.attached` guard flag ensures our own intentional detach doesn't trigger `disconnected()` error handler.

#### `extension/target.js`
- **Purpose**: Self-contained function `inspectTarget({ action, token, multiline })` serialized into the target page's isolated world.
- **Used by**: `background.js` via `chrome.scripting.executeScript`.
- **Important Behavior**:
  - Recurses up to 20 levels into nested iframes (`docs-texteventtarget-iframe`) and shadow roots (`shadowRoot.activeElement`).
  - Classifies destination: `'docs'`, `'textarea'`, `'input'`, `'editable'`.
  - Installs DOM event listeners on `pointerdown`, `focusin`, `keydown`, `visibilitychange`, `blur`.
  - When interrupted, immediately sets `guard.armed = false` synchronously (preventing the next character from typing) and posts `TARGET_INTERRUPTED` to runtime.
- **Careful About**:
  - This function is stringified and serialized by Chrome! It CANNOT import external modules or reference variables outside its lexical closure.
  - Global guard lives on `window.__autotypeGuardV1`.

#### `extension/popup.html`, `popup.css`, `popup.js`
- **Purpose**: User interface for pasting passages, viewing character counts, monitoring progress, stopping runs, and accessing shortcut settings.
- **Used by**: User clicking the toolbar extension action.
- **Important Behavior**:
  - Real-time grapheme count and duration estimate.
  - Input event immediately pushes draft to background via `SAVE_DRAFT`.
  - Listens to `SESSION_STATE` broadcasts and `chrome.storage.onChanged` to stay synced.
  - Flat paper design matching `DESIGN.md`.
- **Careful About**:
  - Popup window can close at any millisecond; all critical state must be stored in service worker or Chrome storage immediately.
  - No inline scripts allowed (MV3 CSP compliance).

---

### Test Suite & Fixtures (`tests/`)

#### `tests/core.test.js`
- **Purpose**: Comprehensive unit and concurrency test suite run via Node.js native test runner (`node --test`).
- **Coverage**: 18 tests covering Unicode segmentation, schedule calculations, draft size capping, abortable timers, queue serialization, pause/resume behavior, stale token rejection, dispatch failures, startup coalescing, and storage race cancellation.
- **Careful About**:
  - Keep tests fast and mock drivers carefully with Promise queues.

#### `tests/fixture.html` & `tests/frame.html`
- **Purpose**: Disposable browser test page providing `<textarea>`, single-line `<input>`, `contenteditable` divs, password fields, disabled fields, and accessible/nested iframes for manual and automated verification.

---

### Automation Scripts (`scripts/`)

#### `scripts/check.mjs`
- **Purpose**: Fast pre-flight check script (`npm run check`).
- **Verifies**: Manifest MV3 validity, minimum Chrome version (118), permissions allowlist, icon file dimensions (16/32/48/128), JS syntax across all files (`node --check`), and CSP external script compliance.

#### `scripts/package.mjs`
- **Purpose**: Production release packager (`npm run package`).
- **Verifies**: Runs `check.mjs`, runs `core.test.js`, packages only allowlisted runtime files into `dist/autotype-0.1.0.zip`, and tests ZIP integrity with `unzip -t`.

#### `scripts/serve.mjs`
- **Purpose**: Local zero-dependency dev server (`npm run dev`).
- **Binds**: Strictly to loopback `http://127.0.0.1:8765/`. Serves fixture pages.

#### `scripts/icons.mjs`
- **Purpose**: Self-contained script using Node `zlib` to generate geometric PNG icons for AutoType without external image libraries.

