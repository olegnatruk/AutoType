# Session Lifecycle & State Machine

> Read this document when modifying session state transitions, command handling, pause/resume behavior, or checkpoint restoration.

## Session State Machine

A typing session in AutoType is governed by the `TypingSession` class in [`extension/core.js`](../../extension/core.js). It transitions through seven distinct phases:

```text
                  ┌──────────────────────┐
                  │         idle         │
                  └──────────┬───────────┘
                             │
                             │ toggle() [with valid draft & tab]
                             ▼
                  ┌──────────────────────┐
            ┌────►│       starting       │◄────┐
            │     └──────────┬───────────┘     │
            │                │                 │
            │                │ activate()      │ toggle()
            │                ▼                 │ [in original tab]
            │     ┌──────────────────────┐     │
            │     │        typing        │─────┘
            │     └──────────┬───────────┘
            │                │
            │   interruption │ focus loss / blur / toggle()
            │                ▼
            │     ┌──────────────────────┐
            └─────│        paused        │
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            │ stop()         │ index == total │ CDP failure / error
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │   stopped   │  │  completed  │  │    error    │
     └─────────────┘  └─────────────┘  └─────────────┘
```

### Phase Definitions

| Phase | Description | Toolbar Badge | Can Resume? | Checkpoint Saved? |
| --- | --- | --- | --- | --- |
| `idle` | Initial state; no run initiated. | None | N/A | No |
| `starting` | Target being inspected/armed; 300ms modifier delay running. | None | N/A | Yes |
| `typing` | Debugger attached; characters actively streaming at 75 WPM. | Green `ON` | N/A | Yes |
| `paused` | Temporarily halted due to focus change, navigation, or shortcut. | Green `Ⅱ` | Yes (in original tab) | Yes |
| `completed` | All graphemes successfully delivered to caret. | None | No (starts new run) | Cleared |
| `stopped` | Manually cancelled by user shortcut or popup button. | None | No (starts new run) | Cleared |
| `error` | CDP failure, disconnected debugger, or invalid target field. | Red `!` | No (requires new run)| Cleared |

---

## The Serialized Action Queue

To eliminate race conditions between user shortcuts, DOM event listeners, Chrome API callbacks, and character dispatches, `TypingSession` funnels every mutation through a Promise queue:

```javascript
enqueue(action) {
  const result = this.queue.then(action);
  this.queue = result.catch(() => {});
  return result;
}
```

### Why Timers Live Outside the Queue
Delays between characters (`this.sleep()`) are evaluated *before* entering `this.enqueue(...)`. This separation ensures that when a user presses Stop or clicks Pause, the abort signal fires immediately:
```javascript
this.abort = new AbortController();
// In pauseInternal or finish:
this.abort?.abort();
```
Because the sleep timer is canceled instantly, Stop and Pause execute within milliseconds, even if the scheduled character delay was long.

---

## Startup Coalescing & `CommandController`

When a user initiates typing via keyboard command (e.g. `Command+Shift+Y`), physical modifier keys (`Command`, `Shift`) remain depressed for tens or hundreds of milliseconds. If AutoType began typing immediately, the destination editor might interpret incoming characters as shortcut combinations (e.g., `Command+Shift+A`).

`CommandController` manages this coordination:
1. **300ms Modifier Release Delay**: Upon receiving `toggle-typing`, a 300ms timer is scheduled before triggering `session.toggle()`.
2. **Duplicate Coalescing**: If the user presses the shortcut repeatedly during this 300ms window, redundant events are ignored.
3. **Instant Cancellation**:
   - If the user presses `stop-typing` during the 300ms delay, startup is immediately cancelled and `session.stop()` is invoked.
   - If the active tab changes (`chrome.tabs.onActivated`), window blurs (`chrome.windows.onFocusChanged`), or page navigates (`chrome.tabs.onUpdated`), `commands.cancel()` immediately aborts the pending start.
4. **Double-Checked Cancellation**:
   Even after the 300ms timer fires, asynchronous reads (`this.saved()` to flush draft writes, `this.isActive()` to verify window focus) occur. Before invoking `session.toggle()`, the controller checks `this.pending !== pending` a second time to ensure no cancellation occurred during storage reads.

---

## Service Worker Checkpoint & Suspension Lifecycle

Under Manifest V3, Chrome service workers can be suspended when inactive:
- During active typing, the attached `chrome.debugger` session keeps the background service worker alive (guaranteed since Chrome 118).
- During a `paused` state, the debugger is detached to avoid unnecessary browser overhead and allow normal user interaction. As a result, the worker may suspend.

### Checkpoint Restoration Rules

1. **State Persistence**: Whenever the phase changes to `'paused'` (or during typing transitions), `TypingSession.prototype.checkpoint()` serializes the run into `chrome.storage.session`:
   ```javascript
   {
     state: { phase: 'paused', index: 32, total: 108, message: '...', tabId: 7 },
     characters: ['H', 'e', 'l', 'l', 'o', ...],
     schedule: [160, 155, 168, ...],
     token: 'uuid-guard-token',
     target: { kind: 'textarea' }
   }
   ```
2. **Safe Restoration**:
   When the service worker wakes up from suspension, `ready` reads the checkpoint:
   ```javascript
   session.restore(checkpoint);
   ```
3. **Hard Failure on Interrupted Active Runs**:
   If the checkpoint indicates `state.phase !== 'paused'` (for example, if the browser or worker crashed while in `'typing'` phase), AutoType marks the session as `'error'`:
   > *"A previous run was interrupted. Check the editor before starting a new run."*
   It **NEVER** automatically replays or continues typing into an unverified editor caret.
4. **Browser Restart Behavior**:
   `chrome.storage.session` is automatically cleared by Chrome when the browser restarts. Therefore, restarting the browser completely resets run progress while leaving the saved draft intact in `chrome.storage.local`.

