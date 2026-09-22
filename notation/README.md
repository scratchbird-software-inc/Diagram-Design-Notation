# @ddn/notation — DDN reference runtime

Pure-JavaScript (ES2022+) reference implementation of the Data Design
Notation language: **parse → validate → lay out → render deterministic SVG**.
Zero runtime dependencies; runs in Node 22+ and browsers. Implements
`standard/` (the specification, grammar, schemas, and vocabulary registry).
Build tooling (Rollup + terser) is a pinned devDependency used only to
produce `dist/`; it never ships in the package or the bundles.

## Layout

- `runtime/` — ES modules (nested `package.json` sets `type: module`):
  `ddn-core.js` (lexer/parser, workspace
  resolution, resolved IR), `ddn-contracts.js` (registry/ERP validation),
  `ddn-layout.js` (placement + orthogonal/curved routing), `ddn-render.js`
  + `ddn-engine.js` (SVG renderer/dispatcher), `ddn-sketch.js` (seeded
  hand-drawn style), `ddn-export.js` (publication projection),
  `ddn-shapes.js`, `ddn-palette.js`, `ddn-profiles.js`, `ddn-projections.js`,
  quality modules, and `ddn-interaction.js`. Cross-bundle coupling resolves
  through `ddn-module-registry.js`; `ddn-full.js` wires every renderer onto
  the engine for direct Node consumers (CLI, test suites), mirroring
  `ddn.global.js`. Registry/glyph/profile assets are generated into
  `runtime/assets/` by `tools/build-assets.js` (freshness-gated).
- `cli/cli.js` — `check | render | resolve <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR]`
  (enforces workspace containment; rejects symlink escapes and remote imports).
- `studio/` — browser Studio (source-first editor) and portable editor.
- `adapters/vega-lite/` — optional Vega-Lite export adapter (not in the runtime bundle).
- `dist/` — shipped builds, committed so Studio and examples work without a
  build step: the all-in-one `ddn.global.js` (+ `ddn.mjs`, `ddn.d.ts`) and the
  modular bundles `ddn-core` / `ddn-graph` / `ddn-projections` /
  `ddn-quality` — each in three formats (IIFE `.js`, ES module `.mjs`,
  minified `.min.js` + `.min.js.map`, with `.d.ts`/`.d.mts` copies; contents
  and load order in the generated `dist/README.md`). Regenerate with
  `npm run build:sdk` (Rollup; see `../tools/rollup.config.mjs`).
- `tests/` — node suites: 150 core fixtures, 0.3 regressions, curved
  relations, patterns, projections, quality, use-cases, SDK, endpoint
  ordering, routing efficiency.

## Usage

```sh
npm test                                   # all suites
npm run build:sdk                          # rebuild dist/ from runtime/ + studio/src
node cli/cli.js check ../website/examples/basics/01-customer.ddn --workspace ..
```

All public output goes through the export/profile machinery — hiding is not
redaction. History before the monorepo import is in `CHANGELOG.md`.

## Packaging

This directory packs as the npm package `@ddn/notation` (see `package.json`:
`main`/`module`/`types`, an `exports` map with subpaths `.`, `./core`,
`./graph`, `./projections`, `./quality` and `./package.json`, and a `files`
allowlist of `dist/` + `README.md`). `npm pack` here produces a tarball with
exactly those files; consumers install the tarball directly — nothing is
published to a registry. The package is licensed GPL-2.0-or-later (the
`license` field is authoritative; there is no `LICENSE` file in this
directory — the repository-root `LICENSE` applies).

