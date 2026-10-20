# AutoType

Read this file first. AutoType is a free Chrome extension that enters a prepared plain-text passage at the user's cursor with a natural rhythm averaging 75 WPM. [PROJECT-BRIEF.md](PROJECT-BRIEF.md) owns product intent and release boundaries. This folder belongs to the parent Work Git repository: confine edits and any staging to `autotype/`.

## Where to look

| Question | Source |
| --- | --- |
| Product intent and audience | [PROJECT-BRIEF.md](PROJECT-BRIEF.md) |
| Entry points, storage, interfaces, permissions | [docs/MAP.md](docs/MAP.md) |
| Coding and verification patterns | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Architectural rationale | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Known failures and recovery | [docs/GOTCHAS.md](docs/GOTCHAS.md) |
| Recent sessions | [docs/SESSION_LOG.md](docs/SESSION_LOG.md) |
| Compatibility evidence and release gates | [docs/VERIFICATION.md](docs/VERIFICATION.md) |
| Visual system | [DESIGN.md](DESIGN.md) |
| Installation | [README.md](README.md) |
| Store submission | [store/README.md](store/README.md) |

## Hard invariants

- Never start or resume without an explicit keyboard command in the destination.
- One session, one fixed draft snapshot, one serialized input queue. No retry of an uncertain input dispatch.
- Verify the original active editor before each character; pause/disarm on interruption and detach when inactive.
- Drafts stay local. Do not add telemetry, cloud sync, remote execution, or new permissions silently.
- Do not advertise Google Docs or another editor until its live acceptance test passes. Code and actual verification win over docs.

## Verifying your work

Node 22+: `npm test`, `npm run check`. `npm run dev` serves the disposable test bench. Load `extension/` unpacked in Chrome to exercise changed browser behavior. `npm run package` rechecks/tests and validates the installable ZIP. No CI, third-party linter, or typechecker exists.

## Keeping docs true

| Change | Update |
| --- | --- |
| Product scope | Project brief |
| Entry points, storage, interfaces | MAP |
| Patterns or checks | CONVENTIONS |
| Architecture | Append DECISIONS ADR |
| Observed failure or compatibility | GOTCHAS / VERIFICATION |
| Meaningful work | Append SESSION_LOG |

Keep this router below roughly 100 lines. Link facts instead of duplicating them; never describe planned files as implemented.
