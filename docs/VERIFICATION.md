# Verification and release gates

Date: 2026-10-05, Asia/Manila. Results describe the observed build, not implied compatibility with all editors.

## Automated checks

- Node 24.13.0: 18 controller/pacing tests passed. Coverage includes Unicode graphemes, whitespace, line-ending normalization, exact schedule budget, punctuation pauses, abortable waits, fixed draft snapshots, pause/resume, duplicate commands, Stop, focus loss, stale tokens, failed sends, external detach, in-flight acknowledgment, paused restoration, restricted/empty target failures, and startup cancellation before and after asynchronous storage reads.
- `npm run check`: manifest version/minimum Chrome/permissions, runtime references, icon dimensions, external MV3 script structure, and syntax passed.
- Final `npm run package`: all 18 tests and source checks passed; ZIP integrity passed for the 11 allowed runtime files. No fixtures, drafts, project docs, or development dependencies are included.

## Live browser evidence

Isolated Chrome for Testing 153, a local disposable profile, extension loaded from `extension/`, real macOS Command+Shift+Y input through native browser controls, and Playwright CLI for reading results. No source changes outside `autotype`.

| Scenario | Result |
| --- | --- |
| Manifest load and suggested shortcuts | Passed; both command shortcuts registered. |
| Popup save and popup closure | Passed; submitted draft persisted in local storage. |
| Textarea Unicode/whitespace | Passed: `Hello café 👩🏽‍💻!` followed by a blank line and `Line` + literal tab + `end.` matched exactly. |
| Sustained run / pace | Passed: 280 input events; first-to-last span 44.9873 seconds against a 44.8-second total schedule, including beyond normal 30-second idle lifetime. All text matched. |
| Single-line selection replacement | Passed: selected `after` in `Before after` became `Before INSERT`; zero form submissions. |
| Multiline draft in single-line input | Passed: actionable error, no input sent, original field unchanged. |
| Clicking a different field | Passed: original textarea stopped at 72 of 108 characters, other field unchanged. |
| Resume after click pause | Passed: resumed in original editor; final text matched all 108 characters with no duplicate prefix. |
| Contenteditable Unicode/whitespace | Passed: selected plain text matched Unicode, blank line, and literal tab. DOM innerText reports an extra newline for a blank paragraph; see GOTCHAS. |
| Accessible same-origin embedded textarea | Passed: accented text, line break, and literal tab matched exactly. |
| Password/read-only/disabled | Passed target inspection: password/read-only rejected; disabled field cannot take focus and is not accepted. No text inserted. |
| Inaccessible embedded editor | Passed: cross-origin localhost iframe rejected; main fixture uses 127.0.0.1. |
| Open shadow-root editor | Passed target capture; full typing there remains a manual compatibility check. |
| Tab and window changes | Passed: run paused, original field remained stable after change. |
| Navigation | Passed: paused run canceled and progress reset on destination page change. |
| Popup Stop/Clear | Passed: Stop reset progress; Clear removed local draft. |
| Unassigned-shortcut UI | Passed with a simulated empty command list: both controls displayed Not assigned. Actual conflicting extension setup remains a manual check. |
| Browser restart | Passed: local draft retained; empty new fixture received no text; checkpoint absent and badge inactive. |
| Google Docs | Pending signed-in Chrome test. Automated opening of Chrome extension settings was blocked by browser URL security policy. User was asked to load the extension manually; no workaround was attempted. |

## Google Docs acceptance

Use a new disposable document, not existing work. Test printable text, punctuation, Unicode, paragraph breaks/blank lines, literal tabs, selection replacement, pause/resume, and stopping. Compare actual document contents; an acknowledged input command alone is insufficient. Do not add Docs to public store claims until this passes. No special Docs DOM mode or external account permissions are requested by the extension.

## Packaged-build acceptance

Extracted `dist/autotype-0.1.0.zip` and loaded that folder in a fresh Chrome for Testing 153 profile. Real macOS shortcuts entered `Packaged café 👩🏽‍💻!` followed by a blank line and `Line` + literal tab + `end.` exactly. A 320-character passage paused at offset 30, remained unchanged while paused, and resumed to match the entire snapshot without duplication or omission. The resumed run exceeded 30 seconds. Completion removed the session checkpoint; no worker promise errors were observed.

Starting and immediately pressing the Stop shortcut canceled the pending 300ms startup: the existing 320-character fixture remained unchanged and status became stopped with zero progress.

This test caught a service-worker timer receiver failure missed by Node; the timer adapters were corrected and the archive rebuilt before the successful run. A reused flag-loaded profile retained the older worker; final acceptance used a fresh profile. See [GOTCHAS.md](GOTCHAS.md).

## Publication gates

Pending live checks must pass or unsupported scenarios must be explicitly excluded. Windows/Linux shortcut behavior needs a platform check; current native tests are macOS only. Store publisher/support identity, hosted HTTPS privacy-policy URL, reviewer submission, and final release approval remain external inputs. Store approval is not asserted by this project's tests.

## Interface review

Actual popup screenshots verified at 380px and 320px, with no horizontal overflow. Default paused popup fits below Chrome's 600px popup height; expanded help or long errors can scroll. Impeccable detector ran once in degraded regex mode (parser modules unavailable); its progress-width transition warning was fixed by removing the transition. Independent finish review found one inaccurate footer claim, which was changed to Draft stays on this device. Reviewer scored that fix resolved and disposition ship; this review covers the popup interface, not untested editor compatibility.
