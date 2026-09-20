# DDN 0.3 — Curved relations and shape-preserving routing

**Status: proposed normative contract with a bounded executable reference.** Applies to the ordinary graph renderer. The experimental interaction-lane renderer remains a separate projection. An explicit curved request there fails with `DDN-I031`; it is not silently turned into a curved sequence notation.

## 1. Geometry is independent of meaning

`routing` chooses connector geometry. It MUST NOT change the relation's kind, direction, source/target identities, member endpoints, cardinality, line-family pattern, colour, occurrence identity, or legend-key assignment. A curve is not a new relationship verb. The same model can be projected through straight, orthogonal, or curved views without copied data.

`style.look` is independent: classic, handDrawn, and neo can all display curved paths. `font`, maturity, and authority retain their separate meanings. A precisely drawn curve is not necessarily approved; a sketched curve is not necessarily a draft.

There are three routing values in this release:

| Value | Meaning |
|---|---|
| `straight` | A direct straight segment. It cannot evade an obstacle by silently becoming orthogonal. |
| `orthogonal` | Horizontal/vertical route segments with sharp right-angle bends, except an explicitly requested local crossing jump. |
| `curved` | Cubic Bézier path segments, optionally joined by straight tangent runs. The renderer checks the resulting curve geometry, not just a polygonal plan. |

Perfectly aligned endpoints MAY produce a geometrically straight result even under `curved`. No artificial bow is required when it conveys nothing.

## 2. Reusable policy and view composition

A reusable format concern can contain:

```ddn
format styles {
    layout concept_map {
        algorithm: mindmap;
        routing: curved;
        curve: bezier;
        curve_tension: 0.5;
        crossings: gap;
        gap: 150px;
        row_gap: 100px;
    }
}
```

An existing view selects it with `layout: @styles.concept_map;`. The view can separately identify its root and hierarchy relation kinds. The policy references no copied model. `algorithm: mindmap` and `routing: curved` are independent: selecting the placement algorithm does not silently overwrite an explicitly chosen route geometry.

In a view's `layout` override, authors can instead write:

```ddn
layout {
    routing: curved;
    curve: rounded;
    curve_radius: 36px;
}
```

The `bezier` family prefers a broad cubic from a source port to a destination port with correctly aligned endpoint tangents. When obstacles, labels, self-relations, or explicit guides require a detour, it uses a checked piecewise-cubic corridor spline. The selected strategy is recorded in scene metadata.

The `rounded` family keeps the corridor route but replaces bends with cubic corner transitions. It is deliberately different from a broad mind-map branch. `curve_radius` is a requested maximum corner-rounding reach, clamped by adjacent segment lengths and reduced when needed for clearance. A reduction is recorded; the requested radius is not a promise of a minimum physical radius.

## 3. Per-relation refinement

The same four geometry properties are permitted in an existing view's route hint:

```ddn
route @model.receipt_flow {
    routing: curved;
    curve: bezier;
    curve_tension: 0.6;
}

route @model.foreign_reference {
    routing: orthogonal;
}
```

These are presentation overrides. They do not change the corresponding data declarations. Direct route properties override the shared layout policy for that one appearance. `via` remains an optional rectilinear corridor guide, not a list of Bézier control points. It is rounded after route repair/validation; exact unrounded passage through a bend is not implied by curve mode. A `strict` route policy rejects an unsafe or nonorthogonal guide. General arbitrary control-handle editing is not part of this draft.

| Property | Default | Allowed values |
|---|---|---|
| `layout.routing` | `orthogonal` | `straight`, `orthogonal`, `curved` |
| `layout.curve` | `bezier` | `bezier`, `rounded` |
| `layout.curve_tension` | `0.5` | A finite number greater than zero and no greater than one. |
| `layout.curve_radius` | `32px` | A positive length no greater than 1,000px after unit conversion. |

Curve settings may be retained in a shared policy whose selected routing is currently orthogonal; they take effect only for curved relations. Unknown curve-family names are errors, not approximations to another family's behavior. This release does not claim to implement Mermaid/D3 interpolation names such as `basis` or `catmullRom`.

## 4. Route construction and safety

The reference first creates an obstacle-aware orthogonal corridor and reserves independent ports and label space. Curve construction is a second geometric stage. It tries broad cubics where applicable, then piecewise cubic smoothing with progressively tighter corner reach. It preserves source/target positions and does not silently return a sharp angular route because a requested curve is difficult. A genuinely aligned curve may remain straight.

The renderer MUST check unrelated objects, subdiagram rectangles, labels, independent tracks, endpoint tangents, publication bounds, and crossing clarity after smoothing. Checking only the original orthogonal skeleton is insufficient: a cubic can leave that corridor. Hand-drawn secondary strokes are constrained and leave semantic endpoints and tangent directions exact.

