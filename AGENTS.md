# AutoType

Read this file first. AutoType is a free Chrome extension that enters a prepared plain-text passage at the user's cursor with a natural rhythm averaging 75 WPM. [PROJECT-BRIEF.md](PROJECT-BRIEF.md) owns product intent and release boundaries. The complete AI operating manual and second-brain knowledge system lives in [agent.md](agent.md). This folder belongs to the parent Work Git repository: confine edits and any staging to `autotype/`.

## Where to look

| Question | Source |
| --- | --- |
| AI Agent operating manual & workflow | [agent.md](agent.md) |
| Product intent and audience | [PROJECT-BRIEF.md](PROJECT-BRIEF.md) / [docs/project-overview.md](docs/project-overview.md) |
| Full system architecture & data flow | [docs/architecture.md](docs/architecture.md) |
| Codebase directory & file map | [docs/codebase-map.md](docs/codebase-map.md) / [docs/MAP.md](docs/MAP.md) |
| Deep system mechanics (pacing, lifecycle, guard) | [docs/systems/](docs/systems/) |
| Coding & verification conventions | [docs/conventions.md](docs/conventions.md) |
| Architectural rationale & ADRs | [docs/decisions/](docs/decisions/) / [docs/DECISIONS.md](docs/DECISIONS.md) |
| Known failures & recovery | [docs/troubleshooting.md](docs/troubleshooting.md) / [docs/GOTCHAS.md](docs/GOTCHAS.md) |
| Compatibility evidence & release gates | [docs/known-issues.md](docs/known-issues.md) / [docs/VERIFICATION.md](docs/VERIFICATION.md) |
| Chronological changelog & session logs | [docs/changelog.md](docs/changelog.md) / [docs/SESSION_LOG.md](docs/SESSION_LOG.md) |
| Visual system | [DESIGN.md](DESIGN.md) |
| Installation & development setup | [README.md](README.md) / [docs/development.md](docs/development.md) |
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
| Operating manual or agent workflow | [agent.md](agent.md) |
| Subsystem architecture or mechanics | [docs/architecture.md](docs/architecture.md) / [docs/systems/](docs/systems/) |
| Entry points, storage, interfaces | [docs/codebase-map.md](docs/codebase-map.md) / [docs/MAP.md](docs/MAP.md) |
| Architectural choice | Append ADR to [docs/decisions/](docs/decisions/) |
| Bug diagnosis or edge case | [docs/troubleshooting.md](docs/troubleshooting.md) / [docs/known-issues.md](docs/known-issues.md) |
| Meaningful work | Append to [docs/changelog.md](docs/changelog.md) and [docs/SESSION_LOG.md](docs/SESSION_LOG.md) |

Keep this router below roughly 100 lines. Link facts instead of duplicating them; never describe planned files as implemented.
