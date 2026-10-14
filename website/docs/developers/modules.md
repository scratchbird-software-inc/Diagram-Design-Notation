# Modules and bundles

The runtime is split into loadable pieces so pages can load only what
they use. Sources are ES modules and the build uses Rollup
(`tools/rollup.config.mjs`, pinned `rollup` + `@rollup/plugin-terser`
devDependencies — the runtime itself still has zero runtime dependencies). All
bundles live in `notation/dist/` and are rebuilt deterministically by
`npm run build:sdk` (`tools/build-sdk.js`); the numbers below are the
current build from `release/validation/sdk-build.json` (0.8.0).

## Bundle table

Every bundle ships three formats: readable browser IIFE (`.js`), ES module
(`.mjs`), minified IIFE with source map (`.min.js` + `.min.js.map`).

| Bundle | Contains | Requires loaded first | .js bytes | .mjs bytes | .min.js bytes | .min.js gzip |
|---|---|---|---|---|---|
| `ddn-core.js` / `.mjs` / `.min.js` | Parse/build/validate/export plus the workspace API (no rendering). | — | 1318784 | 1305995 | 1067230 | 235266 |
| `ddn-graph.js` / `.mjs` / `.min.js` | Graph renderer (ERD/flow/native layout, routing, interaction). Registers the "graph" projection kind. | ddn-core.js | 503379 | 496625 | 373291 | 97693 |
| `ddn-quality.js` / `.mjs` / `.min.js` | Quality renderers (quality charts, decision tables, fishbone). Registers the "fishbone" and "decision" kinds; they compose through ddn-projections.js. | ddn-core.js + ddn-graph.js | 25030 | 24479 | 18413 | 7987 |
| `ddn-projections.js` / `.mjs` / `.min.js` | Data-bound projections: chart/matrix/panels/timeline/table/sequence/timing/chen. | ddn-core.js + ddn-graph.js | 105504 | 103757 | 83495 | 30605 |
| `ddn-geo.js` / `.mjs` / `.min.js` | Optional geographic module: map projections, GeoJSON ingestion, choropleth/symbol/outline rendering. Registers the "geo" kind (optional: visible placeholder when absent). | ddn-core.js + ddn-graph.js | 24711 | 24064 | 16538 | 6979 |
| `ddn-iso.js` / `.mjs` / `.min.js` | Optional isometric module: axonometric 30° projection, face shading, chart extrusions (bar/pie/donut/area/treemap) and iso graph prisms (optional: visible placeholder when absent). | ddn-core.js + ddn-graph.js | 23739 | 23118 | 14568 | 6086 |
| `ddn.global.js` / `.mjs` / `.min.js` | All-in-one: every bundle above except the optional ddn-geo and ddn-iso, plus the Studio web component. Unchanged name and behavior; this is what the test suites and standalone pages embed. | — | 1790015 | 1769004 | 1406802 | 349818 |

The `.mjs` files are real ES modules (named exports for the live API and the
internal namespaces); non-core `.mjs` files import their prerequisites
automatically, and the package `sideEffects` annotation (`["dist/*.js"]`)
lets downstream bundlers tree-shake them. Tree-shaking behavior is exercised by `notation/tests/esm-dist.js`; use the
generated bundle inventory for current sizes.

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
<script src="notation/dist/ddn-iso.js"></script>          <!-- optional: isometric depth (iso/depth views) -->
```

Under Node, `require("@ddn/notation/core")`, `…/graph`, `…/projections`,
`…/quality`, `…/geo`, `…/iso` apply the same registration in the same order (see the
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
`geography: @data.record` (self-contained files, ethos). Rendering is
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

## The optional isometric module (ddn-iso)

`ddn-iso` is the seventh bundle and the second **optional** one — same
contract as ddn-geo: never embedded in `ddn.global.js`, loaded only on demand.
It adds axonometric ("2.5D") depth to the existing `graph` and `chart` kinds —
it registers no projection kind of its own:

- `iso: true` on a view switches it to the isometric treatment; `depth: <px>`
  (default `0` = flat, `18` when `iso: true` sets no explicit depth) is the
  extrusion thickness.
- `depth: "x_record.load"` binds per-record depth (the chart binding idiom);
  `depth: @data.record.field` binds one record's field as the view depth — the
  host grows/shrinks heights by pushing data with `ws.replaceData(...)` and
  re-rendering, passing `renderSync({isoFrom:{depths}})` with the previous
  committed depths to get a declarative SMIL transition (250 ms; `noMotion`
  strips it for print).
- Per-object `depth:` on data-block objects overrides the view depth (building
  heights differ).
- Stage 1 charts: extruded bar columns, pie/donut thickness, area ribbon,
  treemap blocks. Axis labels and grid stay flat-overlayed.
- Stage 2 graphs (`iso: true` on a `graph` view): nodes render as extruded
  prisms on an iso ground plane with labels on the top face; relations are
  routed flat by the ordinary engine and then **projected onto the ground
  plane** (routing is never computed in 3D); endpoints attach at the prism
  top-face centres.

Projection math (D2): `sx=(x−y)·cos30°`, `sy=(x+y)·sin30°−z`; face shading
top = base, left = ×0.85, right = ×0.7 (`DDNIso.shade`); painter's-algorithm
z-order is a total order (footprint `x+y`, then height, then element id) so
renders are deterministic. Colour-by-value stays with the existing chart/geo
colour mechanisms and refresh overrides — ddn-iso does not add a second colour
system.

Missing module (D1): an `iso: true` view rendered without `ddn-iso.js` shows
the visible placeholder "Isometric view requires ddn-iso.js" plus the coded
`DDN-E010` diagnostic; a `depth` property without the module degrades to the
flat render plus a coded warning — never a crash. Validation codes:
`DDN-ISO150` (iso must be boolean; iso/depth only on graph/chart),
`DDN-ISO151` (depth form), `DDN-ISO152` (binding must resolve to a finite
0..2000 number), `DDN-ISOW01` (unsupported mark renders flat; depth on a graph
without `iso: true`), `DDN-ISOW02` (frames/subdiagrams omitted in iso graph
views). Verified in `notation/tests/iso.js`; demo:
`examples/embed/iso-load-monitor.html`.

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
  above) — an owner-directed exception to the hard throw, mirrored by
  `iso: true` views without `ddn-iso.js` ("Isometric view requires
  ddn-iso.js"). A `depth` property without ddn-iso.js degrades to the flat
  render plus a coded `DDN-E010` warning on the diagnostics channel.

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
- Pages with isometric depth (2.5D charts, iso diagram prisms): add
  `ddn-iso.js`; without it, `iso: true` views show the placeholder and
  `depth`-only views render flat with a diagnostic.
- Anything else, or when in doubt: `ddn.global.js`.
