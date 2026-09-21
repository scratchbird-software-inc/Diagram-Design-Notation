# 34. Interaction overviews (profile `uml.interaction_overview@1`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-108
(`standard/governance/rfcs/RFC-108-interaction-overview.md`). Source grammar
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
  string defers resolution to a workspace-level check in `build()`
  (`ddn-core.js`), which matches the name against every view's local id and
  uid. Profile validators receive only `ir` and cannot see other views, which
  is why the check lives in `build()` beside the panels child-view checks.
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
node's top-right corner, drawn with the shared `badge()` helper in the theme
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
