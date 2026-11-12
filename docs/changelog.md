# Project Changelog & Agent Memory Log

> Read this document to understand the chronological evolution of features, bug fixes, and architectural milestones.

## 2026-11-07

### Added
- **Configurable Typing Speed (WPM)**:
  - Added user-adjustable typing speed control in the popup header with decrease (`-`) and increase (`+`) buttons.
  - Supported speed range: **20 WPM to 200 WPM** in steps of 5 WPM (defaults to 75 WPM).
  - Persisted user's chosen WPM preference in `chrome.storage.local` under key `'wpm'`.
  - Added `clampWpm(wpm)` and `characterMs(wpm)` helper functions in `extension/core.js`.
  - Added dynamic schedule rescaling via `TypingSession.prototype.setWpm(wpm)` to seamlessly adjust pace during active/paused sessions.
  - Added real-time passage duration estimate updates in the popup based on selected WPM.
  - Added unit test suite in `tests/core.test.js` covering WPM clamping, custom pacing schedules, dynamic speed adjustment, and checkpoint persistence.

---

## 2026-11-06

### Added
- **Second Brain Knowledge System**:
  - Created `agent.md` as the primary operating manual and persistent entry point for AI software engineers.
  - Added structured system documentation in `docs/`:
    - `docs/project-overview.md`: Product identity, workflow, and release boundaries.
    - `docs/architecture.md`: Multi-context MV3 Chrome extension architecture, data flow, concurrency model.
    - `docs/codebase-map.md`: File-by-file directory map, exports, callers, and critical behaviors.
    - `docs/conventions.md`: Pure vs driver separation, grapheme segmentation, error handling conventions.
    - `docs/development.md`: Developer guide for Node 22+, tests, checks, local fixture, and unpacked extension debugging.
    - `docs/systems/typing-engine.md`: Mathematical pacing model, dynamic overhead compensation, CDP input transport.
    - `docs/systems/session-lifecycle.md`: State machine, serialization queue, `CommandController`, session checkpointing.
    - `docs/systems/target-guarding.md`: Isolated-world DOM inspection, shadow/iframe traversal, synchronous disarm.
    - `docs/systems/storage-and-ipc.md`: Storage models (`chrome.storage.local`, `chrome.storage.session`), IPC protocol, badge mapping.
    - `docs/decisions/`: Structured ADRs for ADR-001 (Debugger Input), ADR-002 (Serial Queue & Checkpoints), and ADR-003 (Zero Dependencies).
    - `docs/troubleshooting.md`: Diagnostic matrix, common pitfalls, and resolution procedures.
    - `docs/known-issues.md`: Live release gates, Google Docs status, and DOM edge cases.

---

## 2026-10-05

### Added
- **Core Engine & Pacing**:
  - Implemented 75 WPM typing engine with natural punctuation weighting and random jitter (`extension/core.js`).
  - Added Unicode grapheme cluster segmentation with `Intl.Segmenter` and CRLF normalization.
  - Created `TypingSession` state machine with serialized Promise action queue.
  - Implemented `CommandController` with 300ms modifier release delay, coalescing, and async cancellation.
- **Service Worker & CDP Driver**:
  - Implemented `extension/background.js` using `chrome.debugger` (CDP 1.3).
  - Added character-specific dispatch: `Input.dispatchKeyEvent` for printable ASCII and Google Docs `Enter`, `Input.insertText` for Unicode, tabs, and multiline newlines.
  - Added `chrome.storage.local` draft persistence with `TRUSTED_CONTEXTS` access level.
  - Added `chrome.storage.session` checkpointing for worker suspension resilience.
- **Target Inspector & Guard**:
  - Implemented `extension/target.js` with deep traversal for iframes, shadow roots, and Google Docs event iframe.
  - Added capture-phase interruption listeners for clicks, keyboard navigation, tab switching, and blur.
- **Popup Interface**:
  - Built compact "Quiet Writing Slip" popup in `extension/popup.html`, `popup.css`, `popup.js`.
  - Added live grapheme count, estimated duration, real-time progress bar, and badge feedback.
- **Testing & Packaging**:
  - Created 18-test unit and concurrency suite in `tests/core.test.js`.
  - Built zero-dependency check script (`scripts/check.mjs`) and packager (`scripts/package.mjs`).
  - Built zero-dependency dev server (`scripts/serve.mjs`) and geometric icon generator (`scripts/icons.mjs`).
  - Created store release assets, listing copy, privacy policy, and screenshots in `store/`.

### Fixed
- **Service Worker Timer Receiver Bug**: Fixed `TypeError: Illegal invocation` by wrapping global `setTimeout`/`clearTimeout` calls in arrow functions.
- **Progress Width Animation Warning**: Removed CSS transition on progress bar to eliminate visual lag and preserve instant updates.
- **Footer Clarity**: Updated popup footer to accurately state: *"Draft stays on this device"*.

