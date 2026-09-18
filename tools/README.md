# Shared tooling

Small tools shared by the monorepo components. Per-component test suites live in
`../notation/tests/`; component docs live in each component's README.

- `serve.js` — local, read-only static server for the repository root
  (`node serve.js` → http://127.0.0.1:8080; Studio at `/notation/studio/editor.html`,
  designer prototype at `/designer/prototype/index.html`).
- `build-sdk.js` — builds the single-file public runtime `notation/dist/ddn.global.js`
  (plus `ddn.mjs`, `ddn.d.ts`) from `notation/runtime/` + `notation/studio/src/`,
  embedding the registry from `standard/registry/`. Run via `npm run build:sdk`.
- `build-schemas.py` — regenerates the JSON Schemas in `standard/schemas/` from the
  pinned vocabulary in `standard/registry/` (Python 3, stdlib only).
- `requirements-dev.txt` — optional Python tooling (markdown rendering, schema
  validation, browser tests). Nothing here is required to run or test the runtime.

Release packaging (inventory, checksums, ZIP evidence) from the 0.5 monolith is not
imported; it will be re-established alongside the release process. See
`standard/governance/VERSIONING.md`.
