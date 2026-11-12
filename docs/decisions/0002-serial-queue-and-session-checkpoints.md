# Decision: Serial acknowledgment and session-only pause restoration (ADR-002)

> Read this document when considering concurrency, retries, checkpoint persistence, or worker suspension handling.

## Context
Typing at a user's cursor involves asynchronous operations (timer waits, storage reads, CDP IPC dispatches, target guard checks) while user input (shortcuts, mouse clicks, tab switching) occurs non-deterministically. If characters are retried after an uncertain delivery failure, the remote editor may end up with duplicated text or a scrambled caret. Furthermore, in Manifest V3, background service workers suspend when idle or detached.

## Decision
1. **Single Action Queue**: Every state change and character dispatch must pass through a single, serialized Promise queue (`TypingSession.prototype.enqueue`).
2. **No Retries on Error**: Advance the character offset only upon explicit acknowledgment. If an error occurs during send, transition immediately to `'error'` phase without retrying.
3. **Session Checkpoints for Paused Runs Only**: Persist checkpoint data solely in `chrome.storage.session`, not `chrome.storage.local`.
4. **Crash / Restart Invariant**: On service worker wake-up, restore only checkpoints in `'paused'` state. If an active run was terminated by browser closure or a crash, mark it as `'error'` and require manual restart.

## Reasoning
1. **Preventing Caret Scrambling**: In cursor typing, delivery uncertainty cannot be resolved by blind retries. If character $N$ was received by the remote editor but the acknowledgment timed out, sending $N$ again causes duplicate characters. Stopping on failure is the safest failure mode.
2. **Worker Suspension Survival**: A paused worker has detached the debugger and may suspend. Storing the checkpoint in `chrome.storage.session` allows a woken worker to resume seamlessly when the user presses the shortcut again.
3. **Fresh Browser Invariant**: Browser restart wipes `chrome.storage.session`. AutoType will never mysteriously resume typing after a user restarts their computer or browser.
4. **Local Draft Decoupling**: The passage draft remains safely saved in `chrome.storage.local`, independent of session execution state.

## Alternatives
- **Automatic Retry with Exponential Backoff**: Rejected because cursor insertion is stateful and non-idempotent; retrying risks duplicating characters or typing into the wrong field.
- **Persisting Active Checkpoints in `localStorage`**: Rejected because an interrupted session might accidentally auto-resume upon browser restart into an arbitrary active tab.

## Consequences
- Clean separation of concerns between draft persistence (`storage.local`) and execution state (`storage.session`).
- Predictable and deterministic execution with zero race conditions.
- If a dispatch fails, the user must inspect the editor and initiate a new run.

