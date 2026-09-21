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
- `build-standalone-pages.js` — rebuilds `standard/plates/index.html` with all
  SVG plates inlined. Run after changing plates. The site landing page's inlined
  runtime is handled by `website/build-site.mjs` (`npm run build:site`). The
  single-file pages exist so `file://` browsing works even when the browser
  sandbox exposes only the opened file (e.g. Flatpak document-portal launches).
  (Replacement-string safety: always use function replacements when inlining —
  the runtime contains `$'` sequences that `String.replace` would expand.)
- `build-viewer.js` — builds the single-file end-user viewer
  `notation/viewer/ddn-viewer.html` by inlining `notation/dist/ddn.global.js` and
  `notation/viewer/src/{viewer.css,viewer.js}` into `src/template.html`. Run after
  `build:sdk` via `npm --prefix notation run build:viewer`; deterministic output.
- `requirements-dev.txt` — optional Python tooling (markdown rendering, schema
  validation, browser tests). Nothing here is required to run or test the runtime.

Release packaging (inventory, checksums, ZIP evidence) from the 0.5 monolith is not
imported; it will be re-established alongside the release process. See
`standard/governance/VERSIONING.md`.
