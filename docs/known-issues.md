# Known Issues & Release Gates

> Read this document when evaluating compatibility claims, assessing release readiness, or investigating edge-case editor behaviors.

## Release Gates & Verification Status

### 1. Google Docs Compatibility Gate (Pending Live Test)
- **Status**: Implemented as target adapter; live release gate **PENDING**.
- **Context**: Google Docs uses an HTML5 canvas renderer and intercepts typing via a hidden iframe (`docs-texteventtarget-iframe`). AutoType contains specialized handling for Docs (detecting the iframe and sending physical `Enter` key events via CDP).
- **Rule**: **Do NOT advertise Google Docs support in store listings or user documentation until a live test in a signed-in Chrome session passes.**
- **Testing Protocol**:
  1. Open a new disposable document on `docs.google.com`.
  2. Paste a passage containing plain text, accented characters, emojis, line breaks, and literal tabs into AutoType.
  3. Start typing; verify gradual entry, pause, resume, and stop.
  4. Compare the actual document contents character by character. An acknowledged CDP input command alone is insufficient proof of correct rendering.

### 2. Platform Shortcut Checks
- **Current Evidence**: Automated and live verification passed on **macOS** (`Command+Shift+Y` and `Command+Shift+X`).
- **Pending Gate**: Windows and Linux shortcut behavior (`Ctrl+Shift+Y` and `Ctrl+Shift+X`) requires explicit verification on those operating systems to confirm no desktop window manager shortcut collisions.

---

## Known Quirks & Edge Cases

### 1. Contenteditable Blank Line DOM `innerText` Reporting
- **Observed Behavior**: When typing a blank paragraph (`\n\n`) into a `contenteditable` container with CSS `white-space: pre-wrap`, reading DOM `innerText` may report an extra newline character (3 newlines instead of 2).
- **Explanation**: Browsers insert `<br>` or empty `<div>` tags into contenteditable containers to ensure the caret remains visible on an empty line. This causes `innerText` to calculate an additional line break.
- **Verification Rule**: During compatibility tests, compare the actual selected plain text (`window.getSelection().toString()`) in addition to DOM `innerText`. Selected text accurately reflects the entered content.

### 2. Cross-Origin `<iframe>` Boundaries
- **Observed Behavior**: If an editor is embedded inside an `<iframe>` hosted on a different origin (e.g. an embed widget from a third-party domain), AutoType cannot inspect the caret.
- **Explanation**: Browser same-origin security policy blocks `element.contentDocument` traversal across origins.
- **Handling**: `inspectTarget` catches cross-origin exceptions gracefully and returns:
  > *"This embedded editor is inaccessible. Use a field in the main page."*
- **Resolution**: The user must focus an editor on the main page or in an accessible same-origin iframe.

### 3. Single-Line `<input>` and Multiline Drafts
- **Observed Behavior**: Attempting to type a draft containing `\n` into `<input type="text">` fails immediately.
- **Explanation**: Single-line text inputs cannot represent line breaks. In traditional web forms, submitting an Enter key in a text input submits the enclosing `<form>`.
- **Handling**: AutoType detects this condition before attaching the debugger and returns:
  > *"This passage contains line breaks. Choose a multiline editor or remove the line breaks."*

### 4. Third-Party Web Formatting Interception
- **Observed Behavior**: Text typed into certain web applications (e.g. rich Markdown editors, rich comment fields) may have quotes transformed to curly quotes (`"` $\rightarrow$ `“`), double hyphens converted to em-dashes (`--` $\rightarrow$ `—`), or markdown symbols parsed into styled nodes.
- **Explanation**: The website's own JavaScript input listeners can transform text after CDP dispatches the character.
- **Handling**: AutoType dispatches plain text. Any subsequent formatting is owned by the destination application.

