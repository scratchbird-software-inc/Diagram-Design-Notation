# 43. Isometric depth (optional ddn-iso module)

Status: implemented in runtime 0.6.0-beta.1 (B1-034; multi-series quality
charts B1-036). Source grammar remains
DDN 0.5; views without `iso`/`depth` render byte-identical SVG to previous
releases. Scope: `graph` and `chart` projections. All rendering is pure SVG —
no WebGL, canvas or 3D engine.

## Optional module (D1)

Isometric depth ships as the optional seventh bundle `dist/ddn-iso.js`
(readable IIFE, `.min.js` + source map, `.mjs`, type copies; npm subpath
`@ddn/notation/iso`). It is never part of `ddn.global.js`. The module publishes
the `DDNIso` namespace and registers no projection kind; the engine routes
`iso: true` views through it. Missing module, never silent:

- an `iso: true` view renders a visible inline placeholder ("Isometric view
  requires ddn-iso.js") plus the coded `DDN-E010` diagnostic — the same
  owner-directed exception path as the geographic module (B1-025);
- a `depth` property without the module degrades to the flat render plus a
  coded `DDN-E010` warning on the diagnostics channel — never a crash.

## Notation (D3)

View/projection level, on `graph` and `chart` projections only:

| Property | Values | Default |
|---|---|---|
| `iso` | `true` \| `false` | `false` |
| `depth` | length (px) 0..2000, `"x_record.field"` per-record binding, or `@data.record.field` | `0` (flat); `18` when `iso: true` sets no explicit depth |

Per-element `depth:` on a data-block object overrides the view depth for that
object (building heights differ); the default inherits the view depth. The
per-object property is registered in `standard/registry/data-properties.json`.
Invalid forms raise `DDN-ISO150` (iso not boolean; iso/depth on other kinds),
`DDN-ISO151` (depth form) or `DDN-ISO152` (binding does not resolve to a
finite 0..2000 number).

```ddn
ddn "0.5";
module "example.iso";

data tiers {
    object web "Web" { kind: record; depth: 26px; x_record: { tier: "Web", value: 420, load: 26, unit: "req/s" }; }
    object api "API" { kind: record; x_record: { tier: "API", value: 610, load: 34, unit: "req/s" }; }
}

view iso_bar "Iso bar" {
    data: [@tiers];
    projection { kind: chart; profile: "chart.basic@1"; records: [@tiers.web, @tiers.api]; mark: bar; x: "x_record.tier"; y: "x_record.value"; unit: "req/s"; iso: true; depth: "x_record.load"; }
}
```

## Projection math and shading (D2)

Axonometric projection at 30°: `sx=(x−y)·cos30°`, `sy=(x+y)·sin30°−z`. Pure
functions, unit-tested against independently computed reference values
(`notation/tests/iso.js`). Face shading derives from the base colour: top =
base, left = ×0.85, right = ×0.7 (`DDNIso.shade`). Painter's-algorithm z-order
is a total order — footprint `x+y`, then height, then element id — so the same
input always yields the same SVG (D7).

## Stage 1 — chart extrusions (D4)

With `iso: true` or `depth` > 0, the bar (columns), pie/donut (thickness
walls), area (ribbon) and treemap (blocks) marks extrude; each mark is the
flat face plus top/front/side faces. Axis labels and grid stay flat-overlayed.
Other marks warn (`DDN-ISOW01`) and render flat.

Multi-series views (`series:`/`arrangement:` on `chart.quality@1`) plan through
the quality renderer; the same extrusion applies there (B1-036): one column per
series point for bar layers, one ribbon per series for area layers. Each series
sits on its own depth plane — geometry translated by `li·depth` along the
extrusion vector — so coincident faces never z-fight, and all marks emit in one
total painter's order (`DDNIso.paintOrder`: depth plane back-to-front, then
footprint x, then stack level, then source id). Quality transforms (histogram,
pareto, waterfall, boxplot) and unsupported layer marks (line/point) warn
`DDN-ISOW01` and render flat. The absent-module degradation is unchanged:
`iso: true` → visible placeholder plus `DDN-E010`; depth-only → flat render
plus a `DDN-E010` warning.

## Stage 2 — iso diagram nodes (D5)

`iso: true` on a graph view renders nodes as extruded prisms on an isometric
ground plane, labels on the top face (kept horizontal for legibility).
Relations are routed flat by the ordinary engine and the resulting 2D route
points are then projected onto the ground plane — routing is never computed in
3D; endpoints attach at prism top-face centres. Frames and subdiagrams are
flat-view devices and are omitted in iso graph views (`DDN-ISOW02`).

## Refresh-driven depth transitions (D6)

Keyed refresh (`ws.replaceData`, B1-029) of a bound depth field re-renders with
the new heights; a same-values refresh re-renders byte-identical. Hosts pass
the previous committed depths as `renderSync({isoFrom:{depths}})` and ddn-iso
emits a declarative one-shot SMIL `<animate>` (250 ms, ≤300 ms) per changed
face; `noMotion` strips animation for print/static targets. Demonstrated by
`examples/embed/iso-load-monitor.html` (synthetic load monitor).

## Colour binding (D3)

Colour-by-value stays with the existing chart/geo colour mechanisms and host
refresh overrides (`renderSync({overrides})`); ddn-iso deliberately does not
add a second colour system.

## Limits

The bundle targets ≤20 KB minified (actual: see `dist/README.md`). Depth is
bounded to 0..2000 px. Extrusion is illustrative depth, not measured 3D
geometry; quantitative values remain encoded by the flat mark geometry.
