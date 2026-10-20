# Conventions

These are the patterns established by the first implementation, not a legacy standard.

- Plain ESM JavaScript; no runtime dependencies, build framework, remote script, inline extension JavaScript, or `eval`.
- Pure text/pacing/session logic belongs in `core.js`; Chrome-specific operations belong in the driver in `background.js`.
- Pass every state-changing session operation through the controller queue. Timers stay outside the queue. Never retry an input command after an uncertain acknowledgment.
- The serialized target function must be self-contained and execute in Chrome's isolated world. Do not mutate document content directly or expose draft data to the page.
- Segment Unicode by grapheme and never trim a user's draft. Preserve whitespace except documented line-ending normalization.
- Save popup edits immediately through the worker; don't rely on popup-unload handlers or a pending debounce.
- Preserve native form semantics, visible focus rings, reduced motion, accessible status/error messages, and the compact popup layout. See `DESIGN.md` for observed visual tokens.
- Add dependencies only when an existing platform API cannot reasonably do the job. Explain the tradeoff in an ADR.

## Verification loop

Run `npm test` and `npm run check` after logic changes. Load the extension and test relevant behavior at `npm run dev`'s fixture URL. Record live-browser results and limitations in [VERIFICATION.md](VERIFICATION.md). `npm run package` repeats validation and tests and verifies archive integrity. No formatter, third-party linter, typechecker, or CI configuration is installed.

Documentation follows code in the same change. Maps describe implemented state, not intended future files. Add gotchas only from observed behavior or cited browser constraints; never turn an untested assumption into a support claim.
