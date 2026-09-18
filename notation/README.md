# @ddn/notation — DDN reference runtime

Pure-JavaScript (ES2022+) reference implementation of the Data Design
Notation language: **parse → validate → lay out → render deterministic SVG**.
Zero runtime dependencies; runs in Node 22+ and browsers. Implements
`standard/` (the specification, grammar, schemas, and vocabulary registry).

## Layout

- `runtime/` — the modules: `ddn-core.js` (lexer/parser, workspace
  resolution, resolved IR), `ddn-contracts.js` (registry/ERP validation),
  `ddn-layout.js` (placement + orthogonal/curved routing), `ddn-render.js`
  + `ddn-engine.js` (SVG renderer/dispatcher), `ddn-sketch.js` (seeded
  hand-drawn style), `ddn-export.js` (publication projection),
  `ddn-shapes.js`, `ddn-palette.js`, `ddn-profiles.js`, `ddn-projections.js`,
  quality modules, and `ddn-interaction.js`.
- `cli/cli.js` — `check | render | resolve <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR]`
  (enforces workspace containment; rejects symlink escapes and remote imports).
- `studio/` — browser Studio (source-first editor) and portable editor.
- `adapters/vega-lite/` — optional Vega-Lite export adapter (not in the runtime bundle).
- `dist/` — shipped single-file build (`ddn.global.js`, `ddn.mjs`, `ddn.d.ts`),
  committed so Studio and examples work without a build step. Regenerate with
  `npm run build:sdk`.
- `tests/` — node suites: 150 core fixtures, 0.3 regressions, curved
  relations, patterns, projections, quality, use-cases, SDK, endpoint
  ordering, routing efficiency.

## Usage

```sh
npm test                                   # all suites
npm run build:sdk                          # rebuild dist/ from runtime/ + studio/src
node cli/cli.js check ../examples/basics/01-customer.ddn --workspace ..
```

All public output goes through the export/profile machinery — hiding is not
redaction. History before the monorepo import is in `CHANGELOG.md`.
