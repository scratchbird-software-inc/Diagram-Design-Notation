# 27. Sequence diagrams (projection `sequence`, profile `uml.sequence@1`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-101
(`standard/governance/rfcs/RFC-101-sequence-diagram.md`). Source grammar remains
DDN 0.5; projection kinds are atom property values, so `kind:sequence;` is a
semantic addition, not a grammar change.

A sequence view projects the selected part of one semantic model into an
ordered-interaction diagram: participants become lifelines, and `uml.message`
relations become numbered messages.

This is profile-level coverage, not UML conformance.

## Metamodel

- **Participants** are the view's selected `object`-type elements, drawn
  left-to-right in `ir.elements` declaration order.
- **Messages** are the view's visible relations of kind `uml.message`, drawn
  top-to-bottom in `ir.relations` declaration order. The `uml.message` verb is
  registered with `family:'control'`, `start:'none'`, `end:'open'`,
  `source:['*']`, `target:['*']`, `allow_self:true`, `member_endpoints:false`.
- A **self-message** is a `uml.message` whose source and target are the same
  participant; it renders as a rectangular loop to the right of the lifeline.
- A **return** is a `uml.message` carrying the registered extension property
  `x_return:true` (boolean, relation target); it renders dashed with an open
  arrowhead.
- The **activation bar** on the receiver of message *i* spans from message
  *i*'s row to the row of the next message whose source is that participant,
  or to the last row if there is none.

## Source example

```ddn
view sequence "Synthetic order flow / sequence" {
    data: [@flow];
    projection { kind: sequence; profile: "uml.sequence@1"; }
}
```

with `data flow` declaring three objects (`customer_app`, `checkout`,
`inventory`) and five `uml.message` relations — see
`website/examples/basics/41-sequence-diagram.ddn`.

## Geometry rules

All coordinates derive from the style scale `s` and measured participant label
widths; the renderer is deterministic (same source → same SVG bytes):

- Equal participant spacing; one header box per participant at the top.
- A dashed vertical lifeline from each header to the bottom of the message
  area.
- Messages are horizontal arrows at descending y by declaration index at a
  fixed row pitch, numbered `1.`…`N.`, with the label above the arrow.
- Returns are dashed (`x_return:true`) with an open arrowhead; ordinary
  messages are solid with a filled arrowhead.
- Activation bars are thin filled rectangles straddling the receiver's
  lifeline.
- A footer note states that ordering is declaration order, not a verified
  protocol.

Every mark is registered through the shared `group()` helper with contributor
`sourceIds`, so each lifeline and message arrow remains traceable to its
declared element or relation.

## Validation and diagnostics

- `DDN-PJ110` (error) — a `uml.message` endpoint is not a selected `object`
  declaration; the message names the relation and the offending endpoint.
  (Member endpoints already fail earlier with `DDN102` because
  `member_endpoints:false`.)
- `DDN-PJW03` (warning diagnostic, not thrown) — a selected participant has
  no incident messages; the diagram still renders with an empty lifeline.
- Unchanged existing guards apply as to every data-bound projection: unknown
  kind `DDN-PJ001`, unknown projection property `DDN-PJ005` (no silent ignored
  settings), graph place/route/frame geometry `DDN-PJ002`, page/extent guards
  `DDN-PJ060/061`, Vega-Lite export `DDN-PJ070`.

## Unsupported

Combined fragments (alt/loop/opt); gates, creation/destruction and execution
specifications; full UML conformance. Ordering is author-declared, never
inferred from geometry or timestamps.
