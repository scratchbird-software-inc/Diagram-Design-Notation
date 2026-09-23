# Anchored placement, route optimization and low-light palettes

**DDN 0.3.0-draft.2 · proposed implementation contract.** This replaces the separate 0.2 live-companion capability descriptions for current integration. Algorithms are original bounded implementations; no yEd/yFiles code is incorporated.

## Pin and state identity

Only `place @element { at: [x, y]; }` pins an occurrence. Coordinates are the world-space top-left corner. Size alone is not a pin. A pin MUST retain its exact authored coordinates under all patterns, field-detail, style and publication changes. View framing may transform the entire drawing without mutating world coordinates.

The pin focus is the midpoint of the combined bounds of selected pinned elements, after measuring their current content. It is not the mean of top-left coordinates or the bounding box of the entire graph. `center:pins` centres this focus in the drawing area, excluding legend/furniture. A symmetric envelope can add whitespace; it is preferable to moving pins. `center:content` uses ordinary content framing. No-pin views have no invented pinned object.

## Algorithms

| Value | Meaning |
|---|---|
| `auto` | Graph-informed, deterministic layered placement, preserving pins. The omitted-algorithm default. |
| `grid` | Original measured row/column placement; not a ring-centred lattice contract. |
| `manual` | Respect authored placements, with a deterministic placement for unspecified objects. |
| `fit_grid` | Free-element centres on measured grid slots around the fixed core. `grid_step` gives lattice granularity. |
| `circular` | One common ring of free-element centres around pins, expanding for measured boxes. |
| `radial` | Concentric rings from undirected graph distance to the pin set or a deterministic root. |
| `layered` | Directed SCC condensation/ranks. With pin centring, the layer system is fitted around fixed coordinates. |
| `tree` | **Original 0.3 declared-tree semantics**: the source must define a valid tree/hierarchy contract. |
| `spanning_tree` | Deterministic BFS spanning forest for a general graph. Extra relations still render. This is the old live companion's `tree`. |
| `mindmap` | Original 0.3 branching projection rooted by its declared root/relation selection. |
| `grouped` | Original 0.3 grouping/swimlane placement using its grouping contract. |
| `organic` | Fixed-iteration force seed with pins excluded from integration and bounded collision projection. |

Renaming the earlier live value `tree` to `spanning_tree` preserves the stronger original 0.3 `tree` meaning. The migration is explicit: a free-graph spanning layout must not masquerade as proof that the semantic graph is a tree. A layout root does not imply business authority; radial distance and rank do not establish time.

## Parameters and overrides

`auto_place` is boolean (default true). `center` is `pins` or `content`. New pin-centred patterns default to pins; inherited original patterns keep their explicit centre. `grid_step` is a finite length 8–512 CSS px. The pattern gap is 16–2000 CSS px; the engine may enlarge it to honour element dimensions and native port clearance. `direction` is right/down/left/up where the underlying algorithm supports orientation.

## Frame overflow

`layout.frame_overflow` is `expand` (default) or `confine` (RFC-118). It governs view `frame` rects relative to their members.

Under `expand`, the rendered frame rect grows to enclose the member bounding box plus the standard frame padding (20 CSS px left/right, 54 top, 22 bottom — the same padding used for member-derived frames). A declared `at`/`size` rect that already encloses its members is unchanged, so existing diagrams render identically; a member-derived frame is by construction already the expanded rect. Members never escape their frame and nothing is hidden.

Under `confine`, the frame keeps its declared or computed rect. A frame with a declared `at`+`size` defines a fixed interior (the declared rect inset by the standard padding); unpinned members are clamped into that interior during placement — automatically what manual `place` pins achieved — and a member too large for the interior still fails (LIVE-P004). A frame without a declared `at`+`size` is member-computed, so confinement is already satisfied. Pins are never moved; a pinned member outside a fixed frame fails as before. Fixed-frame constraints bind placement only under `confine`; under `expand` the frame grows instead of constraining. Any other value fails DDN046.

## Spacing hints

A view, or a `bundle` inside a format declaration, may carry one optional
`spacing` property. The view value wins over the format value; when both are
absent the hint is `normal`. It is an additive optional enum — an unknown value
is rejected with `DDN033`, and it is not a language version gate.

