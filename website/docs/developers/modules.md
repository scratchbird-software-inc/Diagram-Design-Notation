# Modules and bundles

B1-004 split the runtime into loadable pieces so pages can pay only for what
they use; B1-019 moved the sources to real ES modules and the build to Rollup
(`tools/rollup.config.mjs`, pinned `rollup` + `@rollup/plugin-terser`
devDependencies — the runtime itself still has zero runtime dependencies). All
bundles live in `notation/dist/` and are rebuilt deterministically by
`npm run build:sdk` (`tools/build-sdk.js`); the numbers below are the
current build from `release/validation/sdk-build.json` (0.6.0-beta.1).

## Bundle table

Every bundle ships three formats: readable browser IIFE (`.js`), ES module
(`.mjs`), minified IIFE with source map (`.min.js` + `.min.js.map`).

| Bundle | `.js` bytes | `.min.js` (gzip) | Provides | Load after |
|---|---:|---:|---|---|
| `ddn-core` | 644,384 | 556,499 (120,672) | Parse, resolve, validate (`createWorkspace`, `parse`, `resolve`, `analyze`, authoring, io). No rendering. | — |
| `ddn-graph` | 146,146 | 104,829 (38,933) | Graph-family rendering: layout, routing, shapes, palettes, interaction validation. | `ddn-core.js` |
| `ddn-projections` | 52,224 | 42,708 (16,962) | Fixed-grid projections: chart, matrix, panels, table, timeline, sequence, timing, chen. | `ddn-graph.js` |
| `ddn-quality` | 20,469 | 15,633 (7,022) | Quality charts, fishbone causes, decision/rule-table rendering. | `ddn-graph.js` (renders through `ddn-projections.js`) |
| `ddn.global` | 884,121 | 743,085 (188,182) | All of the above plus the web component — one file, nothing to order. | — |

The `.mjs` files are real ES modules (named exports for the live API and the
internal namespaces); non-core `.mjs` files import their prerequisites
automatically, and the package `sideEffects` annotation (`["dist/*.js"]`)
lets downstream bundlers tree-shake them. A consumer bundling only the
check-level API from `ddn-core.mjs` emits ≈640 KB instead of ≈876 KB for the
all-in-one (measured by `notation/tests/esm-dist.js`).

Each modular bundle is additive: it registers itself with the previously
loaded bundles (`DDNLive.runtime` records which pieces are present;
presence-tolerant construction means a missing later piece is `null`, never an
import error).

## Load order

Order is mandatory — every later bundle attaches to the earlier ones:

```html
<script src="notation/dist/ddn-core.js"></script>
<script src="notation/dist/ddn-graph.js"></script>        <!-- needed to render graph-family views -->
<script src="notation/dist/ddn-projections.js"></script>  <!-- needed for chart/matrix/panels/… views -->
<script src="notation/dist/ddn-quality.js"></script>      <!-- needed for quality/fishbone/decision views -->
```

Under Node, `require("@ddn/notation/core")`, `…/graph`, `…/projections`,
`…/quality` apply the same registration in the same order (see the `exports`
map in `notation/package.json`).

## DDN-E010 behavior

Calling a capability whose bundle is not loaded never silently degrades: the
runtime throws `DDN-E010` with a message naming the missing file and where to
load it. Verified behaviors (`notation/tests/modular-bundles.js`):

- Core alone parses and checks: `ws.resolve(...)` returns the resolved model,
  but `ws.renderSync(...)` throws `DDN-E010` naming `ddn-graph.js`.
- Core + graph renders graph-family views byte-identically to
  `ddn.global.js`, but chart projections throw `DDN-E010` naming
  `ddn-projections.js`.
- Quality/fishbone/decision views without `ddn-quality.js` throw `DDN-E010`
  naming `ddn-quality.js`.
- `exportVegaLite` without `ddn-projections.js` throws `DDN-E010` naming
  `ddn-projections.js`.

Working single-page proofs ship in `website/examples/embed/core-only-check.html`
(core-only) and `website/examples/embed/core-graph.html` (core + graph).

## Choosing a bundle

- Validation tooling, editors, linters: `ddn-core.js` only.
- Documentation sites rendering ERD/flow/UML graphs: core + graph.
- Dashboards with charts/matrices: add `ddn-projections.js` (and
  `ddn-quality.js` for quality views).
- Anything else, or when in doubt: `ddn.global.js`.
