# Storage & Inter-Process Communication (IPC)

> Read this document when adding storage keys, altering popup-to-worker message schemas, changing security access levels, or modifying toolbar badges.

## Storage Architecture

AutoType maintains three distinct storage layers with differing lifetimes, access controls, and consistency guarantees:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AutoType Storage Models                         │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ chrome.storage.local │ chrome.storage.session│ Page Isolated Scope      │
│ ('draft')            │ ('checkpoint')       │ (__autotypeGuardV1)      │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ Persistent           │ In-Memory Session    │ Page Lifecycle           │
│ Survives browser     │ Discarded on browser │ Discarded on page unload │
│ restarts             │ restart or stop      │ or new capture           │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ TRUSTED_CONTEXTS     │ Extension contexts   │ Isolated world only      │
│ (Worker/Popup only)  │ only                 │ (Host scripts blocked)   │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

### 1. `chrome.storage.local` (Passage Draft & Typing Speed)
- **Keys**:
  - `'draft'`: `string` (plain text, max 200,000 UTF-16 code units).
  - `'wpm'`: `number` (20 to 200, defaults to 75). Persists user's configured typing speed.
- **Access Level Restriction**:
  At service worker initialization ([`extension/background.js`](../../extension/background.js)):
  ```javascript
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  ```
  This prevents untrusted content scripts or web pages from accessing user drafts or speed preferences.
- **Write Serialization**:
  In `popup.js`, drafting edits and speed changes trigger asynchronous writes via `saveQueue` in `background.js`. Writes are serialized and survive instant popup closure.

### 2. `chrome.storage.session` (Session Checkpoint)
- **Key**: `'checkpoint'`
- **Data Type**: Object containing:
  ```javascript
  {
    state: {
      phase: 'paused',
      index: 45,
      total: 120,
      message: '...',
      tabId: 12
    },
    characters: ['H', 'e', 'l', 'l', 'o', ...],
    schedule: [160, 160, 155, ...],
    token: '8f7a932b-34a9-408a-b851-bcfa15d6e24f',
    target: { kind: 'textarea' },
    wpm: 75
  }
  ```
- **Lifecycle**:
  - Written when pausing or changing state.
  - Read when a suspended service worker wakes up.
  - Cleared upon `stop()`, `completed`, `error`, or browser restart.
- **Security & Safety**:
  - Checkpoints are strictly session-bound.
  - Workers restore *only* checkpoints whose `state.phase === 'paused'`. An active checkpoint found on restart causes an immediate transition to `'error'`.

### 3. Page Isolated Memory (`window.__autotypeGuardV1`)
- **Key**: `window.__autotypeGuardV1`
- **Location**: Active tab's isolated world.
- **Contents**: `{ token, element, kind, armed, dispose }`.
- **Lifecycle**: Replaced whenever a new target is captured; destroyed on tab navigation, refresh, or tab closure.

---

## IPC Message Protocol

Communication between extension contexts uses `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`.

### Message Types & Schemas

#### 1. Popup $\rightarrow$ Service Worker

All popup messages must pass strict origin verification in `background.js`:
```javascript
if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) {
  return false;
}
```

- **`GET_STATE`**:
  - Request: `{ type: 'GET_STATE' }`
  - Response: `{ ok: true, draft: string, wpm: number, state: PublicSessionState, commands: Command[] }`
- **`SET_WPM`**:
  - Request: `{ type: 'SET_WPM', wpm: number }`
  - Response: `{ ok: true, wpm: number }`
  - Action: Clamps WPM (20 to 200), updates `session.wpm` (scaling active schedule), and persists `'wpm'` in `chrome.storage.local`.
- **`SAVE_DRAFT`**:
  - Request: `{ type: 'SAVE_DRAFT', text: string }`
  - Response: `{ ok: true }` or `{ ok: false, error: string }`
- **`CLEAR_DRAFT`**:
  - Request: `{ type: 'CLEAR_DRAFT' }`
  - Response: `{ ok: true }`
  - Action: Cancels pending commands, invokes `session.stop()`, and removes `'draft'` from `chrome.storage.local`.
- **`STOP`**:
  - Request: `{ type: 'STOP' }`
  - Response: `{ ok: true }`
  - Action: Cancels pending commands and invokes `session.stop()`.

#### 2. Isolated Page Target $\rightarrow$ Service Worker

- **`TARGET_INTERRUPTED`**:
  - Request: `{ type: 'TARGET_INTERRUPTED', token: string, reason: string }`
  - Verification: Must match `sender.tab?.id && sender.id === chrome.runtime.id && message.token === session.token`.
  - Action: Triggers `session.interrupt(sender.tab.id, token, reason)`, pausing typing.

#### 3. Service Worker $\rightarrow$ Extension Contexts (Broadcast)

- **`SESSION_STATE`**:
  - Broadcast: `{ type: 'SESSION_STATE', state: PublicSessionState }`
  - Sent via `chrome.runtime.sendMessage(...)` on every state mutation or character increment.
  - Schema for `PublicSessionState`:
    ```javascript
    {
      phase: 'idle' | 'starting' | 'typing' | 'paused' | 'completed' | 'stopped' | 'error',
      index: number,
      total: number,
      message: string,
      tabId?: number,
      wpm: number,
      remainingMs: number
    }
    ```
  - **Security Invariant**: `PublicSessionState` NEVER includes draft text, character arrays, or private DOM references.

---

## Action Badge & Visual Indicators

`publish(state)` in `background.js` dynamically configures the browser action toolbar icon badge:

| Phase | Badge Text | Badge Background Color | Hex Code |
| --- | --- | --- | --- |
| `'typing'` | `ON` | Dark Green | `#324c41` |
| `'paused'` | `Ⅱ` | Dark Green | `#324c41` |
| `'error'` | `!` | Warning Red | `#9c3827` |
| `'idle'`, `'completed'`, `'stopped'` | `""` (cleared) | Default | N/A |