| Value | Factor | Effect |
|---|---|---|
| `tight` | 0.75 | Compacts inter-node gaps, layer/band spacing and the route-label reservation margin. |
| `normal` | 1.0 | The default. Exactly the historical output; omitting `spacing` is byte-identical to `spacing: normal`. |
| `loose` | 1.4 | Spreads gaps and label bands so long relation labels get room with shorter detours. |
| `expanded` | 2.0 | Maximum spread. |

The factor multiplies the inter-node horizontal/vertical gaps (`gap`,
`row_gap`, including the pin-pattern pitch), the layer/band spacing derived from
them, and the route-label reservation margins (8/10 px at `normal`), rounded
through the renderer's numeric helper. Node body sizes, font sizes, glyph sizes
and the fixed canvas furniture never scale. `spacing` is a **graph-family
hint**: fixed-grid projections (chart, matrix, panels, table, timeline,
fishbone, decision, sequence, timing) ignore it entirely — `check()` emits no
warning, because ignoring it is the documented behavior. Factors are literal
constants; the renderer stays deterministic.

```ddn
format layouts {
    layout orbit {
        algorithm: circular;
        center: pins;
        auto_place: true;
        routing: curved;
        crossings: gap;
        gap: 100px;
    }
    bundle roomy { layout: @orbit; spacing: loose; }
}
```

A view uses `layout:@layouts.orbit;`. Placement, appearance and publication stay separate from semantic data. Relative frames and explicit routing guides remain constraints; under `frame_overflow: confine`, infeasible rings inside fixed frames fail rather than silently overflowing.

## Pause and reflow

Paused free positions are remembered **view state**, not inserted source pins. A first render with no state requires one initial placement/route optimization. Subsequent paused renders retain those free positions, seed only genuinely new nodes, and preserve authored pins over stale remembered state. Size changes can expose collisions and are reported. Re-enabling placement releases remembered free positions.

`layoutState` has format `ddn-layout-state@1`, an exact `entry#view` scope and finite bounded coordinates by stable identity. State from another view is rejected. Deleting an element does not leave a ghost node. Saved source workspaces may include paused state; semantic identities and source coordinates are still distinct.

## Optimization priority

1. Measure actual visible content; place the graph under hard constraints and the selected pattern.
2. Compute native object-clear routes. Try permitted source/destination attachment sides before moving objects. Named field/port identity, side constraints and explicit fractions survive.
3. If crossings remain, try bounded free-node swaps in legal pattern slots. Circle/radial nodes stay on their ring; lattice centres stay on the grid; layers stay in their level. Retained or pinned nodes do not move.
4. Prefer short routes with few bends, permit sensible residual X crossings, and render the registered nonconnection gap or jump. Do not invent junctions from geometry.

The implementation evaluates limited candidate routes and graph moves, accepts crossing reductions under a path-length bound, and reports stage telemetry. Exact per-relation routes can constrain global curve choices. Broad curves that violate clearance are tightened or rejected; no invalid path is published as valid. Existing 0.3 native route, label, crossing and publication checks stay active.

Some graph topologies cannot be drawn without crossings. The solver does not prove global minimality and may reject an input another algorithm could place. Independent straight segments, curved/rounded paths, port-entry conventions, label clearance and glyph sizes have separate checks. Successful SVG generation is not a legibility certificate.

## Low-light presentation

| Role | Dark | Night |
|---|---|---|
| Canvas | `#202C3E` | `#2D3B50` |
| Card / label surface | `#2A3A50` | `#394B63` |
| Main text | `#EDF3FC` | `#F1F5FC` |

Registered semantic colours use deterministic lighter variants against these grey-blue surfaces. Connectors, arrowheads, cardinalities, badges, outlines and legends use the same palette policy. Style remains classic/handDrawn/neo independently. The fixed patterns, icons and endpoints preserve relation meaning without requiring colour perception.

Numerical colour contrast can be tested against the generated solid colours. This is not proof of readability after arbitrary downscaling, complete accessibility conformance, or universal font substitution.
