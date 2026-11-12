# Decision: No runtime build system (Zero dependencies) (ADR-003)

> Read this document when proposing new npm packages, bundlers, or toolchains.

## Context
Chrome extensions are frequently built using modern frontend frameworks (React, Svelte, Tailwind) and bundled via Webpack, Rollup, or Vite. While helpful for large enterprise web applications, toolchains add dependency vulnerabilities, build pipeline fragility, large `node_modules` footprints, and obfuscated output files that complicate Chrome Web Store security reviews.

## Decision
Build AutoType using pure standard ECMAScript modules (ESM), native browser HTML/CSS, standard Web APIs (`Intl.Segmenter`, `AbortController`, `crypto.randomUUID()`), and Node.js built-in modules (`node:test`, `node:assert`, `node:fs`, `node:child_process`). Do not install third-party dependencies in `package.json`.

## Reasoning
1. **Direct Inspectability**: The code loaded unpacked in Chrome is identical to the source code committed in Git. Reviewers and developers can inspect and debug exact line numbers with zero source-map confusion.
2. **Instant Verification & Zero Maintenance**: Tests execute in less than 60ms using `node --test`. There are no supply chain vulnerabilities, `npm audit` alerts, or breaking dependency upgrades over time.
3. **Chrome Web Store Review Speed**: Extensions with unminified, clean vanilla JavaScript without obfuscated bundler output pass Chrome Web Store automated and human security reviews significantly faster.
4. **Scope Alignment**: The extension UI is a compact, task-oriented writing slip popup (see `DESIGN.md`). A UI framework is unnecessary overhead for a single-view utility.

## Alternatives
- **TypeScript & Vite / Rollup**: Considered for compile-time types. Rejected because it requires a build step before loading unpacked, introduces transpilation artifacts, and requires continuous maintenance of bundler configurations.
- **React / Tailwind for Popup**: Rejected because native CSS with semantic HTML and flexbox is simpler, lighter, and completely sufficient for a compact popup.

## Consequences
- Requires developers and AI agents to write clean, standard vanilla JavaScript.
- Packaging is a simple 14-line Node script (`scripts/package.mjs`) executing the system `zip` utility.
- Zero npm dependencies in `package.json`.

