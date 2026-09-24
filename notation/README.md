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
  `ddn-quality` plus the optional `ddn-geo` (geographic maps; never in the
  all-in-one — missing module renders a visible placeholder + DDN-E010
  diagnostic) — each in three formats (IIFE `.js`, ES module `.mjs`,
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
node cli/cli.js render x.ddn --workspace . --no-motion   # static SVG (strip SMIL animation)
```

## Flow animation (B1-033)

Graph relations accept optional motion properties — `motion: flow|pulse|none`,
`marker`, `marker_size`, `marker_color`, `rate` (1–32, staggered particle
stream), `speed`, `pulse_color` — and views accept `flow <id> { steps: @a ->
@b -> @c; … }` blocks that resolve each hop to the existing relation between
consecutive elements (`DDN-E013` when none connects a hop, `DDN-E014` for
invalid motion values, `DDN-W016` when `rate` exceeds the 32-marker cap). The
renderer emits deterministic declarative SMIL (`<animateMotion>`/`<animate>`;
no script, file://-safe, autonomous in exported SVG); `--no-motion` or the
`noMotion` render option strips it for print. The unified tool exposes an
Animation drawer (start/stop, step one hop, speed multiplier, flow selector;
auto-pause on `prefers-reduced-motion`). Normative detail: spec chapter 27
(`standard/specification/27-flow-animation.md`).

All public output goes through the export/profile machinery — hiding is not
redaction. History before the monorepo import is in `CHANGELOG.md`.

## Packaging

This directory packs as the npm package `@ddn/notation` (see `package.json`:
`main`/`module`/`types`, an `exports` map with subpaths `.`, `./core`,
`./graph`, `./projections`, `./quality`, `./geo` and `./package.json`, a
`files` allowlist of `dist/` + `README.md`, `publishConfig.access: public`,
and repository/keyword metadata). `npm pack` here produces a tarball with
exactly those files; consumers can install the tarball directly. **Registry
state:** not yet published to npm — the publish *path* is ready:
`.github/workflows/publish.yml` runs the packaging gate plus
`npm publish --dry-run` on every push, and publishes for real only on `v*`
version tags, gated on the `NPM_TOKEN` repository secret (not yet configured;
the workflow skips gracefully with a notice until it is). `private: true`
stays committed in this `package.json` as an accident guard — the tag-gated
job verifies the tag matches `version`, then strips the guard in the
checked-out copy (`npm pkg delete private`) before `npm publish`. The package
is licensed GPL-2.0-or-later (the `license` field is authoritative; there is
no `LICENSE` file in this directory — the repository-root `LICENSE` applies).

