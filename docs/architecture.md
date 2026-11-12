# System Architecture

> Read this document when modifying execution contexts, IPC message routing, typing concurrency, debugger attachment, or state persistence.

## Architectural Overview

AutoType is built as a Manifest V3 Chrome Extension operating across three distinct runtime execution contexts, connected through Chrome APIs and an internal messaging protocol:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          Chrome Browser                                │
│                                                                        │
│  ┌────────────────────────┐              ┌──────────────────────────┐  │
│  │     Popup Context      │              │  Service Worker Context  │  │
│  │   extension/popup.js   │              │ extension/background.js  │  │
│  │   extension/popup.html │              │   extension/core.js      │  │
│  └───────────┬────────────┘              └─────────────┬────────────┘  │
│              │                                         │               │
│              │ runtime.sendMessage                     │               │
│              │ (GET_STATE, SAVE_DRAFT, STOP...)        │               │
│              ▼                                         │               │
│  ┌───────────────────────────────────────────────┐     │               │
│  │          chrome.storage.local (draft)         │◄────┤               │
│  │        chrome.storage.session (checkpoint)    │◄────┤               │
│  └───────────────────────────────────────────────┘     │               │
│                                                        │               │
│                                                        │               │
│              ┌─────────────────────────────────────────┴────────────┐  │
│              │                                                      │  │
│              │ chrome.scripting.executeScript                       │  │
│              │ (dynamic function serialization)                     │  │
│              ▼                                                      │  │
│  ┌───────────────────────────────┐                                  │  │
│  │     Page Isolated World       │                                  │  │
│  │      extension/target.js      │                                  │  │
│  │     (__autotypeGuardV1)       │                                  │  │
│  └───────────────┬───────────────┘                                  │  │
│                  │                                                  │  │
│                  │ TARGET_INTERRUPTED                               │  │
│                  ▼                                                  │  │
│  ┌───────────────────────────────┐                                  │  │
│  │    Target Event Listeners     │                                  │  │
│  │  (pointerdown, keydown,       │                                  │  │
│  │   focusin, blur, visibility)  │                                  │  │
│  └───────────────────────────────┘                                  │  │
│                                                                     │  │
│              ┌──────────────────────────────────────────────────────┘  │
│              │ chrome.debugger.sendCommand                             │
│              │ (Input.dispatchKeyEvent / Input.insertText)             │
│              ▼                                                         │
│  ┌───────────────────────────────┐                                     │
│  │      Web Destination DOM      │                                     │
│  │   (<textarea>, <input>, Docs) │                                     │
│  └───────────────────────────────┘                                     │
└────────────────────────────────────────────────────────────────────────┘
```

## Runtime Contexts

### 1. Service Worker Context (`extension/background.js` + `extension/core.js`)
- **Lifecycle**: Ephemeral in Manifest V3. Kept alive during active typing by an attached `chrome.debugger` session (Chrome 118+ guarantee). May suspend when idle or paused.
- **Responsibilities**:
  - Central coordinator for storage, commands, and target state.
  - Owns instances of `TypingSession` and `CommandController`.
  - Attaches/detaches `chrome.debugger` to the active tab.
  - Controls serial execution queue and abort timers.
  - Restores paused checkpoints from `chrome.storage.session`.
  - Dispatches low-level CDP input commands.

### 2. Extension Popup Context (`extension/popup.js` + `extension/popup.html` + `extension/popup.css`)
- **Lifecycle**: Transient. Destroyed as soon as the user clicks away or closes the popup window.
- **Responsibilities**:
  - UI for drafting, character count, estimated duration, and real-time typing progress.
  - Captures text input and immediately initiates asynchronous writes to `chrome.storage.local` via `SAVE_DRAFT`.
  - Listens for `SESSION_STATE` broadcasts from the service worker to update progress bars and state badges.
  - Exposes manual "Stop" and "Clear passage" controls.
  - Opening the popup automatically triggers a focus change that pauses any active typing run.

### 3. Page Isolated World Context (`extension/target.js`)
- **Lifecycle**: Injected dynamically on demand via `chrome.scripting.executeScript`. Runs in Chrome's isolated world for the active tab (has DOM access, but separate JS context from the page's scripts).
- **Responsibilities**:
  - `inspectTarget({ action, token, multiline })`: inspects active elements, recursing through `<iframe>` elements and `shadowRoot` trees.
  - Validates editor eligibility (rejects passwords, disabled, read-only, or invalid targets).
  - Installs DOM event listeners on `pointerdown`, `focusin`, `keydown`, `visibilitychange`, and `blur`.
  - Manages `window.__autotypeGuardV1` state.
  - Upon any interruption, immediately disarms (`armed = false`) synchronously to block incoming characters, then dispatches `TARGET_INTERRUPTED` message to the background service worker.

### 4. Chrome DevTools Protocol (CDP) Input Layer
- **API**: `chrome.debugger` with target domain `Input`.
- **Responsibilities**:
  - Bypasses DOM mutation and synthetic JavaScript event restrictions by injecting hardware-level browser input events.
  - Dispatches `Input.dispatchKeyEvent` for printable ASCII chars and Google Docs `Enter` key.
  - Dispatches `Input.insertText` for Unicode graphemes, literal tabs, and standard textarea line breaks.

---

## Data Flow & State Progression

### A. Draft Persistence
1. User types or pastes into `#draft` in `popup.html`.
2. `popup.js` immediately increments `revision` and sends `{ type: 'SAVE_DRAFT', text }` to `background.js`.
3. `background.js` verifies sender identity (`sender.url === chrome.runtime.getURL('popup.html')`), validates length (`validateDraft(text)`), and chains the write onto `saveQueue`.
4. Text is persisted in `chrome.storage.local` under key `'draft'`.
5. `saveQueue` guarantees writes are serialized even if the popup closes immediately before completion.

