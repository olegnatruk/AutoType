# Coding Conventions & Development Rules

> Read this document when writing code, structuring new functions or classes, handling errors, or preparing changes for verification.

## Core Architectural Separation

1. **Pure Logic vs. Platform Driver**:
   - Pure domain logic, timing calculations, grapheme handling, and session state machines belong in [`extension/core.js`](../extension/core.js).
   - Chrome-specific API calls (`chrome.debugger`, `chrome.storage`, `chrome.scripting`, `chrome.tabs`, `chrome.commands`) belong strictly in [`extension/background.js`](../extension/background.js).
   - Never import `chrome.*` or reference the browser environment inside `core.js`. This allows `core.js` to be tested with 100% fidelity inside standard Node.js unit tests without browser mocks or polyfills.

2. **Self-Contained Isolated Injections**:
   - Functions injected into web pages via `chrome.scripting.executeScript` (such as `inspectTarget` in [`extension/target.js`](../extension/target.js)) must remain completely self-contained.
   - Do NOT import external modules, use top-level exports, or reference closures outside the function body.
   - Never expose draft content or user text to the destination page's DOM or JavaScript scope.

3. **Zero Runtime Dependencies Policy**:
   - AutoType intentionally ships zero third-party npm dependencies in runtime or build tooling.
   - Standard Web APIs (`Intl.Segmenter`, `AbortController`, `crypto.randomUUID()`) and Node.js built-in modules (`node:test`, `node:assert`, `node:fs`, `node:child_process`) must be used exclusively.
   - Any proposal to introduce an npm dependency requires a compelling justification and an approved Architectural Decision Record (ADR) in [`docs/decisions/`](decisions/).

---

## State Management & Concurrency Rules

1. **Serialized Operation Queue**:
   - Every state-changing operation on `TypingSession` (`toggle`, `activate`, `pause`, `stop`, `interrupt`, `disconnected`, and individual character sends) MUST pass through `this.enqueue(action)`.
   - Never trigger un-queued state changes or concurrent sends.
2. **Timers Live Outside the Queue**:
   - Sleep timers and delays (`wait(ms, signal)`) must be awaited outside the queue lock and linked to an `AbortSignal`.
   - Stopping or pausing the session aborts the sleep timer immediately, ensuring that Stop responds instantaneously without waiting for passage delays.
3. **No Retries on Uncertain Delivery**:
   - If a CDP input dispatch fails or an unhandled exception occurs during send, terminate immediately into the `'error'` phase.
   - Never retry sending a character after a failed or unacknowledged dispatch; retrying risks character duplication or desynchronization with the remote caret.
4. **Session Checkpoint Invariants**:
   - Persist checkpoints in `chrome.storage.session` ONLY for paused runs.
   - If the service worker wakes up from suspension and finds a checkpoint in any phase other than `'paused'` (e.g. interrupted while typing), it must transition to `'error'`. It must NEVER auto-resume.

---

## Text Handling & Unicode Standards

1. **Grapheme Cluster Segmentation**:
   - Always segment plain text using `Intl.Segmenter(undefined, { granularity: 'grapheme' })`.
   - Never use `.split('')` or indexing by code unit, which fragments multi-byte UTF-16 surrogate pairs, combining marks, accented letters, and emoji sequences (e.g., `👩🏽‍💻`, `e\u0301`).
2. **Whitespace and Line-Ending Preservation**:
   - Normalize CRLF (`\r\n`) and CR (`\r`) to LF (`\n`).
   - Never trim leading, trailing, or internal whitespace. User passages must be entered verbatim.
   - Size limit: drafts must be capped at 200,000 UTF-16 code units (enforced in `validateDraft` and `popup.html` `maxlength`).

---

## Error Handling & Security Conventions

1. **IPC Origin Validation**:
   - Background message listeners in `background.js` must verify the sender:
     - Extension popup requests: `sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html')`.
     - Target guard interruption: `sender.tab?.id && sender.id === chrome.runtime.id && message.token === session.token`.
   - Web pages and content scripts must never be permitted to read drafts or execute session commands.
2. **Target Eligibility Checks**:
   - The target inspector must reject:
     - Password fields (`type === 'password'`)
     - Disabled or read-only elements (`disabled`, `readOnly`, `aria-disabled="true"`, `aria-readonly="true"`)
     - Restricted URLs (`chrome://*`, `chrome-extension://*`, `file://*`)
     - Single-line `<input>` fields if the draft contains newlines (`\n`)
3. **Timer Receiver Wrappers**:
   - In service worker contexts, never pass raw global functions like `setTimeout` or `clearTimeout` as callbacks or method references, which triggers `TypeError: Illegal invocation`. Always wrap in an arrow function: `(cb, ms) => setTimeout(cb, ms)`.

---

## Verification & Documentation Loop

1. **Always Verify Code**:
   - Run `npm test` (executes 18 unit tests in `tests/core.test.js`).
   - Run `npm run check` (validates manifest, icons, syntax, CSP).
   - Run `npm run package` (builds and tests archive integrity).
   - If modifying browser-facing behavior, test unpacked extension in Chrome using the local fixture at `http://127.0.0.1:8765/tests/fixture.html` (`npm run dev`).
2. **Keep Second Brain Updated**:
   - If an architectural rule, entry point, storage key, or gotcha is modified, update the corresponding file in `docs/` in the same commit.
   - Code is the ultimate authority: if documentation conflicts with implementation, verify against the code and correct the documentation.
