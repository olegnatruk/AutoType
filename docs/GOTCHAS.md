# Gotchas

Group new entries by subsystem; describe the observed symptom, cause, and recovery.

## Extension lifecycle

- Service-worker timers reject a non-global receiver with `Illegal invocation`. Passing raw `setTimeout` as a controller method worked in Node but prevented Chrome startup; timer adapters call the global functions through wrappers. Verify startup in the packaged browser build, not only the unit runner.
- A paused worker has no debugger attachment to keep it alive. Session-only checkpoints preserve pause position; local storage holds only the saved draft. See [ADR-002](DECISIONS.md#adr-002--serial-acknowledgment-and-session-only-pause-restoration).
- `chrome.runtime.reload()` in the flag-loaded Chrome for Testing session removed the extension until the test browser relaunched. After source edits, restart that isolated session or use Reload on a normally loaded unpacked extension.
- The reused flag-loaded test profile retained older imported worker code after a restart at the same extension path. A fresh isolated profile loaded the corrected package; use a fresh profile for final archive acceptance.
- Chrome can leave suggested shortcuts unassigned when another extension claims them. The popup shows actual `chrome.commands.getAll()` values; use its shortcut-settings link.

## Popup

- A popup opened as an extension tab can have `sender.tab`. Restrict requests by the exact extension popup URL and extension ID rather than rejecting all tab senders; otherwise the standalone UI reports no response.
- Closing a popup destroys its JavaScript. Draft writes are sent immediately and serialized in the worker; wait for Saved before starting a run.

## Editors

- Enter can submit a web form. Ordinary multiline fields use text insertion for line breaks; only the Docs adapter sends an Enter key. Literal tabs use text insertion, never focus-navigation Tab.
- Website formatting or input handlers can transform text after the browser inserts it. Browser acknowledgment is not proof of destination content. Compare actual editor text during compatibility tests.
- A contenteditable blank paragraph can add an extra newline to DOM `innerText` under `white-space: pre-wrap`. Compare the actual selected plain text as well: in the tested fixture, selection text matched the two supplied line breaks while `innerText` reported three.
- Google Docs' canvas editor and hidden text-event iframe require a live test. Do not advertise unverified compatibility; results live in [VERIFICATION.md](VERIFICATION.md).
