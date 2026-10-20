# Chrome Web Store listing draft

## Name

AutoType

## Short description

Type a prepared passage at your cursor with a natural rhythm averaging 75 WPM. Local drafts, keyboard control.

## Detailed description

Prepare your words once. Enter them one keystroke at a time.

Paste a passage into AutoType, close the popup, click a website text field, and press the start shortcut. AutoType enters your text with varying character delays and short punctuation pauses at approximately 75 words per minute.

- Start, pause, and resume from your keyboard.
- Stop and reset whenever you need to.
- Keep one saved passage locally on your device.
- See character progress and estimated time remaining.
- Use ordinary text inputs, multiline textareas, and editable website areas.
- Free. No sign-in, analytics, advertising, or cloud sync.

On Mac: Command+Shift+Y starts/pauses/resumes; Command+Shift+X stops. On Windows/Linux: Ctrl+Shift+Y and Ctrl+Shift+X. Customize them in Chrome's extension shortcut settings.

Chrome displays a debugging banner while AutoType is typing. AutoType uses debugger input to enter text into your chosen editor and detaches when typing pauses or ends. Your selected website receives the typed text and may store it under its own policies. AutoType itself keeps your saved passage on your device until cleared.

Clicking elsewhere or switching tabs pauses the run. Resume only in the same editor. Navigation and input failures stop the run. Website formatting settings can alter entered content. Some embedded or complex editors are unsupported. Chrome 118 or newer is required.

Google Docs is intentionally omitted from public compatibility claims until its live release test is recorded as passed.

## Submission fields

- Single purpose: User-triggered, paced entry of a locally saved passage into a selected website editor.
- Permission justifications: Copy the implemented explanations in [docs/MAP.md](../docs/MAP.md#permissions-and-external-integrations); debugger is required for browser-level input, not network inspection.
- Remote code: None. All extension JavaScript is packaged locally.
- Data handling: Disclose user-provided text and transient destination/editor state, processed locally to provide typing. No publisher/server collection, sale, analytics, or advertising. The destination website receives the text by the user's action.
- Privacy-policy URL and support contact: Configure before release. [Privacy-policy source](privacy.html).
