# Decision: Browser-level input and explicit debugger access (ADR-001)

> Read this document when considering alternative input dispatch mechanisms or evaluating Chrome permissions.

## Context
Google Docs uses canvas rendering rather than standard DOM `<textarea>` or `<input>` elements. Ordinary DOM value manipulation (`element.value = ...`), synthetic DOM dispatch (`element.dispatchEvent(new KeyboardEvent(...))`), and legacy `document.execCommand('insertText')` fail to type reliably into Google Docs, modern web frameworks, and complex rich-text editors. Furthermore, synthetic events are marked `isTrusted = false` by browsers and frequently ignored by web applications.

## Decision
Use Chrome's low-level Chrome DevTools Protocol (`chrome.debugger` API) with protocol version `1.3` to dispatch hardware-level input events (`Input.dispatchKeyEvent` and `Input.insertText`) across all supported destinations. Target validation is executed in Chrome's isolated world via `chrome.scripting.executeScript`.

## Reasoning
1. **Canvas Editor Compatibility**: Google Docs requires genuine keystrokes directed to its hidden event iframe (`docs-texteventtarget-iframe`). Only CDP delivers trusted input events capable of driving Google Docs canvas layout updates.
2. **Framework Compatibility**: Modern web apps (React, Vue, Web Components) intercept input at the event loop level. CDP events are indistinguishable from hardware keyboard inputs (`isTrusted = true`).
3. **Targeted Attachment**: Rather than requesting blanket broad host permissions (`<all_urls>`), the extension requests `debugger`, `activeTab`, and `scripting`. It attaches the debugger only during active typing and detaches immediately upon pause, stop, or completion.
4. **Service Worker Lifetime**: Since Chrome 118, an active `chrome.debugger` session prevents service worker suspension during long typing runs.

## Alternatives
- **Direct DOM Manipulation (`input.value = ...`)**: Fast and requires minimal permissions, but fails completely on Google Docs, contenteditable editors, and rich-text web applications.
- **Synthetic Keyboard Events (`dispatchEvent`)**: Untrusted (`isTrusted = false`), rejected by modern security checks and complex frameworks.
- **`document.execCommand('insertText')`**: Deprecated, non-standard, inconsistent across browsers, and does not work on canvas editors.

## Consequences
- Requires the powerful `debugger` permission in `manifest.json`.
- Chrome displays a visible infobar ("AutoType started debugging this browser") during active typing. This visible indicator is explicitly accepted as an intentional product trade-off.
- Restricts extension functionality to Google Chrome (version 118+).
- Google Docs support remains subject to strict verification gates.

