# Troubleshooting & Diagnostic Guide

> Read this document when diagnosing unexpected runtime behavior, browser errors, debugger disconnections, or test suite failures.

## Diagnostic Matrix

| Symptom | Probable Cause | Diagnostic & Resolution |
| --- | --- | --- |
| `TypeError: Illegal invocation` on timer calls | Service worker timer called with non-global receiver | Ensure all `setTimeout`/`clearTimeout` calls in service workers are wrapped in arrow functions: `(cb, ms) => setTimeout(cb, ms)`. Never pass raw `setTimeout` as a method reference. |
| Modified worker code not loading in Chrome | Chrome bytecode cache retaining old service worker | In `chrome://extensions/`, click the refresh (⟳) icon on the AutoType card. For automated test profiles, delete the profile cache or use a fresh temporary profile. |
| Extension disappears during testing | Calling `chrome.runtime.reload()` in flag-loaded Chrome sessions | Do not programmatically call `runtime.reload()` in headless/flag-loaded sessions. Restart the test browser process instead. |
| Keyboard shortcut does nothing | Shortcut conflict with another extension | Open `chrome://extensions/shortcuts`. Verify that `Command+Shift+Y` and `Command+Shift+X` are assigned to AutoType. The popup displays "Not assigned" if unbound. |
| Typing immediately pauses with "Focus changed" | User clicked into popup or window lost focus | Closing the popup pauses typing by design. Ensure the popup is closed, the destination tab is active, and the window has focus before pressing the shortcut. |
| Error: "Cannot inspect the selected editor" | Tab is a restricted browser URL | AutoType cannot attach to `chrome://*`, `chrome-extension://*`, or `file://*` URLs. Test only on `http://` or `https://` web pages. |
| Error: "Password fields are unsupported" | Caret is inside `<input type="password">` | Intended security behavior. AutoType explicitly rejects password inputs. |
| Error: "This passage contains line breaks..." | Multiline draft placed into single-line `<input>` | AutoType will not enter newlines into single-line inputs to avoid submitting forms or truncating text. Use a `<textarea>` or multiline contenteditable field. |
| Disconnect error during intentional pause | Own debugger detach event being treated as crash | In `background.js`, `chrome.debugger.onDetach` checks `session.attached` before calling `disconnected()`. Since `session.attached` is set to `false` *before* calling `driver.detach()`, self-detachment is safely ignored. |
| "AutoType did not respond" in popup | Message sender validation failure | In `background.js`, requests are verified against `sender.url === chrome.runtime.getURL('popup.html')`. If opened under an unexpected URL, verify extension ID matches `chrome.runtime.id`. |

---

## In-Depth Diagnostic Scenarios

### 1. Diagnosing Service Worker Suspension & Checkpoints
- **How to test**: Open `chrome://extensions/`, find AutoType, and note if the service worker says "service worker (Inactive)".
- **Inspection**:
  1. Click "service worker" to open DevTools.
  2. In the console, inspect stored draft:
     ```javascript
     chrome.storage.local.get('draft').then(console.log);
     ```
  3. Inspect active session checkpoint:
     ```javascript
     chrome.storage.session.get('checkpoint').then(console.log);
     ```
  4. If `checkpoint` exists while no typing run is active, verify whether `state.phase` is `'paused'`. If not, `restore()` will safely transition to `'error'`.

### 2. Inspecting the Isolated World Target Guard
- If typing fails to start on a specific website:
  1. Open Chrome DevTools on the target webpage (`F12`).
  2. Open the **Console** tab.
  3. In the context selector dropdown (defaults to `top`), look for the **AutoType** extension context.
  4. Inspect the guard object:
     ```javascript
     window.__autotypeGuardV1
     ```
  5. Check `window.__autotypeGuardV1.armed` and inspect `window.__autotypeGuardV1.element`. Ensure `element.isConnected` is `true`.

### 3. Debugger Infobar & Detach Handling
- Chrome automatically displays an infobar: *"AutoType started debugging this browser"*.
- If the user clicks the "Cancel" button on this infobar, Chrome immediately detaches the debugger and fires `chrome.debugger.onDetach`.
- AutoType catches this event and immediately transitions the session into `'error'` phase with:
  > *"Chrome disconnected the typing session. Check the last character before starting again."*
- AutoType does NOT attempt to reattach automatically when the user explicitly cancelled debugging.

