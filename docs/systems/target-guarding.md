# Target Guarding & DOM Interruption System

> Read this document when modifying target element detection, iframe/shadow-DOM traversal, Google Docs caret resolution, or interruption event listeners.

## Isolated World Execution Model

The destination target inspector lives in [`extension/target.js`](../../extension/target.js) inside the standalone function `inspectTarget({ action, token, multiline })`.

- **Execution Mode**: Injected dynamically on demand via `chrome.scripting.executeScript`:
  ```javascript
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: inspectTarget,
    args: [{ action, token, multiline }]
  });
  ```
- **Isolated World Guarantee**: Chrome executes this script in an isolated world. It has full read/write access to the host page's DOM, but cannot interact with or be tampered with by the destination page's JavaScript context.
- **Self-Contained Rule**: Because `inspectTarget` is serialized to a string by the Chrome browser runtime before injection, it must not reference any closures, imports, or variables outside its own body.

---

## Target Resolution & Traversal

Modern web applications embed text editors inside shadow roots, Web Components, and nested iframes. `inspectTarget` implements an iterative descent algorithm traversing up to 20 levels deep:

```text
document.activeElement
       │
       ├── is IFRAME?
       │     ├── check for 'docs-texteventtarget-iframe' (Google Docs)
       │     └── descend into element.contentDocument
       │
       ├── is shadowRoot?
       │     └── descend into element.shadowRoot.activeElement
       │
       └── reached leaf editable element
```

### Google Docs Detection
Google Docs renders documents on an HTML5 `<canvas>` element. When a user clicks to place the cursor, Google Docs positions an invisible `<iframe>` with the class `docs-texteventtarget-iframe` containing a hidden `contenteditable` container.
- If the URL matches `docs.google.com/document/d/*` AND a `docs-texteventtarget-iframe` is active, `inspectTarget` classifies the destination as `kind = 'docs'`.

### Classification Matrix

| Destination Kind | Criteria | CDP Dispatch Handling |
| --- | --- | --- |
| `'docs'` | Host is Google Docs, `docs-texteventtarget-iframe` present, `isContentEditable` is true. | Newlines send physical `Enter` key event (`keyDown`/`keyUp`). |
| `'textarea'` | Leaf element `tagName === 'TEXTAREA'`. | Newlines send `Input.insertText`. |
| `'input'` | Leaf element `tagName === 'INPUT'` and `type` is one of `['text', 'search', 'email', 'url', 'tel']`. | Multiline drafts rejected upfront. |
| `'editable'` | Leaf element has `isContentEditable === true`. | Standard contenteditable; plain text insertion. |

---

## Guard Lifecycle & Actions

`inspectTarget` accepts four discrete action modes:

### 1. `action: 'capture'`
- Runs when initiating a new run (`TypingSession.prototype.toggle`).
- Disposes of any previous guard (`previous?.dispose()`).
- Resolves the active editor across iframes and shadow roots.
- Validates eligibility:
  - Document must have focus (`document.hasFocus()`).
  - Field must not be disabled or read-only (`disabled`, `readOnly`, `aria-disabled="true"`, `aria-readonly="true"`).
  - Password fields are rejected (`type === 'password'`).
  - If draft contains newlines and target is `'input'`, returns error.
- Constructs a guard object and attaches it to `window.__autotypeGuardV1`.
- Registers DOM event listeners across all traversed documents and the window.

### 2. `action: 'arm'`
- Runs after the Chrome debugger has attached and session is transitioning to `'typing'`.
- Sets `guard.armed = true`.

### 3. `action: 'check'`
- Runs immediately prior to dispatching each character.
- Verifies that:
  - Guard token matches the current session token.
  - Original element is still connected to the DOM (`isConnected`).
  - Active element is still the original element.
  - Window still has focus and visibility is visible.
  - Field has not become read-only or disabled.
  - Guard remains `armed`.

### 4. `action: 'disarm'`
- Runs when pausing or stopping.
- Sets `guard.armed = false`, deactivating interception.

---

## Interruption Mechanics & Immediate Disarming

When a user interacts with the page while AutoType is typing, typing must halt immediately before another character can be dispatched.

The guard registers listeners using capture phase (`useCapture = true`) across every document in the traversal hierarchy:

| Event | Target | Interruption Reason |
| --- | --- | --- |
| `pointerdown` | All traversed documents | *"Cursor moved. Click the original editor and use the shortcut to resume."* |
| `focusin` | All traversed documents | *"Focus changed. Use the shortcut in the original editor to resume."* |
| `keydown` (Navigation/editing keys) | All traversed documents | *"Keyboard input moved the cursor. Click the original editor and use the shortcut to resume."* |
| `visibilitychange` | Main document | *"Tab changed. Return to the original editor to resume."* |
| `blur` | Main window | *"The editor lost focus. Click it and use the shortcut to resume."* |

### Monitored Keys
The `keydown` listener triggers interruption for cursor navigation and structural keys:
`['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete', 'Tab', 'Escape']`.

### The Critical "Synchronous Disarm" Invariant
Notice the implementation in `target.js`:
```javascript
const interrupt = reason => {
  if (!guard.armed) return;
  guard.armed = false; // Synchronously disarm immediately!
  chrome.runtime.sendMessage({ type: 'TARGET_INTERRUPTED', token, reason }).catch(() => {});
};
```
Because `guard.armed = false` executes synchronously at the moment of the DOM event:
1. Even if the background service worker is currently in the middle of preparing the next character dispatch,
2. The pre-character check (`driver.check()`) queries `action: 'check'`, which evaluates `previous.armed`.
3. Since `armed` is already `false`, the check immediately fails and aborts dispatch.
4. This prevents a character from being typed into an incorrect caret position even before the asynchronous IPC message arrives at `background.js`.

