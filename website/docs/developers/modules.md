# Modules and bundles

B1-004 split the runtime into loadable pieces so pages can pay only for what
they use. All bundles live in `notation/dist/` and are rebuilt deterministically
by `npm run build:sdk` (`tools/build-sdk.js`); the numbers below are the
current build from `release/validation/sdk-build.json` (0.6.0-beta.1).

## Bundle table

| Bundle | Bytes | Provides | Load after |
|---|---:|---|---|
| `ddn-core.js` | 624,500 | Parse, resolve, validate (`createWorkspace`, `parse`, `resolve`, `analyze`, authoring, io). No rendering. | — |
| `ddn-graph.js` | 142,120 | Graph-family rendering: layout, routing, shapes, palettes, interaction validation. | `ddn-core.js` |
| `ddn-projections.js` | 49,607 | Fixed-grid projections: chart, matrix, panels, table, timeline, fishbone, decision. | `ddn-graph.js` |
| `ddn-quality.js` | 18,063 | Quality charts, fishbone causes, decision/rule-table rendering. | `ddn-projections.js` |
| `ddn.global.js` | 862,095 | All of the above plus the web component — one file, nothing to order. (206,731 bytes gzipped.) | — |

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

Working single-page proofs ship in `examples/embed/core-only-check.html`
(core-only) and `examples/embed/core-graph.html` (core + graph).

## Choosing a bundle

- Validation tooling, editors, linters: `ddn-core.js` only.
- Documentation sites rendering ERD/flow/UML graphs: core + graph.
- Dashboards with charts/matrices: add `ddn-projections.js` (and
  `ddn-quality.js` for quality views).
- Anything else, or when in doubt: `ddn.global.js`.
