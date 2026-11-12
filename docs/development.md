# Development & Verification Guide

> Read this document when setting up your development environment, running tests, launching the local fixture server, or testing the extension in Chrome.

## Prerequisites

- **Node.js**: Version 22.0.0 or higher (uses built-in test runner `node:test`).
- **Archive Tools**: Standard system `zip` and `unzip` commands (for `scripts/package.mjs`).
- **Browser**: Google Chrome version 118 or higher (supports Manifest V3 module service workers and active debugger worker lifetime guarantees).

No package manager other than native `npm` is needed, and `npm install` does not download any external packages (there are zero `dependencies` or `devDependencies` in `package.json`).

---

## Core Development Scripts

All scripts are defined in `package.json` and executed via `npm run <script>`:

```sh
# 1. Run Node.js unit and concurrency tests
npm test

# 2. Perform static manifest, syntax, icon dimension, and CSP checks
npm run check

# 3. Start local disposable HTTP test bench (http://127.0.0.1:8765/)
npm run dev

# 4. Run tests, run checks, and generate production release ZIP in dist/
npm run package
```

### Detailed Script Behaviors

#### `npm test`
Runs `node --test tests/*.test.js`.
- Tests pure logic in `extension/core.js` using mock drivers and Promise timers.
- Covers:
  - Unicode grapheme segmentation (`Intl.Segmenter`) and line-ending normalization
  - Natural 75 WPM pacing calculations and punctuation pauses
  - Draft validation and 200,000 character boundaries
  - Abortable sleep timers
  - Session queue concurrency and toggle operations
  - Pause, resume, and tab isolation
  - Stop operations and cleanup
  - Guard token validation and stale interrupt rejection
  - Dispatch error handling and CDP disconnects
  - Service worker suspension restoration rules
  - `CommandController` 300ms modifier delay, repeat coalescing, and async cancellation

#### `npm run check`
Executes `scripts/check.mjs`.
- Parses `extension/manifest.json` and verifies:
  - `manifest_version === 3`
  - `minimum_chrome_version === '118'`
  - Exact permissions list: `['activeTab', 'debugger', 'scripting', 'storage']`
  - Ensures no `host_permissions` or `content_scripts` are registered
- Inspects all icon files (`extension/icons/icon*.png`) to assert their binary header width and height match 16, 32, 48, and 128 px.
- Validates JavaScript syntax across all files in `extension/`, `scripts/`, and `tests/` using `node --check`.
- Asserts that all `<script>` tags in `extension/popup.html` are external (`src=...`) and contain no inline code, satisfying MV3 Content Security Policy (CSP).

#### `npm run dev`
Executes `scripts/serve.mjs`.
- Starts a minimal, zero-dependency HTTP server bound strictly to loopback IP `127.0.0.1:8765`.
- Serves `tests/fixture.html` and `tests/frame.html`.
- Serves proper MIME types (`text/html`, `application/javascript`, `text/css`, `image/png`, `application/json`).
- Press `Ctrl+C` to terminate.

#### `npm run package`
Executes `scripts/package.mjs`.
- First triggers `scripts/check.mjs`.
- Next triggers `tests/core.test.js`.
- Creates directory `dist/` if it does not exist.
- Removes any previous `dist/autotype-0.1.0.zip`.
- Archives only allowlisted runtime files:
  - `manifest.json`, `background.js`, `core.js`, `target.js`, `popup.html`, `popup.css`, `popup.js`, and the 4 icon PNGs.
- Verifies archive integrity with `unzip -t dist/autotype-0.1.0.zip`.

---

## Testing Unpacked Extension in Chrome

To test live browser behavior with Chrome DevTools Protocol and real keyboard shortcuts:

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `extension/` folder in this repository.
6. AutoType will appear in the extensions list. Note the extension ID.
7. Click the extension puzzle icon in the Chrome toolbar and pin AutoType.

### Live Testing with the Fixture

1. In a terminal, run `npm run dev`.
2. In Chrome, navigate to `http://127.0.0.1:8765/tests/fixture.html`.
3. Open the AutoType popup:
   - Paste a sample passage into the textarea.
   - Confirm status changes to "Saved".
   - Note the character count and estimated duration.
4. Close the popup (click outside).
5. Click inside one of the fixture editors:
   - `<textarea>`
   - `<div contenteditable="true">`
   - Single-line `<input type="text">`
   - Embedded iframe editor
6. Press the start shortcut:
   - macOS: **Command+Shift+Y**
   - Windows / Linux: **Ctrl+Shift+Y**
7. Observe:
   - Chrome infobar appears: *"AutoType started debugging this browser"*.
   - Toolbar badge updates to green **ON**.
   - Text types into the field at ~75 WPM with slight pauses on commas, periods, and line breaks.
8. Test interruption:
   - Click another field or press an arrow key while typing.
   - Badge updates to **Ⅱ** (paused).
   - Click back into the original editor and press the shortcut again to resume.
9. Test stop:
   - Press **Command+Shift+X** / **Ctrl+Shift+X**.
   - Typing halts immediately; badge clears.

### Debugging Extension Logs

- **Background Service Worker**: In `chrome://extensions/`, find AutoType and click the "service worker" link under "Inspect views". This opens a Dedicated DevTools window for `background.js`.
- **Popup Console**: Right-click the extension toolbar icon and select "Inspect popup", or right-click inside the open popup and select "Inspect".
- **Target Script Execution**: Inspect the destination page's console (`F12`), but remember `target.js` executes in the *Isolated World*. In Chrome DevTools Console, use the context dropdown (top left of console, usually set to `top`) to select the AutoType isolated world context.

