# Implementation map

## Entry points

`extension/manifest.json` declares Manifest V3, the module service worker, popup, icons, and two keyboard commands. `extension/background.js` owns Chrome APIs and connects to the pure scheduler/session controller in `extension/core.js`. `extension/target.js` contains the self-contained function serialized into the page's isolated world. `extension/popup.html`, `popup.css`, and `popup.js` implement the passage editor and status UI.

## Data and storage

| Key | Location | Lifetime and contents |
| --- | --- | --- |
| `draft` | `chrome.storage.local` | One plain-text passage; persists until Clear or uninstall. Access restricted to trusted extension contexts. |
| `checkpoint` | `chrome.storage.session` | Active/paused session state, tab ID, random guard token, text graphemes, timing schedule, target kind. Cleared on terminal transitions and browser restart. |
| `__autotypeGuardV1` | Isolated page world | Reference to the original editor, token, armed flag, event listeners; survives worker suspension, replaced by each new capture. |

There is no auth, cloud sync, backend, API credential, or environment-variable configuration. Draft text is sent only as input to the user's chosen website. No network fetching or remote code exists in the extension.

## Typing data flow

Popup input → serialized worker storage writes → command invocation → draft snapshot → grapheme segmentation and normalized timing schedule → active-element capture → debugger attachment → guard revalidation/arming → serial focus checks and character dispatch → acknowledged progress → detach.

Pointer, navigation-key, visibility, and focus listeners disarm the page guard before notifying the worker. A separate queue serializes commands, pause/stop, and each input dispatch. Pausing checkpoints the offset; a woken worker restores only paused sessions. An interrupted active checkpoint becomes an error, never an automatic replay.

## Interfaces

Popup messages: `GET_STATE` returns draft, public session snapshot, and registered commands; `SAVE_DRAFT` takes `text`; `CLEAR_DRAFT` clears and stops; `STOP` stops. Replies contain `ok` and either data or `error`. Only the exact extension popup URL may use these requests.

Page guard message: `TARGET_INTERRUPTED` carries the guard token and reason; sender extension ID, tab ID, and session token must match. Public `SESSION_STATE` broadcasts contain phase, character index/total, message, tab ID, and estimated remaining milliseconds, never passage text.

Phases: `idle`, `starting`, `typing`, `paused`, `completed`, `stopped`, `error`. The snapshot excludes text and private target references. `TypingSession.checkpoint()` is the worker's private restoration format.

`CommandController` coalesces startup commands, retains the invoking tab, and lets Stop/focus/navigation cancel a pending 300ms modifier-release delay. Cancellation is checked again after asynchronous storage/focus reads, so an already-fired startup callback cannot outlive Stop.

## Permissions and external integrations

| Permission | Used for |
| --- | --- |
| `debugger` | Sends printable keyboard events and Unicode input to the chosen tab. |
| `storage` | Saves the draft and session checkpoint. |
| `activeTab` | Temporary inspection access after an explicit action/shortcut. |
| `scripting` | Validates the editor and installs its focus/interruption guard. |

Chrome APIs: commands, action badge, storage, scripting, debugger, tabs/window lifecycle. Browser-level `Input.dispatchKeyEvent` sends printable characters and Docs Enter; `Input.insertText` handles Unicode, literal tabs, and ordinary multiline-editor newlines. The manifest requests debugger access upfront; active debugger sessions keep workers alive starting in Chrome 118. Sources: [debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger), [permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions), [worker lifetime](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Supporting tools

`tests/core.test.js`: Node unit/concurrency tests. `tests/fixture.html` and `frame.html`: disposable browser fixtures. `scripts/check.mjs`: runtime manifest/file/icon/syntax checks. `scripts/package.mjs`: validated ZIP with a runtime-file allowlist. `scripts/icons.mjs`: dependency-free geometric PNG generation. `scripts/serve.mjs`: loopback-only static development server. Store source and release documentation live in `store/`; generated installable package lives in `dist/`.
