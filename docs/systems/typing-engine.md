# Typing Engine & Pacing System

> Read this document when modifying text pacing, character delay schedules, Unicode segmentation, or Chrome DevTools Protocol input dispatch.

## Pacing Mathematics & Schedule Generation

AutoType emulates a natural typing rhythm calibrated by default to **75 Words Per Minute (WPM)**, with user-configurable speeds ranging from **20 WPM to 200 WPM** in steps of 5 WPM.

### Baseline Calculation
- Standard typing calculation standardizes 1 word = 5 characters (including spaces).
- At $W$ words per minute:
  $$\text{Characters Per Minute} = W \times 5 \text{ chars/min}$$
  $$\text{Delay Per Character} = \frac{60,000 \text{ ms}}{W \times 5}$$
  - For default 75 WPM: 160 ms per character.
  - For 150 WPM: 80 ms per character.
  - For 50 WPM: 240 ms per character.
- In code ([`extension/core.js`](../../extension/core.js)):
  ```javascript
  export const DEFAULT_WPM = 75;
  export const MIN_WPM = 20;
  export const MAX_WPM = 200;
  export const WPM_STEP = 5;

  export function clampWpm(wpm) {
    if (wpm == null || wpm === '') return DEFAULT_WPM;
    const num = Number(wpm);
    if (!Number.isFinite(num)) return DEFAULT_WPM;
    return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(num / WPM_STEP) * WPM_STEP));
  }

  export function characterMs(wpm = DEFAULT_WPM) {
    return 60_000 / (clampWpm(wpm) * 5);
  }
  ```

### Punctuation Multipliers & Human Rhythm
Real typing is not metronomic. Humans pause slightly longer at sentence boundaries and clauses. AutoType applies categorical weights based on the character:

| Character Category | Regex Pattern | Multiplier |
| --- | --- | --- |
| Sentence boundaries & Newlines | `/[.!?\n]/u` | `2.1` |
| Clause boundaries | `/[,;:]/u` | `1.5` |
| Standard alphanumeric & space | Other | `1.0` |

### Random Jitter & Normalization
To prevent mechanical cadence, each character delay is multiplied by a random factor between 0.75 and 1.25:
$$\text{Jitter} = 0.75 + (\text{random}() \times 0.5)$$
$$\text{Raw Weight}_i = \text{Jitter}_i \times \text{PunctuationMultiplier}_i$$

To guarantee that the *total* duration of the passage strictly adheres to the target WPM regardless of random values:
$$\text{Target Total MS} = N \times \text{characterMs}(\text{WPM})$$
$$\text{Scaling Factor} = \frac{\text{Target Total MS}}{\sum_{i=0}^{N-1} \text{Raw Weight}_i}$$
$$\text{Scheduled Delay}_i = \text{Raw Weight}_i \times \text{Scaling Factor}$$

This guarantees that:
1. Every character has a positive, non-zero delay.
2. The passage exhibits natural micro-variations.
3. The overall speed remains strictly calibrated to the configured WPM across the passage.

### Dynamic Speed Adjustment & Schedule Rescaling
When the user increases or decreases WPM while a session is active or paused, `TypingSession.prototype.setWpm(wpm)` dynamically rescales the character schedule:
$$\text{Ratio} = \frac{\text{Old WPM}}{\text{New WPM}}$$
$$\text{Scheduled Delay}_i' = \text{Scheduled Delay}_i \times \text{Ratio}$$
This immediately updates the typing pace and remaining time estimate without restarting or disrupting the run.

---

## Text Segmentation & Unicode Invariants

JavaScript strings are indexed by UTF-16 code units (16-bit blocks). Standard indexing (`text[i]`) or `.split('')` shatters:
- Surrogate pairs (e.g., emojis: `👩🏽‍💻`)
- Accented graphemes using combining diacritical marks (e.g., `café` as `e` + `\u0301`)
- Regional indicator symbols and ZWJ (Zero-Width Joiner) sequences

