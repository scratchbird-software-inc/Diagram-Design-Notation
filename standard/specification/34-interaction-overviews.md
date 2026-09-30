# 34. Interaction overviews (profile `uml.interaction_overview@1`)

Status: implemented in runtime 0.7.0. Source grammar
remains DDN 0.5; the extension value is a record of atoms, so this is a
semantic/registry addition, not a grammar change.

An interaction overview is a flowchart on the existing `graph` projection in
which some flow nodes stand for whole interaction diagrams kept in their own
views of the same workspace. A node becomes a *ref node* by carrying the
registered extension property `x_subdiagram:{view:"<local view id>"}` and
renders with a small "↗ ref" badge at its top-right corner.

This is profile-level coverage, not UML conformance.

## Metamodel

- **Node vocabulary:** `flow.start` / `flow.end` / `flow.process` /
 `flow.decision`. Edges are `flow.next`. All existing vocabulary; no new
 kinds or verbs.
- **Ref nodes:** a `flow.process` or `flow.subprocess` object carrying
 `x_subdiagram:{view:"<name>"}`. The contract is
 `{ "type": "object", "required": ["view"], "properties": { "view": { "type": "string", "minLength": 1 } }, "additionalProperties": false }`
 on the `object` target; a malformed value (for example `x_subdiagram:{}`)
 fails the extension contract as `DDN105`.
- **The string-reference rule:** `x_subdiagram.view` is a plain STRING naming
 the target view's local id in the same workspace — NOT a `@`-reference.
 This is deliberate: `resolveValue` turns `@ref` values into `{$ref}` at
 build time and fails the build on unresolvable refs, which would preempt
 the dedicated missing-view diagnostic and make `DDN-PJ119` unreachable. The
 string defers resolution to a workspace-level check in `build`
 (`ddn-core.js`), which matches the name against every view's local id and
 uid. Profile validators receive only `ir` and cannot see other views, which
 is why the check lives in `build` beside the panels child-view checks.
- **No inline expansion:** the referenced view is NOT expanded into the
 overview by this profile — reference semantics only. Composed rendering is
 owned by `panels.composed@1`; the view-level
 `subdiagram … { mode: reference|inline }` declaration (chapter on
 subdiagrams, example `08-subdiagrams.ddn`) is unchanged and remains
 available for floating reference boxes.
- **Endpoint rule:** `flow.next`'s endpoint contract lists `flow.*` kinds
 only, so an `x_subdiagram` node of a non-`flow.*` kind used as a
 `flow.next` endpoint fails with the existing `DDN102`. Ref nodes are
 therefore `flow.process` (or `flow.subprocess`) objects.

## Diagnostics

- `DDN-PJ119` (error) — an `x_subdiagram.view` string names no view in the
 workspace. The message names the node and the missing view id.
- `DDN105` — malformed `x_subdiagram` record (missing `view`, empty string,
 or extra properties).
- `DDN102` — a ref node outside the `flow.*` endpoint contract used as a
 `flow.next` endpoint.

## Visual encoding

Ref nodes render as ordinary flow nodes plus a small "↗ ref" badge at the
node's top-right corner, drawn with the shared `badge` helper in the theme
accent/surface colours — echoing the view-level subdiagram badge style
("↗ target · diagram reference"). Layout, routing and every other rendering
rule are exactly the graph projection's; the renderer stays deterministic.

## Source example

```ddn
data checkout {
 object pay "Pay" { kind: "flow.process"; x_subdiagram: { view: "payment_flow" }; }
}

view overview "Checkout interaction overview" {
 data: [@checkout];
 projection { kind: graph; profile: "uml.interaction_overview@1"; }
}

view payment_flow "Payment flow detail" {
 data: [@payment];
 projection { kind: graph; profile: "ddn@1"; }
}
```

See `website/examples/basics/48-interaction-overview.ddn` for the full synthetic
checkout example (overview plus `payment_flow` and `stock_flow` detail views
in one file).

# 34a. Interaction overviews at uml.interaction_overview@2

`uml.interaction_overview@2` adds inline expansion and interaction-use
detail; @1 stays installed and immutable.

- **Inline expansion** — a node with `x_subdiagram.view` renders the
 referenced view inline inside the node box (one recursion level; child
 limits shared with panels — `DDN-PJ174`); the badge reads `↗ inline`.
- **Interaction-use gates/arguments** — `x_use: { arguments?: [string],
 gates?: [string] }` renders arguments under the node and named gate squares
 on its left border; duplicate gate names are `DDN-PJ174`.

Fixture: `website/examples/basics/81-uml-remainder.ddn` (view `overview`).

# 34b. Drill-down display modes and frozen thumbnails (x_subdiagram v2)

Status: implemented in runtime 0.7.0. Additive
properties on the `x_subdiagram` contract; the display-absent behavior of
this chapter (badge here, legacy inline at `uml.interaction_overview@2`) is
byte-identical.

Any node binding a detail view with `x_subdiagram` may declare
`display: "badge" | "inline" | "thumbnail"`:

- **badge** — the `↗ ref` badge only (default outside
 `uml.interaction_overview@2`).
- **inline** — a live, full-fidelity child render inside the node (the
 interaction-overview form, available on any node).
- **thumbnail** — a live child rendered in *shapes detail*: silhouettes,
 edges, frames and ports with every text run suppressed (child chrome,
 relation labels and node text are all omitted; node `<title>` accessibility
 metadata remains). Thumbnails never hit the DDN076 minimum-text failure
 because no text is emitted.

`frozen: true` (thumbnails only) embeds a stored `snapshot` SVG verbatim
through the same `io-<hash>-` namespacing pass — the viewer never re-renders
a frozen child. The host refreshes it by rewriting the `snapshot` property
through the ordinary source transaction (the replaceData precedent);
`snapshot_at` carries an optional string timestamp. Shape rules validate as
`DDN-PJ198` (snapshot required, must parse as SVG, ≤ 512 KiB, one nesting
level, no self-binding); unknown target views stay `DDN-PJ119`.

See `website/examples/basics/90-drilldown.ddn` and
`notation/tests/thumbnail-compliance.js`.