### B. Session Initiation & Typing Loop
1. User focuses the destination editor on an HTTP/HTTPS webpage.
2. User presses the keyboard shortcut (`Command+Shift+Y` or `Ctrl+Shift+Y`).
3. `chrome.commands.onCommand` invokes `CommandController.handle('toggle-typing', tab)`.
4. `CommandController` waits 300ms to allow physical modifier keys to be released, coalescing duplicate keystrokes.
5. If cancelled by Stop, focus change, or navigation during this delay, startup aborts.
6. `TypingSession.toggle(tab)` acquires the queue lock:
   - Validates draft text from storage.
   - Segments draft into graphemes via `Intl.Segmenter`.
   - Generates normalized 75 WPM schedule via `createSchedule()`.
   - Generates a cryptographically random UUID `token`.
   - Injects `target.js` with action `'capture'` via `chrome.scripting.executeScript`.
   - Attaches `chrome.debugger` (`1.3`).
   - Injects `target.js` with action `'arm'` to arm the focus guard.
   - Transitions phase to `'typing'` and spawns `run(version)`.
7. `run(version)` loop:
   - Calculates sleep duration from schedule, subtracting measured overhead from previous iteration: `Math.max(40, schedule[index] - overhead)`.
   - Awaits `sleep()` with `AbortSignal`.
   - Enqueues character dispatch onto `TypingSession.enqueue()`:
     - Verifies tab is still active and window focused (`driver.isActive`).
     - Injects `target.js` with action `'check'` to verify original element is still focused and connected.
     - Dispatches character via `driver.send()` using CDP.
     - Increments `state.index` and broadcasts `SESSION_STATE`.
     - When `index === total`, transitions to `'completed'`, detaches debugger, and disarms guard.

### C. Interruption, Pause, and Resumption
1. **Interruption**:
   - If user clicks mouse, presses navigation key, blurs window, or switches tabs:
   - Target guard listener sets `guard.armed = false` synchronously.
   - Target guard posts `{ type: 'TARGET_INTERRUPTED', token, reason }`.
   - Concurrently, window/tab lifecycle listeners in `background.js` fire (`tabs.onActivated`, `windows.onFocusChanged`).
   - `TypingSession.pauseInternal()` increments `version`, aborts sleep timer, sets phase to `'paused'`, disarms target guard, and detaches debugger.
   - Saves checkpoint `{ state, characters, schedule, token, target }` to `chrome.storage.session`.
2. **Resumption**:
   - User returns to the original tab and editor, and presses the start shortcut.
   - `TypingSession.toggle()` detects phase `'paused'`.
   - Validates that active tab ID matches `state.tabId`.
   - Re-attaches debugger, re-arms guard via `driver.arm()`, increments `version`, and resumes `run(version)` from current `state.index`.

### D. Stop & Reset
1. Triggered via `stop-typing` shortcut (`Command+Shift+X`) or popup "Stop" button.
2. `CommandController.cancel()` drops any pending startup timer.
3. `TypingSession.stop()` sets phase to `'stopped'`, resets `index` and `total` to 0, cancels abort controller, disarms guard, detaches debugger, and clears session checkpoint from `chrome.storage.session`.

---

## Concurrency & Serialization Guarantees

1. **Single Execution Queue**: All state transitions (`toggle`, `activate`, `pause`, `stop`, `interrupt`, `disconnected`) and individual character dispatches pass through `TypingSession.prototype.enqueue(action)`. This ensures no two actions run concurrently.
2. **Independent Sleep Timers**: `sleep()` delays run outside the serialized queue. When `stop()` or `pause()` is invoked, `abort.abort()` cancels the sleep timer immediately; the session does not wait for a full character delay to finish.
3. **No Retries on Dispatch Failure**: If a CDP dispatch fails, the session immediately terminates into the `'error'` phase. Because input delivery is uncertain, retrying could produce duplicate characters at an unknown caret position.
4. **Strict Checkpoint Hygiene**: `chrome.storage.session` holds checkpoints solely for paused sessions. If the service worker restarts and reads a checkpoint that is NOT in `'paused'` phase (e.g. aborted mid-flight by crash), it converts to an error state. It NEVER automatically replays or continues typing into an unverified editor.

