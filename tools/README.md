# Shared tooling

Small tools shared by the monorepo components. Per-component test suites live in
`../notation/tests/`; component docs live in each component's README.

- `serve.js` — local, read-only static server for the repository root
  (`node serve.js` → http://127.0.0.1:8080; Studio at `/notation/studio/editor.html`,
  designer prototype at `/designer/prototype/index.html`).
- `build-sdk.js` — builds the public runtime bundles in `notation/dist/` from the
  ES-module sources in `notation/runtime/` + `notation/studio/src/` with Rollup
  (`rollup.config.mjs`; pinned `rollup` + `@rollup/plugin-terser` devDependencies):
  five bundles (`ddn-core`, `ddn-graph`, `ddn-quality`, `ddn-projections`,
  `ddn.global`) × three formats (IIFE `.js`, ESM `.mjs`, minified `.min.js` +
  source map), plus types, CSS, the freshness manifest and the generated dist
  README. `build-assets.js` generates the registry/glyph asset modules under
  `notation/runtime/assets/` from `standard/registry/` first. Run via
  `npm run build:sdk`.
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
- `normalize-ddn.mjs` — corpus normalizer (B1-021): keeps every tracked `.ddn`
  source minimal and in the newest dialect. Strips declaration properties that
  duplicate the effective default (global `DEFAULTS` merged through format
  bundles and referenced profiles, incl. the `layout.center` fallback), bumps
  legacy headers to `ddn "0.5"`, drops dead empty override blocks, and keeps
  demonstrative overrides (logged). Modes: write (default), `--check`
  (CI gate, wired into `npm test` as `test:normalize`), `--verify`
  (before/after render compare per view), `--report FILE` (JSON stats).
- `build-use-cases-manifest.mjs` — regenerates `website/examples/use-cases/
  manifest.json` hashes plus the (gitignored) `rendered/` SVG/resolved/scene
  outputs after source or runtime changes.
- `requirements-dev.txt` — optional Python tooling (markdown rendering, schema
  validation, browser tests). Nothing here is required to run or test the runtime.

Release packaging (inventory, checksums, ZIP evidence) from the 0.5 monolith is not
imported; it will be re-established alongside the release process. See
`standard/governance/VERSIONING.md`.
