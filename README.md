# AutoType

Paste a passage, click your destination, and let Chrome enter it at a natural rhythm averaging **75 WPM**. Free, local drafts, no account.

## Install locally

1. Open `chrome://extensions` in Chrome 118 or newer.
2. Enable **Developer mode**, click **Load unpacked**, and choose this project's `extension` folder.
3. Pin AutoType from Chrome's Extensions menu.
4. Open AutoType, paste your text, and wait for **Saved**.
5. Close the popup and click the destination editor.
6. Press **Command+Shift+Y** on Mac or **Ctrl+Shift+Y** on Windows/Linux to start. Press it again to pause or resume.
7. **Command+Shift+X** / **Ctrl+Shift+X** stops and resets progress.

If a shortcut is missing or conflicts, use **Change shortcuts** in the popup. Chrome shows a debugging banner during a run; canceling the banner stops the run. Opening the popup pauses typing.

A paused passage resumes only in its original editor. After Stop, completion, navigation, or a browser restart, a new run begins at the start of the saved draft. Check the destination after a reported input failure: the final character may already have arrived.

## Supported destinations

Ordinary text inputs, textareas, and contenteditable fields in HTTP(S) pages, including accessible same-origin frames and open shadow roots. Google Docs has a dedicated adapter; see [verification results](docs/VERIFICATION.md) before relying on it. Passwords, disabled/read-only fields, browser internal pages, local files, and inaccessible embedded editors are rejected. Multiline drafts require a multiline editor.

Text is plain text; it uses the destination's selection and formatting behavior. CRLF/CR line endings normalize to LF. Website autoformatting may change punctuation, tabs, or other entered content. There is no guarantee about how collaborators or editing-history tools display a run.

## Development

Node 22+ and the system `zip`/`unzip` commands are needed for development and packaging. Runtime dependencies: none.

```sh
npm test
npm run check
npm run dev
npm run package
```

The local test bench is `http://127.0.0.1:8765/tests/fixture.html`. The package command validates source and tests, then creates `dist/autotype-0.1.0.zip` containing only extension runtime files. Unzip it into a folder to use **Load unpacked**, or use the ZIP for store upload.

[Project brief](PROJECT-BRIEF.md) · [Architecture](docs/MAP.md) · [Privacy policy source](store/privacy.html) · [Store release materials](store/README.md)
