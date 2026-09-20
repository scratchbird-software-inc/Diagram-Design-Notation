# RFC 108 — Interaction overview profile (`uml.interaction_overview@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile uml.interaction_overview@1; extension x_subdiagram

## Problem and motivating example

Large interactions need a map: a high-level flow in which some steps stand
for whole interaction diagrams kept in their own views. DDN 0.5 already has
the flow vocabulary (`flow.start`/`flow.end`/`flow.process`/`flow.decision`,
edges `flow.next`) and a *view-level* `subdiagram` declaration that places a
floating reference box on a canvas. What is missing is a *node-level*
analogue: an ordinary flow node that itself references another view of the
same workspace, so the overview reads as a flowchart, not as a canvas with
detached boxes.

Motivating example: a synthetic checkout overview. The flow runs
start → browse → pay → ship → end, where the `pay` step stands for a
`payment_flow` detail view and the `ship` step stands for a `stock_flow`
detail view, both declared in the same file. Today the author can only draw
the overview and the details as unrelated views, with nothing on the overview
nodes saying "this step is expanded elsewhere".

## Proposed syntax

No grammar change. The extension value is a record of atoms
(`property = identifier ":" value ";"` with a record value), which parses
today under the existing extension-property rules.

- New profile `uml.interaction_overview@1` bound to the existing projection
  `graph`.
- New registered extension property `x_subdiagram` on objects:
  `{ "type": "object", "required": ["view"], "properties": { "view": { "type": "string", "minLength": 1 } }, "additionalProperties": false }`.

```ddn
data checkout {
    object pay "Pay" { kind: flow.process; x_subdiagram: { view: "payment_flow" }; }
}

view overview "Checkout overview" {
    data: [@checkout];
    projection { kind: graph; profile: "uml.interaction_overview@1"; }
}

view payment_flow "Payment detail" {
    data: [@checkout];
    projection { kind: graph; profile: "ddn@1"; }
}
```

No new kinds or verbs; no new projection properties; `standard/grammar/ddn.ebnf`
is untouched.

## Semantic normalization and identity effects

- Overview nodes are `flow.start`/`flow.end`/`flow.process`/`flow.decision`;
  edges are `flow.next`. All existing vocabulary.
- A *ref node* is a `flow.process` or `flow.subprocess` object carrying
  `x_subdiagram:{view:"<local view id>"}`. The string names a `view`
  declaration visible in the same workspace, matched against each view's
  local id (and uid).
- **The value is a plain string, not a `@`-reference.** This is a verified
  design constraint: `resolveValue` turns `@ref` values into `{$ref}` at
  build and *fails the build* on unresolvable refs, which would preempt the
  profile-level missing-view diagnostic and make `DDN-PJ119` unreachable. A
  string defers resolution to the workspace check in `build()`, where the
  workspace's views are visible.
- Reference semantics only: the referenced view is NOT expanded inline by
  this profile. `panels.composed@1` owns composed rendering; the view-level
  `subdiagram … { mode: inline }` declaration is unchanged and unaffected.
- Endpoint contract: `flow.next`'s endpoint contract lists `flow.*` kinds
  only, so an `x_subdiagram` node of a non-`flow.*` kind used as a
  `flow.next` endpoint fails with the existing `DDN102`. The v1 rule is
  therefore: ref nodes are `flow.process` (or `flow.subprocess`) objects
  carrying `x_subdiagram`.

Element identities are untouched; a ref node keeps its own id and the badge
is a rendering mark on that node.

## Visual encoding and routing effects

Ref nodes render as ordinary flow nodes plus a small "↗ ref" badge at the
node's top-right corner, drawn with the existing `badge()` helper using the
theme accent/rule colours — echoing the view-level subdiagram badge style
("↗ target · diagram reference"). No other rendering change; routing and
layout are exactly the graph projection's.

## Alternatives considered

- **Reuse the view-level `subdiagram` declaration** — rejected for this
  purpose: it places a floating reference box on the canvas, not a flow node
  in the flowchart's layout. It stays available and unchanged
  (`examples/basics/08-subdiagrams.ddn` renders identically).
- **`@`-reference properties** (`x_subdiagram:{view:@payment_flow}`) —
  rejected: unresolvable refs fail the build inside `resolveValue` before any
  profile validation runs, making the dedicated missing-view diagnostic
  unreachable.
- **Inline expansion of the referenced view into the node** — rejected for
  v1: `panels.composed@1` owns composed rendering.

## Compatibility and migration

Additive only. No existing profile, kind, verb, extension or property is
edited; the view-level subdiagram machinery (`DDN064`, `DDN065`, `DDN900`
paths) is untouched. Sources that do not use `uml.interaction_overview@1` or
`x_subdiagram` are byte-for-byte unaffected.

## Security, privacy and accessibility

No new inputs: `x_subdiagram.view` is an author-supplied string checked
against the workspace's own view ids — it never triggers file or network
access. Rendered text is escaped through the shared `esc()` helper. The badge
text is static ("↗ ref"); the node keeps its `tabindex`/`role="group"`
markup like every other node.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json` `profiles[]` gains
  `uml.interaction_overview@1` (projection `graph`; validation: referenced
  views must exist in the workspace (DDN-PJ119); unsupported: inline
  expansion of referenced views, full UML conformance).
- `ddn-profiles.js` `registry()` and `standard/registry/extensions.json`
  `contracts{}` gain the `x_subdiagram` contract (object target; required
  `view` string, minLength 1; additionalProperties false).
- New error `DDN-PJ119` (verified free: RT-101…107 took PJ110–PJ118 + PJW03)
  — an `x_subdiagram.view` string names no view in the workspace. Checked in
  `ddn-core.js` `build()` beside the panels child-view checks (before the
  `Contracts.validate` call), because profile validators receive only `ir`
  and cannot see other views. The message names the node and the missing
  view id.
- Existing codes unchanged: a malformed `x_subdiagram` (missing `view`) fails
  the extension contract as `DDN105`; a non-`flow.*` ref node used as a
  `flow.next` endpoint fails as `DDN102`.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.interaction_overview@1` entry (61
  after this RFC).

## Positive and negative fixtures

- Positive example: `examples/basics/48-interaction-overview.ddn` (synthetic
  checkout: `overview` plus detail views `payment_flow` and `stock_flow` in
  one file).
- Test suite: `notation/tests/interaction-overview.js` — positive render with
  the `↗ ref` badge asserted in the SVG; the detail views render
  independently; `DDN-PJ119` for a missing target view; `DDN105` for
  `x_subdiagram:{}`; `DDN102` for a non-`flow.*` ref node as a `flow.next`
  endpoint; the RT view-level subdiagram regression
  (`08-subdiagrams.ddn` via `test:core`); byte-identical determinism.

## Implementation/conformance impact

Touch points: `ddn-core.js` `build()` (workspace view-existence check),
`ddn-profiles.js` `registry()` (`x_subdiagram` contract), `ddn-render.js`
`renderNode` (ref badge), profile catalogue, extensions registry,
capabilities registry. The graph projection and dispatcher need no edit.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary, D3 semantics (string reference, no inline
  expansion, ref-node kinds), D4 rejection behavior (`DDN-PJ119` in
  `build()`), D5 visual encoding, D6 alternatives, D7 compatibility: recorded
  above as fixed decisions of this RFC.
- Open: whether a later RFC adds inline expansion of referenced views behind
  a new profile version; explicitly unsupported in
  `uml.interaction_overview@1`.
