# Project Overview

> Read this document when orienting yourself to AutoType's product intent, release boundaries, user workflow, and privacy guarantees.

## Product Identity

AutoType is a free, account-free Chrome extension (Manifest V3) that enters a prepared plain-text passage into a web destination at the user's cursor with a natural typing rhythm averaging 75 WPM (words per minute).

It solves the problem of entering text into web applications where bulk pasting is either unsupported, disruptive, or undesirable, providing a simulated natural keyboard entry flow.

- **Working Name**: AutoType
- **Repository Location**: Confined to the `autotype/` folder within the parent workspace.
- **Current Version**: 0.1.0 (MVP completed, local packaging and test bench verified, store submission pending live Google Docs verification).

## Core User Workflow

1. User clicks the extension action icon to open the popup.
2. User pastes plain text into the passage textarea.
3. The draft is immediately validated and saved asynchronously to local extension storage (`chrome.storage.local`).
4. User closes the popup and clicks the destination editor (e.g. textarea, contenteditable, Google Docs canvas) to place the caret.
5. User presses the start shortcut (**Command+Shift+Y** on macOS, **Ctrl+Shift+Y** on Windows/Linux).
6. AutoType waits 300ms for keyboard modifier release, inspects and guards the active editor, attaches the Chrome Debugger (`chrome.debugger`), and streams graphemes into the editor one by one according to a randomized, punctuation-weighted 75 WPM schedule.
7. If the user clicks elsewhere, types on the keyboard, changes tabs, or navigates away, AutoType immediately disarms the guard and pauses typing.
8. Pressing the start shortcut again in the original editor resumes typing from the exact checkpoint.
9. Pressing the stop shortcut (**Command+Shift+X** / **Ctrl+Shift+X**) or clicking Stop in the popup halts typing and resets progress to the beginning.

## Product Boundaries and Non-Goals

- **Zero Cloud / Backend**: No user accounts, database, API keys, telemetry, analytics, cloud sync, or remote servers.
- **Zero Runtime Dependencies**: Plain ESM JavaScript, native HTML5/CSS, Node.js built-in test runner. No React, Vue, Webpack, Vite, or external libraries.
- **Local Data Only**: Draft text never leaves the browser. Text is only transmitted directly to the user-selected destination page as simulated keystrokes.
- **Explicit Triggers Only**: AutoType never starts typing automatically or on page load. It strictly requires an explicit keyboard command triggered while focused in the destination tab.
- **Accepted Trade-offs**: The extension requests the `debugger` permission, which causes Chrome to display a visible infobar ("AutoType started debugging this browser"). This is an accepted design trade-off to enable low-level CDP input dispatch into canvas-rendered editors like Google Docs.

## Supported vs. Unsupported Destinations

| Destination Type | Status | Technical Handling |
| --- | --- | --- |
| Standard `<textarea>` | Supported | `Input.dispatchKeyEvent` (ASCII) or `Input.insertText` (Unicode/tabs/newlines) |
| Standard `<input>` (text, search, email, url, tel) | Supported (single-line only) | Rejects multiline drafts; inserts plain text |
| Standard `contenteditable` | Supported | Direct CDP text dispatch; validated against DOM focus |
| Same-origin accessible `<iframe>` | Supported | Recursive frame descent up to 20 levels deep |
| Open `shadowRoot` elements | Supported | Traverses `element.shadowRoot.activeElement` |
| Google Docs (`docs.google.com/document/d/*`) | Implementation Target | Dedicated adapter targeting `docs-texteventtarget-iframe`; Enter key dispatched via CDP `Input.dispatchKeyEvent`. Verification pending live signed-in test. |
| Password fields (`input[type="password"]`) | Rejected | Blocked by target inspector |
| Disabled / Read-only fields | Rejected | Blocked by target inspector (`disabled`, `readOnly`, `aria-*`) |
| Inaccessible cross-origin `<iframe>` | Rejected | Blocked by target inspector with user-facing error |
| Browser internal pages (`chrome://*`, `chrome-extension://*`) | Rejected | Blocked prior to debugger attachment |
| Local files (`file:///*`) | Rejected | Blocked prior to debugger attachment |

