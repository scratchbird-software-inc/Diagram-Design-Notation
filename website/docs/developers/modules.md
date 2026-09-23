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
| `ddn-core` | 680,026 | 586,662 (130,574) | Parse, resolve, validate (`createWorkspace`, `parse`, `resolve`, `analyze`, authoring, io). No rendering. | — |
| `ddn-graph` | 146,951 | 105,209 (39,045) | Graph-family rendering: layout, routing, shapes, palettes, interaction validation. | `ddn-core.js` |
| `ddn-projections` | 89,652 | 73,979 (27,241) | Fixed-grid projections: chart (basic marks plus the Category-2 pack — distributions, tree, grid, network families and statistical overlays), matrix, panels, table, timeline, sequence, timing, chen. | `ddn-graph.js` |
| `ddn-quality` | 20,469 | 15,633 (7,022) | Quality charts, fishbone causes, decision/rule-table rendering. | `ddn-graph.js` (renders through `ddn-projections.js`) |
| `ddn-geo` | 23,771 | 16,201 (6,841) | **Optional** geographic module: mercator/equirectangular/albers/equal-earth projection math, GeoJSON ingestion, choropleth/symbol/outline map rendering. Registers the `geo` kind with `optional: true`. | `ddn-graph.js` |
| `ddn.global` | 957,996 | 805,100 (208,228) | All of the above **except** the optional `ddn-geo`, plus the web component — one file, nothing to order. | — |

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
<script src="notation/dist/ddn-geo.js"></script>          <!-- optional: geographic (map) views -->
```

Under Node, `require("@ddn/notation/core")`, `…/graph`, `…/projections`,
`…/quality`, `…/geo` apply the same registration in the same order (see the
`exports` map in `notation/package.json`).

## The optional geographic module (ddn-geo)

`ddn-geo` is the sixth bundle and the only **optional** one: it is never
embedded in `ddn.global.js` and never loaded unless a page asks for it. It
contains pure-math projections (`mercator`, `equirectangular`, `albers`,
`equalEarth`), GeoJSON ingestion (`Feature`/`FeatureCollection`;
`Polygon`/`MultiPolygon`/`Point`/`MultiPoint`), and the
choropleth/symbol/outline renderers behind the `geo.choropleth@1`,
`geo.symbols@1` and `geo.outline@1` profiles. `DDNGeo.geoPath` and
`DDNGeo.projections` are exposed so hosts can feed their own geometry
(including contour polygons) through the same path generation.

Geography data is separate from the bundles: `assets/geo/world-110m.json`
(Natural Earth 110m country boundaries, ~96 KB, inside the ~100 KB budget,
built by `tools/build-geo-assets.mjs`) is an optional asset file. A view names
it with `geography:"assets/geo/world-110m.json"` or binds inline GeoJSON with
`geography: @data.record` (self-contained files, RFC-117 ethos). Rendering is
synchronous, so URL/name geographies must be registered by the host first:
`DDNGeo.registerGeography(name, geojson)` (fetch first, register, re-render).
The reference CLI pre-registers `assets/geo/world-110m.json` under both that
repo-relative name and `world-110m`.

### Placeholder behavior (graceful missing, never silent)

The `geo` kind is registered with `optional: true`. Rendering a geo view
without `ddn-geo.js` does **not** throw: the page renders with an inline
placeholder box — "Map view requires ddn-geo.js" — and the coded `DDN-E010`
diagnostic (severity `error`) still surfaces through the diagnostics channel.
Planning (`ws.projectionPlan`) stays a hard `DDN-E010`, and every other kind
keeps the hard throw below. Verified in `notation/tests/geo.js` and
`notation/tests/modular-bundles.js`.

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
- Geo views without `ddn-geo.js` render the visible placeholder box and
  surface the coded `DDN-E010` through diagnostics (see the ddn-geo section
  above) — the one owner-directed exception to the hard throw.

Working single-page proofs ship in `website/examples/embed/core-only-check.html`
(core-only) and `website/examples/embed/core-graph.html` (core + graph).

## Choosing a format

- **Production embeds:** load the minified IIFEs (`.min.js`). They publish the
  same globals with the same guards and `DDN-E010` behavior as the readable
  `.js` files at a fraction of the bytes — the `website/examples/embed/`
  proof pages use them.
- **Modern bundlers / module pages:** import the `.mjs` builds (named
  exports for the live API and the internal namespaces; prerequisites load
  automatically; tree-shakeable). Browsers refuse ES-module imports over
  `file://` (CORS) — serve the page over any static server; see
  `website/examples/embed/esm-module.html`.
- **Debugging:** the readable `.js` IIFEs stay in dist alongside the maps
  (`.min.js.map`) for the minified builds.

## Choosing a bundle

- Validation tooling, editors, linters: `ddn-core.js` only.
- Documentation sites rendering ERD/flow/UML graphs: core + graph.
- Dashboards with charts/matrices: add `ddn-projections.js` (and
  `ddn-quality.js` for quality views).
- Pages with geographic maps: add `ddn-geo.js` and register the geography
  asset (see above); without it, map views show the placeholder, not a crash.
- Anything else, or when in doubt: `ddn.global.js`.
