# Decisions

Numbered ADRs are permanent. Supersede rather than delete or renumber them.

## ADR-001 — Browser-level input and explicit debugger access

Status: Accepted, 2026-10-05.

Google Docs uses canvas rendering, so ordinary DOM value manipulation is not a reliable foundation for the requested cursor-typing workflow. Use Chrome's debugger input transport for all supported destinations, with isolated-world target validation. The user explicitly accepted the install permission and visible debugging banner. Attach only for active typing, detach otherwise, and avoid blanket host permissions. This deliberately narrows initial browser support to Chrome and keeps Google Docs support gated by live testing.

Sources: [Google Docs rendering notice](https://workspaceupdates.googleblog.com/2021/05/Google-Docs-Canvas-Based-Rendering-Update.html), [Chrome input protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/). Permission details live in [MAP.md](MAP.md).

## ADR-002 — Serial acknowledgment and session-only pause restoration

Status: Accepted, 2026-10-05.

Cursor typing cannot be safely retried after an uncertain delivery. A single queue owns state transitions and character sends. Advance only after acknowledgment; stop after an input error. Chrome 118's debugger lifetime behavior supports long active runs. Persist paused runs in session storage because unattached workers may sleep; restore only paused checkpoints. Browser restart discards run progress while retaining the saved draft. This avoids hidden automatic continuation or replay into an obsolete caret.

## ADR-003 — No runtime build system

Status: Accepted, 2026-10-05.

The approved scope is a small popup and service worker. Native ESM, HTML/CSS, Node's built-in runner, and an allowlisted ZIP are sufficient. This keeps the installable package inspectable and avoids a framework or server for a local task.