The reference uses adaptive subdivision with a control-hull flatness bound of **0.18 drawing pixels**, protected by geometric clearance. This is a numerical drawing tolerance, not a proof of universally optimal routing. The enterprise scanner independently resamples the exported controls at a tighter flatness threshold. Recursion and search are bounded; capacity exhaustion is diagnosed.

Labels are allocated using the actual curved path, and early callouts avoid likely future branches. A circle remains a lookup key, not a time-order indicator. Request and response remain separate relation IDs and separate routes. A self-relation returns to a separately allocated port on its original object; it is not a new object.

## 5. Curved crossings

Crossings MUST NOT create connectivity. No dot is invented at a curve intersection. The existing `gap`, `bridge`, and `square_bridge` policies apply. Intersections are located from the checked path geometry, rather than assuming every crossing is horizontal against vertical.

For `gap`, the interrupted path is split into actual cubic pieces around the intersection, in addition to any SVG mask. This permits correct appearance when masks are unsupported. Dash phase uses cumulative path distance so a line-family pattern is not restarted at every cut.

For `bridge` and `square_bridge`, the renderer uses the local tangent to orient the jump, attaches it to the actual cut points, and checks that its local geometry does not obstruct an object or label. A square jump is an intentional local angular exception on an otherwise curved route. Jump direction does not indicate priority, authority, or data precedence.

The reference rejects unresolved ambiguous close crossings and unsafe jump placement. Selecting gaps, increasing spacing, or separating a dense view are legitimate remedies. It does not silently paint a junction over the problem. Native bus/trunk junction-network semantics remain outside this release. Declared bus membership via profile `network.basic@1` (spec 40) is notation, not routing geometry.

## 6. SVG and scene contract

SVG path data uses cubic `C` commands and straight `L` commands. Source grammar does not require authors to type these vector coordinates. SVG itself defines these path primitives; DDN supplies routing and semantic rules above them. [S12]

A curved scene route includes:

```json
{
  "routing": "curved",
  "strategy": "direct-bezier",
  "flattenTolerance": 0.18,
  "commands": [
    {
      "kind": "cubic",
      "from": [100, 100],
      "c1": [200, 100],
      "c2": [250, 250],
      "to": [350, 250]
    }
  ]
}
```

This is an excerpt, not a complete scene record. Stable relation ID, endpoint-side information, label bounds, and an adaptively sampled `points` path remain available. `commands` is the canonical analytic shape for a curved route; `points` is an inspection/routing approximation, not a different relationship. The scene schema defines line and cubic command variants. Consumers must not treat sampled sloping segments as orthogonality failures on a route explicitly marked curved.

Endpoint marks are oriented from the exact first/last control tangents, not from a distant box center. Legends, semantic hashes, member references and source navigation remain unchanged. Publication guards include the routed drawing and the final text scale; requesting curved routes does not waive paper readability.

## 7. Diagnostics and regression evidence

| Code | Meaning |
|---|---|
| `DDN046` | Unknown routing/curve family or invalid tension/radius. |
| `DDN220` | No checked curved route and label fit the available geometry. No silent angular downgrade. |
| `DDN221` | Post-curve geometry is ambiguous or interferes with another element. |
| `DDN223` | Curve subdivision exhausted its bounded capacity. |
| `DDN224` | Crossing-jump geometry obstructs an object/label. |
| `DDN-CW01` | A corridor spline replaced the preferred direct curve, or rounding was tightened. Informational, with the selected geometry in the scene. |

Run `npm run test:curves`. The fixtures exercise all three route geometries, both curve families, per-relation overrides, crossovers and dash continuity, source/target identity, style independence, self-relations, obstacle detours, label clearance, deterministic rebuilds, invalid settings and publication guards. They are not a certificate of unrestricted graph-layout quality.

## 8. Examples and implementation acceptance

`examples/17-curved-relations.ddn` contains shared-data classic/handDrawn/neo mind maps, their angular and rounded alternatives, mixed per-relation rules, three crossing treatments, an obstacle example and a request/response/self-action example. `examples/18-routing-comparison.ddn` holds four small paired comparisons. The enterprise responsibility map now uses native mind-map placement with cubic branches.

The website displays actual compiler outputs and links the source, semantic export, and scene. Documentation-only illustrations are labeled separately. Codex implementations should preserve these checks before substituting an external spline or layout library. ELK's separation of edge routing and layout, and Mermaid's interpolation controls, are useful precedents, not claims that DDN bundles either implementation. [S04] [S13]
