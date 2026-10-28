# New DDN implementation tests

These tests exercise the adopted new language and native utilities, without legacy grammar or proof-of-concept expectations.

| Suite | Evidence |
| --- | --- |
| Root contract/type tests | ABI fidelity, deterministic sync, symlink protection, headless/browser boundaries |
| `language` | Adopted examples, punctuation, sparse tables, includes, templates and stable source edits |
| `verification` | Schemas/defaults, profile constraints, coverage, budgets and lifecycle evidence |
| `runtime` | Atomic commands/providers, authority, revisions, history and save snapshots |
| `execution` | Real worker/local parity, cancellation, fallback and stale response fencing |
| `browser/*.test.mjs` | Pure presentation, table and Markdown behavior |
| `browser/*.browser.mjs` | Real Chromium utilities and standalone HTML workflows |

```sh
bash tooling/run.sh test:ddn
node tooling/browser/bootstrap.mjs
bash tooling/run.sh test:ddn:browser
```

Generated artifacts, screenshots and browser profiles stay in `.work`. TypeScript tests compile contracts; JavaScript tests execute behavior. See [qualification limits](../../../docs/DDN/IMPLEMENTATION.md) before treating these checks as a complete release gate.