AutoType strictly uses the native `Intl.Segmenter` API:
```javascript
export function segmentText(text) {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    .segment(text.replace(/\r\n?/g, '\n'))].map(part => part.segment);
}
```
- Line endings are normalized: `\r\n` and `\r` become `\n`.
- All other whitespace (spaces, tabs, multiple consecutive newlines) is preserved verbatim.

---

## Execution Loop & Dynamic Overhead Compensation

The typing loop runs in `TypingSession.prototype.run(version)` inside [`extension/core.js`](../../extension/core.js).

Browser timers (`setTimeout`) and asynchronous IPC calls introduce non-deterministic execution overhead. AutoType continuously measures the overhead of each iteration and subtracts it from the subsequent delay:

```javascript
let overhead = 0;
while (version === this.version && this.state.phase === 'typing') {
  // Sleep remaining delay, enforcing a 40ms safety floor
  await this.sleep(Math.max(40, this.schedule[this.state.index] - overhead), this.abort.signal);

  const start = this.now();
  await this.enqueue(async () => {
    // 1. Revalidate active tab & target editor
    if (!(await this.driver.isActive(this.state.tabId)) || !(await this.driver.check(this.state.tabId, this.token))) {
      return this.pauseInternal('Focus changed...');
    }
    // 2. Dispatch character via CDP
    await this.driver.send(this.state.tabId, this.characters[this.state.index], this.target.kind);
    // 3. Increment index and broadcast
    this.update({ index: this.state.index + 1 });
  });
  overhead = this.now() - start;
}
```

---

## Chrome DevTools Protocol (CDP) Input Transport

Traditional browser extensions inject text by updating `input.value` or calling `document.execCommand('insertText')`. This fails in modern editors:
- Canvas-based editors (Google Docs) do not use DOM input values.
- Modern JavaScript frameworks (React, Angular, Vue) override setters or listen to native input events.
- Synthesized JavaScript `new KeyboardEvent('keydown', ...)` has `isTrusted === false` and is rejected by security sandboxes.

AutoType solves this by using Chrome's low-level debugging protocol (`chrome.debugger`) with CDP version `1.3`.

### Dispatch Rules by Character Type & Destination

In [`extension/background.js`](../../extension/background.js) (`driver.send`):

```javascript
async send(tabId, character, kind) {
  const target = { tabId };
  if (character === '\n' && kind === 'docs') {
    // Rule 1: Google Docs Newline
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r', modifiers: 0
    });
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 0
    });
  } else if (/^[\x20-\x7e]$/u.test(character)) {
    // Rule 2: Printable ASCII Characters
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'char', text: character, unmodifiedText: character, key: character, modifiers: 0
    });
  } else {
    // Rule 3: Unicode, Tabs, and Standard Editor Newlines
    await chrome.debugger.sendCommand(target, 'Input.insertText', { text: character });
  }
}
```

### Rationale for Dispatch Modes

1. **Printable ASCII (`Input.dispatchKeyEvent` with `type: 'char'`)**:
   - Emulates an authentic character keypress without synthesising modifier combinations.
   - Bypasses keycode mapping issues across operating systems.
2. **Google Docs Enter (`Input.dispatchKeyEvent` with `keyDown`/`keyUp`)**:
   - Google Docs' hidden event iframe (`docs-texteventtarget-iframe`) listens for physical `Enter` key events (virtual key code 13) to create paragraph breaks.
3. **Unicode & Control Characters (`Input.insertText`)**:
   - Standard newlines (`\n`) in HTML forms must NOT send an Enter key event, because in a single-line input or standard form, an Enter keypress would trigger form submission!
   - Literal tabs (`\t`) must NOT send a Tab key event, because Tab causes the browser to shift focus to the next interactive element!
   - Multi-byte Unicode graphemes (e.g. emojis) cannot be represented cleanly as single keyboard key codes.
   - `Input.insertText` safely delivers the exact Unicode character directly to the active text composition context without triggering form submissions or focus changes.

