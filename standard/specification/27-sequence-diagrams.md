# 27. Sequence diagrams (projection `sequence`, profile `uml.sequence@1`)

Status: implemented in runtime 0.7.0. Source grammar remains
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

Every mark is registered through the shared `group` helper with contributor
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

## Unsupported (uml.sequence@1)

Combined fragments (alt/loop/opt); gates, creation/destruction and execution
specifications; full UML conformance. Ordering is author-declared, never
inferred from geometry or timestamps.

# 27a. Sequence diagrams at uml.sequence@2

Status: implemented in runtime 0.7.0.
`uml.sequence@1` stays installed and immutable; @2 is the UML 2.5.1
interaction surface. Every rule is opt-in by property: a view using none of
the extensions below renders byte-identically to @1.

## Combined fragments — `x_fragment`

A combined fragment anchors on its first covered `uml.message`:

```ddn
relation charge "Charge card" @checkout -> @payments { kind: "uml.message";
 x_fragment: { operator: alt; operands: [
 { guard: "card valid"; messages: [@flow.charge, @flow.capture]; },
 { guard: "else"; messages: [@flow.declined]; } ] };
}
```

- Operators: `alt`, `opt`, `loop`, `break`, `par`, `neg`, `critical`, `seq`,
 `strict`, `ignore`, `consider`, `assert` (contract enum; anything else is
 `DDN105`).
- Operand message lists must be contiguous in declaration order; sibling
 operands partition one contiguous span; `x_fragment` must anchor on the
 span's first message. Violations are `DDN-PJ155`.
- Nesting: an operand may carry `fragments: [ … ]` inline; nested spans must
 sit strictly inside their operand (max depth 8). Relation-level sibling
 fragments must be disjoint (`DDN-PJ155`).
- Rendering: frame over the covered lifelines/rows, operator pentagon
 top-left, `[guard]` at each operand's first row, dashed operand separators.
- `par` operands are message groups over the shared lifelines; region-local
 independent lifelines are a declared exclusion (recorded decision).

## Message sorts, gates and constraints — `x_message`

`x_message` gains `sort`, `gate`, `time`, `duration` (seq unchanged; still
enforced only by `uml.communication@1` via DDN-PJ111):

- `sort: synch` filled arrowhead (default) · `asynch` open arrowhead ·
 `reply` dashed open (equivalent to `x_return:true`; a conflicting
 `x_return:false` is `DDN-PJ156`).
- `sort: create` — «create» label; the target participant's header is drawn
 at the create row and its lifeline starts there. A create must be the first
 message incident to its target (`DDN-PJ156`).
- `sort: delete` — ✕ destruction marker on the target lifeline at that row;
 the lifeline stops there and any later message incident to the destroyed
 participant is `DDN-PJ156`.
- `sort: lost|found` — filled-circle free end; the message is self-anchored
 (`@a -> @a`) because the data model is a binary relation.
- `gate: source|target` — the named endpoint attaches to the innermost
 enclosing fragment's frame edge with a small square connection point; a
 gate without an enclosing fragment is `DDN-PJ156`.
- `time` / `duration` — observation/constraint text in `{…}` form, rendered
 beside the message row; any other form is `DDN-PJ159`.

## State invariants and authorable activations

- `x_invariant: [ { after: @msg, label } ]` on a participant draws the
 stadium-shaped state-invariant symbol on its lifeline just below that
 message row; the reference must be a visible message incident to the
 participant (`DDN-PJ157`).
- `x_activation: [ { from: @msg, to: @msg } ]` on a participant draws an
 explicit execution occurrence (same bar glyph as the derived ones);
 references must be incident and ordered (`DDN-PJ158`).

Fixture: `website/examples/basics/76-uml-sequence-complete.ddn` (both views),
tests in `notation/tests/uml-sequence-compliance.js`.
